/**
 * CogniVault - Uploads Module
 * Handles drag-and-drop file upload, validation, progress, and file list management.
 */

/** @type {File|null} */
let selectedFile = null;

document.addEventListener('DOMContentLoaded', initUploads);

/**
 * Initialize the uploads page.
 */
async function initUploads() {
    if (!CogniAPI.requireAuth()) return;
    setupSidebar();
    setupDropZone();
    setupFileInput();
    setupUploadButton();
    await loadUploadedFiles();
}

/**
 * Setup sidebar (shared logic with dashboard).
 */
function setupSidebar() {
    const userInfo = CogniAPI.getUserInfo();
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = userInfo.name || 'User';
    if (emailEl) emailEl.textContent = userInfo.email || '';
    if (avatarEl) avatarEl.textContent = CogniAPI.getInitials(userInfo.name);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); CogniAPI.logout(); });

    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('visible');
        });
    }
    if (backdrop) backdrop.addEventListener('click', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('visible');
    });
}

/**
 * Setup drag-and-drop zone event listeners.
 */
function setupDropZone() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;

    // Prevent default drag behaviors on the whole page
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Highlight drop zone on drag
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-active');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-active');
        });
    });

    // Handle drop
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // Click to browse
    dropZone.addEventListener('click', () => {
        document.getElementById('file-input').click();
    });

    // Browse button
    const browseBtn = document.getElementById('browse-btn');
    if (browseBtn) {
        browseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('file-input').click();
        });
    }
}

/**
 * Setup file input change listener.
 */
function setupFileInput() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Clear file button
    const clearBtn = document.getElementById('clear-file-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearFileSelection);
    }
}

/**
 * Handle file selection - validate and display info.
 * @param {File} file - The selected file.
 */
function handleFileSelection(file) {
    // Validate file type
    const allowedTypes = ['csv', 'pdf', 'xlsx'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
        showUploadStatus('error', `Invalid file type ".${ext}". Only CSV, PDF, and XLSX files are accepted.`);
        return;
    }

    // Validate file size (10 MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showUploadStatus('error', `File is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`);
        return;
    }

    selectedFile = file;
    hideUploadStatus();

    // Show file info
    const fileInfo = document.getElementById('selected-file-info');
    const fileName = document.getElementById('selected-file-name');
    const fileSize = document.getElementById('selected-file-size');
    const fileIcon = document.getElementById('selected-file-icon');

    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
    if (fileIcon) {
        fileIcon.className = `selected-file-icon ${ext}`;
        fileIcon.innerHTML = `<i class="fas ${CogniAPI.getFileIcon(ext)}"></i>`;
    }
    if (fileInfo) fileInfo.classList.remove('hidden');

    // Enable upload button
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) uploadBtn.disabled = false;
}

/**
 * Clear file selection and reset UI.
 */
function clearFileSelection() {
    selectedFile = null;
    const fileInfo = document.getElementById('selected-file-info');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');

    if (fileInfo) fileInfo.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    if (uploadBtn) uploadBtn.disabled = true;
    hideUploadStatus();
}

/**
 * Setup upload button click handler.
 */
function setupUploadButton() {
    const uploadBtn = document.getElementById('upload-btn');
    if (!uploadBtn) return;

    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        await performUpload();
    });
}

/**
 * Perform the file upload with progress tracking.
 */
async function performUpload() {
    const uploadBtn = document.getElementById('upload-btn');
    const progressDiv = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-bar');
    const percentEl = document.getElementById('upload-percent');

    // Show loading state
    uploadBtn.classList.add('loading');
    uploadBtn.disabled = true;
    if (progressDiv) progressDiv.classList.remove('hidden');
    hideUploadStatus();

    try {
        const data = await CogniAPI.uploadFile(selectedFile, (percent) => {
            updateProgress(percent, progressBar, percentEl);
        });

        showUploadStatus('success', `"${data.file_name}" uploaded successfully!`);
        clearFileSelection();
        await loadUploadedFiles();

        // Offer to analyze
        setTimeout(() => {
            if (confirm('File uploaded! Would you like to analyze it now?')) {
                window.location.href = `analysis.html?upload_id=${data.upload_id}`;
            }
        }, 500);
    } catch (error) {
        showUploadStatus('error', error.message);
    } finally {
        uploadBtn.classList.remove('loading');
        if (progressDiv) progressDiv.classList.add('hidden');
        // Reset progress
        updateProgress(0, progressBar, percentEl);
    }
}

/**
 * Update progress bar UI.
 * @param {number} percent - 0-100.
 * @param {HTMLElement} bar - Progress bar fill element.
 * @param {HTMLElement} label - Percent label element.
 */
function updateProgress(percent, bar, label) {
    if (bar) bar.style.width = percent + '%';
    if (label) label.textContent = percent + '%';
}

/**
 * Show upload status message.
 * @param {string} type - 'success' or 'error'.
 * @param {string} message - Status message.
 */
function showUploadStatus(type, message) {
    const statusDiv = document.getElementById('upload-status');
    if (!statusDiv) return;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    statusDiv.className = `upload-status ${type}`;
    statusDiv.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    statusDiv.classList.remove('hidden');
}

/**
 * Hide upload status message.
 */
function hideUploadStatus() {
    const statusDiv = document.getElementById('upload-status');
    if (statusDiv) statusDiv.classList.add('hidden');
}

/**
 * Load and render the list of uploaded files.
 */
async function loadUploadedFiles() {
    const container = document.getElementById('uploads-list');
    const countEl = document.getElementById('files-count');
    if (!container) return;

    try {
        let uploads;
        uploads = await CogniAPI.apiRequest('/uploads/list');

        if (countEl) countEl.textContent = `${uploads.length} file${uploads.length !== 1 ? 's' : ''}`;

        if (!uploads || uploads.length === 0) {
            container.innerHTML = `
                <div class="uploads-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No files uploaded yet. Use the area above to upload your first activity log.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = uploads.map(file => `
            <div class="upload-list-item" id="upload-item-${file.upload_id}">
                <div class="upload-list-icon ${file.file_type}">
                    <i class="fas ${CogniAPI.getFileIcon(file.file_type)}"></i>
                </div>
                <div class="upload-list-info">
                    <div class="upload-list-name">${escapeHtml(file.file_name)}</div>
                    <div class="upload-list-meta">
                        <span class="badge ${CogniAPI.getFileTypeBadge(file.file_type)}">${file.file_type.toUpperCase()}</span>
                        <span class="badge ${CogniAPI.getStatusBadge(file.upload_status)}">${file.upload_status}</span>
                        <span class="upload-list-date">${CogniAPI.formatDate(file.uploaded_at)}</span>
                    </div>
                </div>
                <div class="upload-list-actions">
                    <a href="analysis.html?upload_id=${file.upload_id}" class="btn-secondary btn-sm" title="Analyze this file">
                        <i class="fas fa-bolt"></i> Analyze
                    </a>
                    <button class="btn-danger btn-sm" onclick="deleteUpload('${file.upload_id}')" title="Delete this file" id="delete-btn-${file.upload_id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = `
            <div class="error-container">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Delete an upload.
 * @param {string} uploadId - UUID of the upload to delete.
 */
async function deleteUpload(uploadId) {
    if (!confirm('Are you sure you want to delete this file? This will also remove any associated analyses.')) {
        return;
    }

    try {
        await CogniAPI.apiRequest(`/uploads/${uploadId}`, { method: 'DELETE' });

        // Remove from DOM with animation
        const item = document.getElementById(`upload-item-${uploadId}`);
        if (item) {
            item.style.transition = 'all 0.3s ease';
            item.style.opacity = '0';
            item.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                item.remove();
                // Update count
                const items = document.querySelectorAll('.upload-list-item');
                const countEl = document.getElementById('files-count');
                if (countEl) countEl.textContent = `${items.length} file${items.length !== 1 ? 's' : ''}`;
            }, 300);
        }

        CogniAPI.showToast('File deleted successfully', 'success');
    } catch (error) {
        CogniAPI.showToast('Failed to delete file: ' + error.message, 'error');
    }
}

/**
 * Format file size to human readable.
 * @param {number} bytes - Size in bytes.
 * @returns {string} Formatted size.
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str - Raw string.
 * @returns {string} Escaped string.
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
