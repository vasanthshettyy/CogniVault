/**
 * CogniVault API Client
 * All API communication goes through this module.
 * No other JS file should directly call fetch().
 */

const API_BASE_URL = `${window.location.origin}/api`;
const MOCK_MODE = false; // Set to true to use mock JSON data during development

/**
 * Get the stored JWT token from localStorage.
 * @returns {string|null} The token or null if not logged in.
 */
function getToken() {
    return localStorage.getItem('cv_access_token');
}

/**
 * Get stored user info from localStorage.
 * @returns {object} User data with id and name.
 */
function getUserInfo() {
    return {
        id: localStorage.getItem('cv_user_id'),
        name: localStorage.getItem('cv_user_name'),
        email: localStorage.getItem('cv_user_email')
    };
}

/**
 * Store authentication data after login.
 * @param {string} token - JWT access token.
 * @param {string} userId - User UUID.
 * @param {string} name - User display name.
 * @param {string} email - User email.
 */
function storeAuth(token, userId, name, email) {
    localStorage.setItem('cv_access_token', token);
    localStorage.setItem('cv_user_id', userId);
    localStorage.setItem('cv_user_name', name);
    localStorage.setItem('cv_user_email', email || '');
}

/**
 * Clear all authentication data and redirect to login.
 */
function logout() {
    localStorage.removeItem('cv_access_token');
    localStorage.removeItem('cv_user_id');
    localStorage.removeItem('cv_user_name');
    localStorage.removeItem('cv_user_email');
    window.location.href = 'login.html';
}

/**
 * Check if user is logged in. Redirect to login if not.
 */
function requireAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Core fetch wrapper. Handles auth headers, JSON parsing, and error normalization.
 * @param {string} endpoint - API path, e.g. '/auth/login'.
 * @param {object} options - Fetch options (method, body, etc.).
 * @returns {Promise<object>} The parsed JSON data field from the standard envelope.
 */
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Remove Content-Type for FormData (let browser set boundary)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const json = await response.json();

        if (!response.ok || json.status === 'error') {
            throw new Error(json.detail || json.message || `Request failed with status ${response.status}`);
        }

        return json.data;
    } catch (error) {
        // Handle network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Unable to connect to server. Please check your connection.');
        }
        // Handle 401 - redirect to login
        if (error.message && error.message.includes('401')) {
            logout();
            return;
        }
        throw error;
    }
}

/**
 * Upload a file using XMLHttpRequest to track upload progress.
 * @param {File} file - The file object to upload.
 * @param {function} onProgress - Callback receiving percent (0-100).
 * @returns {Promise<object>} The data field from the API response.
 */
function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/uploads/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        xhr.onload = () => {
            try {
                const json = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && json.status === 'success') {
                    resolve(json.data);
                } else {
                    reject(new Error(json.detail || json.message || `Upload failed with status ${xhr.status}.`));
                }
            } catch (e) {
                reject(new Error('Invalid response from server.'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(formData);
    });
}

/**
 * Load mock data from a local JSON file.
 * @param {string} fileName - Name of mock file (e.g., 'dashboard.json').
 * @returns {Promise<object>} Parsed JSON data.
 */
async function loadMockData(fileName) {
    try {
        const response = await fetch(`mock/${fileName}`);
        if (!response.ok) throw new Error('Mock file not found');
        return await response.json();
    } catch (error) {
        console.error(`Failed to load mock data: ${fileName}`, error);
        throw error;
    }
}

/**
 * Show a loading skeleton or spinner in a container.
 * @param {string} containerId - The id of the element to show loading state in.
 * @param {string} [message='Loading...'] - Loading message to display.
 */
function showLoading(containerId, message = 'Loading...') {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="loading-container">
            <div class="spinner spinner-lg"></div>
            <p>${message}</p>
        </div>
    `;
}

/**
 * Show an error message in a container.
 * @param {string} containerId - The id of the element.
 * @param {string} message - The error message.
 */
function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
        <div class="error-container">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button class="btn-secondary btn-sm" onclick="location.reload()">
                <i class="fas fa-redo"></i> Retry
            </button>
        </div>
    `;
}

/**
 * Show a toast notification.
 * @param {string} message - Toast message.
 * @param {string} [type='info'] - Toast type: success, error, warning, info.
 * @param {number} [duration=4000] - Auto-dismiss duration in ms.
 */
function showToast(message, type = 'info', duration = 4000) {
    // Remove existing toast if any
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Format a date string for display.
 * @param {string} dateStr - ISO date string.
 * @returns {string} Formatted date like "Jan 15, 2024".
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Format a date string with time.
 * @param {string} dateStr - ISO date string.
 * @returns {string} Formatted date like "Jan 15, 2024 at 10:30 AM".
 */
function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Get the user's initials from their name.
 * @param {string} name - Full name.
 * @returns {string} Initials (e.g., "JD" for "John Doe").
 */
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Get file type icon class.
 * @param {string} fileType - File type (csv, pdf, xlsx).
 * @returns {string} Font Awesome icon class.
 */
function getFileIcon(fileType) {
    const icons = {
        csv: 'fa-file-csv',
        pdf: 'fa-file-pdf',
        xlsx: 'fa-file-excel'
    };
    return icons[fileType] || 'fa-file';
}

/**
 * Get file type badge class.
 * @param {string} fileType - File type.
 * @returns {string} Badge CSS class.
 */
function getFileTypeBadge(fileType) {
    const badges = {
        csv: 'badge-success',
        pdf: 'badge-error',
        xlsx: 'badge-info'
    };
    return badges[fileType] || 'badge-neutral';
}

/**
 * Get status badge class.
 * @param {string} status - Status string.
 * @returns {string} Badge CSS class.
 */
function getStatusBadge(status) {
    const badges = {
        completed: 'badge-success',
        processing: 'badge-info',
        queued: 'badge-warning',
        pending: 'badge-warning',
        failed: 'badge-error'
    };
    return badges[status] || 'badge-neutral';
}

/**
 * Get the appropriate confidence color class based on score.
 * @param {number} score - Confidence score (0-100).
 * @returns {string} CSS class: high, medium, or low.
 */
function getConfidenceClass(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

// Export functions for use in other modules
window.CogniAPI = {
    apiRequest,
    uploadFile,
    loadMockData,
    storeAuth,
    logout,
    requireAuth,
    getToken,
    getUserInfo,
    showLoading,
    showError,
    showToast,
    formatDate,
    formatDateTime,
    getInitials,
    getFileIcon,
    getFileTypeBadge,
    getStatusBadge,
    getConfidenceClass,
    MOCK_MODE
};
