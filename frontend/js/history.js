/**
 * CogniVault - History Module
 * Loads analysis history, renders sortable/filterable table with pagination.
 */

/** @type {Array} All history records */
let allHistory = [];
/** @type {Array} Filtered history records */
let filteredHistory = [];
/** @type {string} Current sort column */
let sortColumn = 'created_at';
/** @type {string} Current sort direction */
let sortDirection = 'desc';
/** @type {number} Current page */
let currentPage = 1;
/** @type {number} Rows per page */
const ROWS_PER_PAGE = 10;

document.addEventListener('DOMContentLoaded', initHistory);

/**
 * Initialize the history page.
 */
async function initHistory() {
    if (!CogniAPI.requireAuth()) return;
    setupSidebar();
    setupFilters();
    await loadHistory();
}

/**
 * Setup sidebar (shared).
 */
function setupSidebar() {
    const userInfo = CogniAPI.getUserInfo();
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = userInfo.name || 'User';
    if (emailEl) emailEl.textContent = userInfo.email || '';
    if (avatarEl) avatarEl.textContent = CogniAPI.getInitials(userInfo.name);

    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault(); CogniAPI.logout();
    });

    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (mobileToggle) mobileToggle.addEventListener('click', () => {
        sidebar?.classList.toggle('open');
        backdrop?.classList.toggle('visible');
    });
    if (backdrop) backdrop.addEventListener('click', () => {
        sidebar?.classList.remove('open');
        backdrop?.classList.remove('visible');
    });
}

/**
 * Setup filter event listeners.
 */
function setupFilters() {
    const searchInput = document.getElementById('history-search');
    const filterBtn = document.getElementById('filter-btn');
    const clearBtn = document.getElementById('clear-filter-btn');

    // Category filter
    const categorySelect = document.getElementById('history-category');
    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            currentPage = 1;
            applyFilters();
        });
    }

    // Live search on typing
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            currentPage = 1;
            applyFilters();
        }, 300));
    }

    // Filter button
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            currentPage = 1;
            applyFilters();
        });
    }

    // Clear filters
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (categorySelect) categorySelect.value = '';
            const dateFrom = document.getElementById('date-from');
            const dateTo = document.getElementById('date-to');
            if (dateFrom) dateFrom.value = '';
            if (dateTo) dateTo.value = '';
            currentPage = 1;
            applyFilters();
        });
    }
}

/**
 * Load history data.
 */
async function loadHistory() {
    const wrapper = document.getElementById('history-table-wrapper');
    CogniAPI.showLoading('history-table-wrapper', 'Loading analysis history...');

    try {
        allHistory = await CogniAPI.apiRequest('/history/list') || [];

        applyFilters();
    } catch (error) {
        CogniAPI.showError('history-table-wrapper', error.message);
    }
}

/**
 * Apply search and date filters, then render.
 */
function applyFilters() {
    const searchTerm = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
    const category = document.getElementById('history-category')?.value || '';
    const dateFrom = document.getElementById('date-from')?.value || '';
    const dateTo = document.getElementById('date-to')?.value || '';

    filteredHistory = allHistory.filter(item => {
        // Search filter
        if (searchTerm && !item.file_name.toLowerCase().includes(searchTerm)) {
            return false;
        }
        // Category filter
        if (category && item.file_type.toLowerCase() !== category.toLowerCase()) {
            return false;
        }
        // Date range filter
        if (dateFrom) {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (itemDate < dateFrom) return false;
        }
        if (dateTo) {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            if (itemDate > dateTo) return false;
        }
        return true;
    });

    // Apply sort
    sortData();

    // Update count
    const countEl = document.getElementById('results-count');
    if (countEl) countEl.textContent = `${filteredHistory.length} result${filteredHistory.length !== 1 ? 's' : ''}`;

    // Render
    renderTable();
    renderPagination();
}

/**
 * Sort filtered data by current column and direction.
 */
function sortData() {
    filteredHistory.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Handle dates
        if (sortColumn === 'created_at' || sortColumn === 'completed_at') {
            valA = new Date(valA || 0).getTime();
            valB = new Date(valB || 0).getTime();
        }

        // Handle numbers
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        // Handle strings
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Render the history table.
 */
function renderTable() {
    const wrapper = document.getElementById('history-table-wrapper');
    if (!wrapper) return;

    if (filteredHistory.length === 0) {
        wrapper.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon"><i class="fas fa-history"></i></div>
                <h3>No analysis history found</h3>
                <p>Upload a file and run an analysis to see results here.</p>
                <a href="uploads.html" class="btn-primary btn-sm"><i class="fas fa-upload"></i> Upload File</a>
            </div>
        `;
        return;
    }

    // Calculate page slice
    const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
    const endIdx = startIdx + ROWS_PER_PAGE;
    const pageData = filteredHistory.slice(startIdx, endIdx);

    const sortIcon = (col) => {
        const isActive = sortColumn === col;
        const icon = isActive ? (sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort';
        return `<i class="fas ${icon} sort-icon"></i>`;
    };

    const sortClass = (col) => sortColumn === col ? 'sorted' : '';

    wrapper.innerHTML = `
        <table class="history-table" id="history-table">
            <thead>
                <tr>
                    <th class="table-sno">#</th>
                    <th class="${sortClass('file_name')}" data-sort="file_name">File Name ${sortIcon('file_name')}</th>
                    <th data-sort="file_type">Type ${sortIcon('file_type')}</th>
                    <th class="${sortClass('created_at')}" data-sort="created_at">Date ${sortIcon('created_at')}</th>
                    <th class="${sortClass('confidence_score')}" data-sort="confidence_score">Confidence ${sortIcon('confidence_score')}</th>
                    <th class="${sortClass('performance_metric')}" data-sort="performance_metric">Performance ${sortIcon('performance_metric')}</th>
                    <th class="table-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${pageData.map((item, i) => `
                    <tr>
                        <td class="table-sno">${startIdx + i + 1}</td>
                        <td class="table-filename">
                            <a href="analysis.html?analysis_id=${item.analysis_id}">${escapeHtml(item.file_name)}</a>
                        </td>
                        <td><span class="badge ${CogniAPI.getFileTypeBadge(item.file_type)}">${item.file_type.toUpperCase()}</span></td>
                        <td>${CogniAPI.formatDate(item.created_at)}</td>
                        <td class="table-score ${getScoreClass(item.confidence_score)}">${item.confidence_score ?? '—'}</td>
                        <td class="table-score ${getScoreClass(item.performance_metric)}">${item.performance_metric ?? '—'}</td>
                        <td class="table-actions">
                            <a href="analysis.html?analysis_id=${item.analysis_id}" class="btn-ghost btn-sm" title="View analysis">
                                <i class="fas fa-eye"></i>
                            </a>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    // Attach sort handlers
    wrapper.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortColumn === col) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = col;
                sortDirection = 'asc';
            }
            currentPage = 1;
            applyFilters();
        });
    });
}

/**
 * Render pagination controls.
 */
function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    const totalPages = Math.ceil(filteredHistory.length / ROWS_PER_PAGE);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Previous button
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
        <i class="fas fa-chevron-left"></i>
    </button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-info">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-info">...</span>`;
        html += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    // Next button
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
        <i class="fas fa-chevron-right"></i>
    </button>`;

    // Info
    const start = (currentPage - 1) * ROWS_PER_PAGE + 1;
    const end = Math.min(currentPage * ROWS_PER_PAGE, filteredHistory.length);
    html += `<span class="pagination-info">${start}-${end} of ${filteredHistory.length}</span>`;

    pagination.innerHTML = html;
}

/**
 * Navigate to a specific page.
 * @param {number} page - Page number.
 */
function goToPage(page) {
    const totalPages = Math.ceil(filteredHistory.length / ROWS_PER_PAGE);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderTable();
    renderPagination();
    // Scroll to top of table
    document.getElementById('history-table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Make goToPage global for onclick handlers
window.goToPage = goToPage;

/**
 * Get CSS class for a score value.
 * @param {number} score - Score 0-100.
 * @returns {string} CSS class.
 */
function getScoreClass(score) {
    if (score == null) return '';
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

/**
 * Debounce utility.
 * @param {Function} func - Function to debounce.
 * @param {number} wait - Wait time in ms.
 * @returns {Function} Debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Escape HTML.
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
