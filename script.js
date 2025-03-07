let songs = []; // Array to hold { file, fileHandle, tags, audioElement }
    
document.addEventListener('DOMContentLoaded', () => {
    // Create audio player container
    const audioPlayerContainer = document.createElement('div');
    audioPlayerContainer.className = 'audio-player';
    audioPlayerContainer.innerHTML = `
        <audio id="audioPreview" controls></audio>
        <div class="audio-info">
            <span id="currentTrack">No track selected</span>
            <div class="audio-controls">
                <button id="prevTrack" class="audio-control-btn" disabled>
                    <span class="material-icons-round">skip_previous</span>
                </button>
                <button id="nextTrack" class="audio-control-btn" disabled>
                    <span class="material-icons-round">skip_next</span>
                </button>
            </div>
        </div>
    `;
    document.querySelector('.current-file').appendChild(audioPlayerContainer);

    // Audio player elements
    const audioPlayer = document.getElementById('audioPreview');
    const currentTrackSpan = document.getElementById('currentTrack');
    const prevTrackBtn = document.getElementById('prevTrack');
    const nextTrackBtn = document.getElementById('nextTrack');
    let currentTrackIndex = -1;

    // Audio control functions
    function updateAudioControls() {
        prevTrackBtn.disabled = songs.length <= 1 || currentTrackIndex <= 0;
        nextTrackBtn.disabled = songs.length <= 1 || currentTrackIndex >= songs.length - 1;
        currentTrackSpan.textContent = songs[currentTrackIndex]?.file.name || 'No track selected';
    }

    function playTrack(index) {
        if (index >= 0 && index < songs.length) {
            currentTrackIndex = index;
            const song = songs[index];
            audioPlayer.src = URL.createObjectURL(song.file);
            audioPlayer.play();
            updateAudioControls();
        }
    }

    prevTrackBtn.addEventListener('click', () => {
        if (currentTrackIndex > 0) {
            playTrack(currentTrackIndex - 1);
        }
    });

    nextTrackBtn.addEventListener('click', () => {
        if (currentTrackIndex < songs.length - 1) {
            playTrack(currentTrackIndex + 1);
        }
    });

    audioPlayer.addEventListener('ended', () => {
        if (currentTrackIndex < songs.length - 1) {
            playTrack(currentTrackIndex + 1);
        }
    });
    const openFileBtn = document.getElementById('openFile');
    const tagForm = document.getElementById('tagForm');
    const compatCheckBtn = document.getElementById('compatCheck');
    const coverArtInput = document.getElementById('coverArtInput');
    let hasExistingCoverArt = false; // Add this line near the top with other variables

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

    // Modify open file button logic for multiple selection
    openFileBtn.addEventListener('click', async () => {
        songs = []; // clear previous selection
        try {
            let fileHandles = [];
            if (window.showOpenFilePicker) {
                fileHandles = await window.showOpenFilePicker({
                    multiple: true,
                    types: [{
                        description: 'Audio Files',
                        accept: { 'audio/*': ['.mp3', '.wav'] }
                    }]
                });
            } else {
                // Fallback with multiple attribute
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.mp3,.wav';
                input.onchange = (e) => {
                    fileHandles = Array.from(e.target.files).map(file => ({ getFile: async () => file, name: file.name }));
                    processFiles(fileHandles);
                };
                return input.click();
            }
            processFiles(fileHandles);
        } catch (error) {
            console.error('File open canceled or failed:', error);
        }
    });

    async function processFiles(handles) {
        for (const handle of handles) {
            let file = await handle.getFile();
            // Load metadata for each file
            await loadAudioTags(file, handle);
        }
        // If exactly one song, populate tag editor fields. Disable if many.
        if (songs.length === 1) {
            const { tags } = songs[0];
            document.getElementById('title').value = tags.title || '';
            document.getElementById('album').value = tags.album || '';
            document.getElementById('artist').value = tags.artist || '';
            document.getElementById('year').value = tags.year || '';
            document.getElementById('genre').value = tags.genre || '';
            document.getElementById('lyrics').value = (tags.unsynchronisedLyrics && tags.unsynchronisedLyrics.text) || '';
            // Update cover preview if exists
            if (tags.picture) {
                const { data, format } = tags.picture;
                const base64String = data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
                const dataUrl = `data:${format};base64,${btoa(base64String)}`;
                document.getElementById('coverPreview').innerHTML = `<img src="${dataUrl}" alt="Existing cover art">`;
            }
            tagForm.querySelectorAll('input, textarea, button[type="submit"]').forEach(el => el.disabled = false);
            document.getElementById('multipleSongsNotice').style.display = 'none';
        } else if (songs.length > 1) {
            // Enable batch editing for multiple songs
            document.getElementById('singleSongFields').style.display = 'none';
            document.getElementById('multipleSongsNotice').style.display = 'none';
            
            // Enable common fields for batch editing
            document.getElementById('album').disabled = false;
            document.getElementById('artist').disabled = false;
            document.getElementById('year').disabled = false;
            document.getElementById('genre').disabled = false;
            document.getElementById('coverArtInput').disabled = false;
            
            // Add batch editing notice
            const batchNotice = document.createElement('div');
            batchNotice.id = 'batchEditNotice';
            batchNotice.className = 'batch-edit-notice';
            batchNotice.innerHTML = `
                <span class="material-icons-round">info</span>
                <div>
                    <h4>Batch Editing Mode</h4>
                    <p>Editing ${songs.length} files. Changes will apply to all selected files.</p>
                </div>
            `;
            
            // Insert before the form
            const existingNotice = document.getElementById('batchEditNotice');
            if (!existingNotice) {
                document.getElementById('tagEditorSection').insertBefore(batchNotice, tagForm);
            }
            
            // Enable the submit button
            document.querySelector('button[type="submit"]').disabled = false;
            
            // Play the first track
            if (songs.length > 0 && currentTrackIndex === -1) {
                playTrack(0);
            }
        }
    }
    
    // Expose processFiles to window object for drag-drop.js
    window.processFiles = processFiles;

    async function loadAudioTags(file, fileHandle) {
        return new Promise(resolve => {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    const meta = tag.tags;
                    songs.push({ file, fileHandle, tags: meta });
                    resolve();
                },
                onError: function(error) {
                    console.error("Error reading tags:", error);
                    songs.push({ file, fileHandle, tags: {} });
                    resolve();
                }
            });
        });
    }

    // Compute song compatibility score: 5 required fields: title, album, artist, year, coverArt
    function computeCompatibilityScore(tags) {
        const required = ['title', 'album', 'artist', 'year'];
        let count = 0;
        required.forEach(field => {
            if (tags[field] && String(tags[field]).trim() !== '') count++;
        });
        // Check cover art presence
        if (tags.picture) count++;
        return Math.round((count / 5) * 100);
    }

    // Update compatibility check for multiple songs
    function updateSongsCompatibilityCheck() {
        // Calculate statistics
        const scores = songs.map(({ tags }) => computeCompatibilityScore(tags));
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const lowScoreFiles = scores.filter(score => score < 60).length;
        
        // Sort songs by score (lowest first)
        const sortedSongs = [...songs].sort((a, b) => 
            computeCompatibilityScore(a.tags) - computeCompatibilityScore(b.tags)
        );

        // Generate summary HTML
        const summaryHTML = `
            <div class="compatibility-summary">
                <h3>Compatibility Overview</h3>
                <div class="stats">
                    <div class="stat-card">
                        <div class="value">${songs.length}</div>
                        <div class="label">Total Files</div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${avgScore}%</div>
                        <div class="label">Average Score</div>
                    </div>
                    <div class="stat-card">
                        <div class="value">${lowScoreFiles}</div>
                        <div class="label">Files Need Attention</div>
                    </div>
                </div>
            </div>
        `;

        // Generate file grid HTML
        const filesHTML = `
            <div class="file-grid">
                ${sortedSongs.map(({ file, tags }) => {
                    const score = computeCompatibilityScore(tags);
                    const scoreClass = score >= 80 ? 'high-score' : score >= 60 ? 'medium-score' : 'low-score';
                    const scoreBadgeClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
                    
                    return `
                        <div class="file-card ${scoreClass}">
                            <h4>${file.name}</h4>
                            <div class="tag-list">
                                ${['title', 'album', 'artist', 'year'].map(field => `
                                    <div class="tag-item">
                                        <span class="material-icons-round ${tags[field] ? 'check-success' : 'check-error'}">
                                            ${tags[field] ? 'check_circle' : 'error'}
                                        </span>
                                        ${field.charAt(0).toUpperCase() + field.slice(1)}
                                    </div>
                                `).join('')}
                                <div class="tag-item">
                                    <span class="material-icons-round ${tags.picture ? 'check-success' : 'check-error'}">
                                        ${tags.picture ? 'check_circle' : 'error'}
                                    </span>
                                    Cover Art
                                </div>
                            </div>
                            <div class="score-badge ${scoreBadgeClass}">
                                Score: ${score}%
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Update the DOM
        document.getElementById('requiredFields').innerHTML = summaryHTML + filesHTML;
        document.getElementById('optionalFields').parentElement.style.display = 'none';
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
        if (songs.length === 0) {
            alert('Please select at least one file first.');
            return;
        }
        
        // Show loading indicator
        const submitBtn = tagForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Saving...';
        submitBtn.disabled = true;
        try {
            // Get common tag values for batch editing
            const commonTags = {
                album: document.getElementById('album').value.trim(),
                artist: document.getElementById('artist').value.trim(),
                year: document.getElementById('year').value.trim(),
                genre: document.getElementById('genre').value.trim()
            };
            
            // Get cover art if provided
            let coverArtData = null;
            if (croppedCoverArt) {
                const dataURL = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(croppedCoverArt);
                });
                coverArtData = dataURLToUint8Array(dataURL);
            }
            
            // Get custom tags
            const customTags = Array.from(document.querySelectorAll('.custom-tag')).map(tagElement => ({
                name: tagElement.querySelector('.tag-name').value.trim(),
                value: tagElement.querySelector('.tag-value').value.trim()
            })).filter(tag => tag.name && tag.value);
            
            // Process each song
            const results = [];
            for (let i = 0; i < songs.length; i++) {
                const { file, fileHandle, tags: existingTags } = songs[i];
                const fileBuffer = await file.arrayBuffer();
                let editedBlob;
                
                // Update progress
                submitBtn.innerHTML = `<span class="material-icons-round">hourglass_top</span> Processing ${i+1}/${songs.length}`;
                
                // If file is MP3, use BrowserID3Writer to update
                if (file.type === "audio/mpeg") {
                    const writer = new ID3Writer(fileBuffer);
                    writer.padding = 0;  // Ensure proper padding
                    
                    // For single file mode, use all fields
                    if (songs.length === 1) {
                        const singleFileTags = {
                            title: document.getElementById('title').value.trim(),
                            lyrics: document.getElementById('lyrics').value.trim(),
                            ...commonTags
                        };
                        
                        writer.setFrame('TIT2', singleFileTags.title)
                              .setFrame('TALB', singleFileTags.album)
                              .setFrame('TPE1', [singleFileTags.artist])
                              .setFrame('TYER', singleFileTags.year)
                              .setFrame('TCON', [singleFileTags.genre]);
                              
                        if (singleFileTags.lyrics) {
                            writer.setFrame('USLT', { description: '', lyrics: singleFileTags.lyrics });
                        }
                    } else {
                        // For batch mode, preserve title and lyrics, update common fields
                        writer.setFrame('TIT2', existingTags.title || '')
                              .setFrame('TALB', commonTags.album)
                              .setFrame('TPE1', [commonTags.artist])
                              .setFrame('TYER', commonTags.year)
                              .setFrame('TCON', [commonTags.genre]);
                              
                        // Preserve existing lyrics if any
                        if (existingTags.unsynchronisedLyrics && existingTags.unsynchronisedLyrics.text) {
                            writer.setFrame('USLT', { 
                                description: '', 
                                lyrics: existingTags.unsynchronisedLyrics.text 
                            });
                        }
                    }
                    
                    // Add cover art if provided
                    if (coverArtData) {
                        writer.setFrame('APIC', { 
                            type: 3, 
                            data: coverArtData, 
                            description: 'Front cover', 
                            mimeType: 'image/jpeg' 
                        });
                    }
                    
                    // Add custom tags
                    customTags.forEach(tag => {
                        writer.setFrame('TXXX', { description: tag.name, value: tag.value });
                    });
                    
                    await writer.addTag();
                    editedBlob = new Blob([writer.arrayBuffer], { type: file.type });
                } else {
                    // For non-MP3 files fallback
                    const updatedTags = songs.length === 1 
                        ? {
                            title: document.getElementById('title').value.trim(),
                            lyrics: document.getElementById('lyrics').value.trim(),
                            ...commonTags,
                            customTags
                        }
                        : {
                            title: existingTags.title || '',
                            lyrics: (existingTags.unsynchronisedLyrics && existingTags.unsynchronisedLyrics.text) || '',
                            ...commonTags,
                            customTags
                        };
                    
                    const metadataBlob = new Blob([JSON.stringify(updatedTags)], { type: 'application/json' });
                    editedBlob = new Blob([metadataBlob, fileBuffer], { type: file.type });
                }
                
                // Save the file
                const writable = await fileHandle.createWritable();
                await writable.write(editedBlob);
                await writable.close();
                
                results.push({
                    fileName: file.name,
                    success: true
                });
            }
            
            // Show success message
            const successCount = results.filter(r => r.success).length;
            if (successCount === songs.length) {
                alert(`Successfully updated tags for ${successCount} file${successCount > 1 ? 's' : ''}!`);
            } else {
                alert(`Updated tags for ${successCount} out of ${songs.length} files.`);
            }
            
            // Reload audio tags to reflect changes
            for (let i = 0; i < songs.length; i++) {
                const { file, fileHandle } = songs[i];
                await loadAudioTags(file, fileHandle);
            }
            
            // Update UI if needed
            if (songs.length === 1) {
                const { tags } = songs[0];
                document.getElementById('title').value = tags.title || '';
                document.getElementById('album').value = tags.album || '';
                document.getElementById('artist').value = tags.artist || '';
                document.getElementById('year').value = tags.year || '';
                document.getElementById('genre').value = tags.genre || '';
                document.getElementById('lyrics').value = (tags.unsynchronisedLyrics && tags.unsynchronisedLyrics.text) || '';
            }
        } catch (error) {
            console.error('Error editing files:', error);
            alert('Error editing files: ' + error.message);
        } finally {
            // Restore button state
            const submitBtn = tagForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = 'Save Tags';
            submitBtn.disabled = false;
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
            'year': document.getElementById('year').value.trim(), // Keep as required for compatibility
            'coverArt': document.getElementById('coverArtInput').files[0] || hasExistingCoverArt // Keep as required for compatibility
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

    // Update the compatibility check button handler
    compatCheckBtn.addEventListener('click', () => {
        if (songs.length === 0) {
            alert('Please select at least one file first');
            return;
        }
        mainContent.style.display = 'none';
        compatibilityPage.style.display = 'block';
        document.getElementById('optionalFields').parentElement.style.display = 
            songs.length > 1 ? 'none' : 'block';
        
        if (songs.length > 1) {
            updateSongsCompatibilityCheck();
        } else {
            updateCompatibilityCheck();
        }
    });

    backToMain.addEventListener('click', () => {
        compatibilityPage.style.display = 'none';
        mainContent.style.display = 'block';
    });

    // Update cover art preview to handle errors
    coverArtInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            hasExistingCoverArt = false; // Reset when new file is selected
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
