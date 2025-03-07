// Drag and drop functionality for file uploads
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.createElement('div');
    dropZone.id = 'dropZone';
    dropZone.className = 'drop-zone';
    dropZone.innerHTML = `
        <div class="drop-zone-content">
            <span class="material-icons-round">cloud_upload</span>
            <h3>Drag & Drop Audio Files Here</h3>
            <p>or use the Open File button</p>
        </div>
    `;

    // Insert the drop zone as the first child of mainContent
    const mainContent = document.getElementById('mainContent');
    mainContent.insertBefore(dropZone, mainContent.firstChild);

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('drop-zone-highlight');
    }

    function unhighlight() {
        dropZone.classList.remove('drop-zone-highlight');
    }

    async function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        // Show loading state
        dropZone.classList.add('loading');
        
        try {
            // Convert FileList to array of file-like objects with getFile method
            const fileHandles = Array.from(files).map(file => ({
                getFile: async () => file,
                name: file.name
            }));
            
            // Use the existing processFiles function from script.js
            if (typeof window.processFiles === 'function') {
                await window.processFiles(fileHandles);
            } else {
                console.error('processFiles function not available');
                showErrorMessage('Unable to process files. Please try again.');
            }
        } catch (error) {
            console.error('Error processing dropped files:', error);
            showErrorMessage('Error processing files: ' + error.message);
        } finally {
            // Remove loading state
            dropZone.classList.remove('loading');
        }
    }

    function showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <span class="material-icons-round">error</span>
            ${message}
        `;
        
        // Insert error message after drop zone
        dropZone.parentNode.insertBefore(errorDiv, dropZone.nextSibling);
        
        // Remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
});