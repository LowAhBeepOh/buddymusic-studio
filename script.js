document.addEventListener('DOMContentLoaded', () => {
    const openFileBtn = document.getElementById('openFile');
    const tagForm = document.getElementById('tagForm');
    const compatCheckBtn = document.getElementById('compatCheck');
    const coverArtInput = document.getElementById('coverArtInput');
    let currentFile = null;
    let fileHandle = null; // New file handle from File System Access API

    // Add these variables at the top with other declarations
    let cropper = null;
    let croppedCoverArt = null;
    const cropperModal = document.getElementById('cropperModal');
    const cropperImage = document.getElementById('cropperImage');

    // Add custom tags handling
    const addCustomTagBtn = document.getElementById('addCustomTag');
    const customTagsContainer = document.getElementById('customTags');
    
    function createCustomTagElement() {
        const div = document.createElement('div');
        div.className = 'custom-tag';
        div.innerHTML = `
            <input type="text" placeholder="Tag name" class="tag-name">
            <textarea placeholder="Tag value" class="tag-value"></textarea>
            <button type="button" class="remove-tag">
                <span class="material-icons-round">delete</span>
            </button>
        `;
        
        div.querySelector('.remove-tag').addEventListener('click', () => div.remove());
        return div;
    }

    addCustomTagBtn.addEventListener('click', () => {
        customTagsContainer.appendChild(createCustomTagElement());
    });

    openFileBtn.addEventListener('click', async () => {
        // Use the File System Access API if available
        if (window.showOpenFilePicker) {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Audio Files',
                        accept: { 'audio/*': ['.mp3', '.wav'] }
                    }]
                });
                fileHandle = handle;
                currentFile = await fileHandle.getFile();
                document.querySelector('.current-file h2').textContent = currentFile.name;
                await loadAudioTags(currentFile);
            } catch (error) {
                console.error('File open canceled or failed:', error);
            }
        } else {
            // Fallback to input file element if API not available
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.mp3,.wav';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    currentFile = file;
                    document.querySelector('.current-file h2').textContent = file.name;
                    await loadAudioTags(file);
                }
            };
            input.click();
        }
    });

    async function loadAudioTags(file) {
        // Use jsmediatags to read the file's metadata
        jsmediatags.read(file, {
            onSuccess: function(tag) {
                const tags = tag.tags;
                document.getElementById('title').value = tags.title || '';
                document.getElementById('album').value = tags.album || '';
                document.getElementById('artist').value = tags.artist || '';
                document.getElementById('year').value = tags.year || '';
                document.getElementById('genre').value = tags.genre || '';
                if (tags.unsynchronisedLyrics && tags.unsynchronisedLyrics.text) {
                    document.getElementById('lyrics').value = tags.unsynchronisedLyrics.text;
                }
                console.log('Loaded tags:', tags);
            },
            onError: function(error) {
                console.log("Error reading tags: ", error.type, error.info);
            }
        });
    }

    // Convert DataURL to UInt8Array
    function dataURLToUint8Array(dataURL) {
        const base64 = dataURL.split(',')[1];
        const binary = atob(base64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return array;
    }

    tagForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentFile || !fileHandle) {
            alert('Please select a file first');
            return;
        }
        if (!confirm('Do you allow this website to edit the file?')) return;

        const tags = {
            title: document.getElementById('title').value,
            album: document.getElementById('album').value,
            artist: document.getElementById('artist').value,
            year: document.getElementById('year').value,
            genre: document.getElementById('genre').value,
            lyrics: document.getElementById('lyrics').value
        };

        let coverArtData = null;
        if (croppedCoverArt) {
            const dataURL = await new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(croppedCoverArt);
            });
            coverArtData = dataURLToUint8Array(dataURL);
        }

        // Add custom tags to the tags object
        const customTags = {};
        document.querySelectorAll('.custom-tag').forEach(tagElement => {
            const name = tagElement.querySelector('.tag-name').value.trim();
            const value = tagElement.querySelector('.tag-value').value.trim();
            if (name && value) {
                customTags[name] = value;
            }
        });

        // Add custom tags to the tags object
        tags.customTags = customTags;

        try {
            const fileBuffer = await currentFile.arrayBuffer();
            let editedBlob;
            // If file is MP3, use BrowserID3Writer to update:
            if (currentFile.type === "audio/mpeg") {
                // Use the correct global reference
                const writer = new ID3Writer(fileBuffer);
                writer.padding = 0;  // Ensure proper padding
                writer.setFrame('TIT2', tags.title)
                      .setFrame('TALB', tags.album)
                      .setFrame('TPE1', [tags.artist])
                      .setFrame('TYER', tags.year)
                      .setFrame('TCON', [tags.genre]);
                
                if (tags.lyrics) {
                    // Fix the USLT frame format
                    writer.setFrame('USLT', {
                        description: '',  // Required empty description
                        lyrics: tags.lyrics,  // The actual lyrics text
                    });
                }
                
                if (coverArtData) {
                    writer.setFrame('APIC', {
                        type: 3,
                        data: coverArtData,
                        description: 'Front cover',
                        mimeType: 'image/jpeg'
                    });
                }
                
                await writer.addTag();
                editedBlob = new Blob([writer.arrayBuffer], { type: currentFile.type });
            } else {
                // For WAV or unsupported types, fallback to prepending metadata blob.
                const metadataBlob = new Blob([JSON.stringify(tags)], { type: 'application/json' });
                editedBlob = new Blob([metadataBlob, fileBuffer], { type: currentFile.type });
            }
            // Write updated blob using File System Access API:
            const writable = await fileHandle.createWritable();
            await writable.write(editedBlob);
            await writable.close();
            currentFile = await fileHandle.getFile();
            alert('File edited and saved successfully!');
        } catch (error) {
            alert('Error editing file: ' + error.message);
        }
    });

    const mainContent = document.getElementById('mainContent');
    const compatibilityPage = document.getElementById('compatibilityPage');
    const backToMain = document.getElementById('backToMain');

    function updateCompatibilityCheck() {
        const requiredFields = {
            'title': document.getElementById('title').value.trim(),
            'album': document.getElementById('album').value.trim(),
            'artist': document.getElementById('artist').value.trim(),
            'year': document.getElementById('year').value.trim(),
            'coverArt': document.getElementById('coverArtInput').files[0]
        };

        const optionalFields = {
            'genre': document.getElementById('genre').value.trim(),
            'lyrics': document.getElementById('lyrics').value.trim(),
            'customTags': document.querySelectorAll('.custom-tag').length > 0
        };

        const requiredHTML = Object.entries(requiredFields).map(([field, value]) => `
            <div class="check-item">
                <span class="material-icons-round ${value ? 'check-success' : 'check-error'}">
                    ${value ? 'check_circle' : 'error'}
                </span>
                ${field.charAt(0).toUpperCase() + field.slice(1)}
                ${value ? '' : '<small style="color: var(--error-color)"> (Required)</small>'}
            </div>
        `).join('');

        const optionalHTML = Object.entries(optionalFields).map(([field, value]) => `
            <div class="check-item">
                <span class="material-icons-round ${value ? 'check-success' : ''}">
                    ${value ? 'check_circle' : 'remove'}
                </span>
                ${field.charAt(0).toUpperCase() + field.slice(1)}
                <small style="color: var(--text-secondary)"> (Optional)</small>
            </div>
        `).join('');

        document.getElementById('requiredFields').innerHTML = requiredHTML;
        document.getElementById('optionalFields').innerHTML = optionalHTML;

        // Add visual feedback
        const allRequired = Object.values(requiredFields).every(value => value);
        if (allRequired) {
            document.getElementById('requiredFields').parentElement.style.borderColor = 'var(--success-color)';
        } else {
            document.getElementById('requiredFields').parentElement.style.borderColor = 'var(--error-color)';
        }
    }

    // Update compatibility check when inputs change
    ['title', 'album', 'artist', 'year', 'genre', 'lyrics'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateCompatibilityCheck);
    });
    document.getElementById('coverArtInput').addEventListener('change', updateCompatibilityCheck);

    compatCheckBtn.addEventListener('click', () => {
        if (!currentFile) {
            alert('Please select a file first');
            return;
        }
        mainContent.style.display = 'none';
        compatibilityPage.style.display = 'block';
        updateCompatibilityCheck();
    });

    backToMain.addEventListener('click', () => {
        compatibilityPage.style.display = 'none';
        mainContent.style.display = 'block';
    });

    // Update cover art preview to handle errors
    coverArtInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    cropperImage.src = e.target.result;
                    cropperModal.style.display = 'block';
                    
                    // Destroy existing cropper if it exists
                    if (cropper && cropper.destroy) {
                        cropper.destroy();
                    }

                    // Initialize new cropper with error handling
                    cropper = new Cropper(cropperImage, {
                        aspectRatio: 1,
                        viewMode: 2,
                        autoCropArea: 1,
                        responsive: true,
                        background: false,
                        modal: true,
                        ready: function() {
                            // Cropper is fully initialized
                            console.log('Cropper is ready');
                        },
                        error: function(e) {
                            console.error('Cropper error:', e);
                        }
                    });
                } catch (error) {
                    console.error('Error initializing cropper:', error);
                    alert('Error initializing image cropper. Please try again.');
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Ensure cropper exists before using controls
    const safeRotate = (degrees) => {
        if (cropper && cropper.rotate) {
            cropper.rotate(degrees);
        }
    };

    const safeScale = (axis, value) => {
        if (cropper && cropper[axis]) {
            cropper[axis](value);
        }
    };

    // Update cropper control event listeners with safe functions
    document.getElementById('rotateLeft').addEventListener('click', () => safeRotate(-90));
    document.getElementById('rotateRight').addEventListener('click', () => safeRotate(90));
    document.getElementById('flipHorizontal').addEventListener('click', () => {
        if (cropper) {
            safeScale('scaleX', -cropper.getData().scaleX || -1);
        }
    });
    document.getElementById('flipVertical').addEventListener('click', () => {
        if (cropper) {
            safeScale('scaleY', -cropper.getData().scaleY || -1);
        }
    });

    // Update apply crop handler with error handling
    document.getElementById('applyCrop').addEventListener('click', () => {
        if (!cropper) {
            console.error('Cropper not initialized');
            return;
        }

        try {
            const canvas = cropper.getCroppedCanvas({
                width: 500,
                height: 500,
                fillColor: '#000',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });

            if (!canvas) {
                throw new Error('Failed to create cropped canvas');
            }

            canvas.toBlob(blob => {
                if (!blob) {
                    throw new Error('Failed to create image blob');
                }
                croppedCoverArt = blob;
                const preview = document.getElementById('coverPreview');
                preview.innerHTML = `<img src="${canvas.toDataURL()}" alt="Cover preview">`;
                cropperModal.style.display = 'none';
            }, 'image/jpeg', 0.95);
        } catch (error) {
            console.error('Error during crop:', error);
            alert('Error cropping image. Please try again.');
        }
    });

    // Update cancel/close handlers to properly clean up
    const cleanupCropper = () => {
        if (cropper && cropper.destroy) {
            cropper.destroy();
            cropper = null;
        }
        cropperModal.style.display = 'none';
        coverArtInput.value = '';
    };

    document.getElementById('cancelCrop').addEventListener('click', cleanupCropper);
    document.querySelector('.close-modal').addEventListener('click', cleanupCropper);
});
