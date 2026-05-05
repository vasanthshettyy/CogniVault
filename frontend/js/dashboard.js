/**
 * CogniVault - Dashboard Module
 * Loads stats, renders performance chart, displays recent uploads.
 */

document.addEventListener('DOMContentLoaded', initDashboard);

/**
 * Initialize the dashboard page.
 */
async function initDashboard() {
    // Auth check
    if (!CogniAPI.requireAuth()) return;

    // Setup sidebar
    setupSidebar();

    // Load and render data
    try {
        const data = await loadDashboardData();
        renderStats(data.stats);
        renderPerformanceChart(data.performance_history);
        renderRecentFiles(data.recent_uploads);
    } catch (error) {
        console.error('Dashboard load error:', error);
        CogniAPI.showToast('Failed to load dashboard data', 'error');
    }
}

/**
 * Setup sidebar user info, logout, and mobile toggle.
 */
function setupSidebar() {
    const userInfo = CogniAPI.getUserInfo();

    // Update user display
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    const avatarEl = document.getElementById('user-avatar');
    const greetingEl = document.getElementById('greeting-name');

    if (nameEl) nameEl.textContent = userInfo.name || 'User';
    if (emailEl) emailEl.textContent = userInfo.email || '';
    if (avatarEl) avatarEl.textContent = CogniAPI.getInitials(userInfo.name);
    if (greetingEl) greetingEl.textContent = (userInfo.name || 'User').split(' ')[0];

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            CogniAPI.logout();
        });
    }

    // Mobile sidebar toggle
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('visible');
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.classList.remove('visible');
        });
    }
}

/**
 * Load dashboard data from API.
 * @returns {Promise<object>} Dashboard data.
 */
async function loadDashboardData() {
    const uploads = await CogniAPI.apiRequest('/uploads/list');
    const analyses = await CogniAPI.apiRequest('/analysis/list');
    return buildDashboardPayload(uploads, analyses);
}

/**
 * Build dashboard data from real API responses.
 * @param {Array} uploads - Upload records.
 * @param {Array} analyses - Analysis records.
 * @returns {object} Formatted dashboard data.
 */
function buildDashboardPayload(uploads, analyses) {
    const completedAnalyses = (analyses || []).filter(a => a.status === 'completed');
    const avgPerformance = completedAnalyses.length > 0
        ? Math.round(completedAnalyses.reduce((sum, a) => sum + (a.performance_metric || 0), 0) / completedAnalyses.length)
        : 0;

    const flaggedCount = completedAnalyses.filter(a =>
        a.consistency_flags && a.consistency_flags.length > 0
    ).length;
    const consistencyRate = completedAnalyses.length > 0
        ? Math.round(((completedAnalyses.length - flaggedCount) / completedAnalyses.length) * 100)
        : 0;

    return {
        stats: {
            total_uploads: (uploads || []).length,
            total_analyses: (analyses || []).length,
            avg_performance: avgPerformance,
            consistency_rate: consistencyRate
        },
        recent_uploads: (uploads || []).slice(0, 5),
        performance_history: completedAnalyses.slice(-7).map(a => ({
            date: a.created_at ? a.created_at.split('T')[0] : 'Unknown',
            score: a.performance_metric || 0
        }))
    };
}

/**
 * Render stat cards with animated count-up.
 * @param {object} stats - Stats data.
 */
function renderStats(stats) {
    animateValue('stat-total-uploads', 0, stats.total_uploads, 800);
    animateValue('stat-total-analyses', 0, stats.total_analyses, 900);
    animateValue('stat-avg-score', 0, stats.avg_performance, 1000, '/100');
    animateValue('stat-consistency', 0, stats.consistency_rate, 1100, '%');
}

/**
 * Animate a number counting up.
 * @param {string} elementId - ID of the element.
 * @param {number} start - Start value.
 * @param {number} end - End value.
 * @param {number} duration - Animation duration in ms.
 * @param {string} [suffix=''] - Suffix to append (e.g., '%').
 */
function animateValue(elementId, start, end, duration, suffix = '') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);

        el.textContent = current + suffix;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/**
 * Render the performance trend line chart using Chart.js.
 * @param {Array} history - Array of {date, score} objects.
 */
function renderPerformanceChart(history) {
    const canvas = document.getElementById('performance-chart');
    if (!canvas || !history || history.length === 0) {
        const container = document.getElementById('chart-container');
        if (container) {
            container.innerHTML = `
                <div class="recent-files-empty">
                    <i class="fas fa-chart-line"></i>
                    <p>No performance data yet. Complete an analysis to see trends.</p>
                </div>
            `;
        }
        return;
    }

    const ctx = canvas.getContext('2d');

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(124, 58, 237, 0.3)');
    gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.1)');
    gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => {
                const d = new Date(h.date);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: [{
                label: 'Performance Score',
                data: history.map(h => h.score),
                borderColor: '#7c3aed',
                backgroundColor: gradient,
                borderWidth: 2.5,
                pointBackgroundColor: '#7c3aed',
                pointBorderColor: '#1c2128',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#a855f7',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1c2128',
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `Score: ${ctx.parsed.y}/100`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(48, 54, 61, 0.5)', drawBorder: false },
                    ticks: { color: '#6e7681', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    min: 0,
                    max: 100,
                    grid: { color: 'rgba(48, 54, 61, 0.3)', drawBorder: false },
                    ticks: {
                        color: '#6e7681',
                        font: { family: 'Inter', size: 11 },
                        stepSize: 25,
                        callback: (val) => val + '%'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

/**
 * Render the recent uploads list.
 * @param {Array} uploads - Array of upload records.
 */
function renderRecentFiles(uploads) {
    const container = document.getElementById('recent-files');
    if (!container) return;

    if (!uploads || uploads.length === 0) {
        container.innerHTML = `
            <div class="recent-files-empty">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>No uploads yet. Upload an activity log to get started.</p>
                <a href="uploads.html" class="btn-primary btn-sm">
                    <i class="fas fa-plus"></i> Upload File
                </a>
            </div>
        `;
        return;
    }

    container.innerHTML = uploads.map(file => `
        <div class="recent-file-item">
            <div class="recent-file-icon ${file.file_type}">
                <i class="fas ${CogniAPI.getFileIcon(file.file_type)}"></i>
            </div>
            <div class="recent-file-info">
                <div class="recent-file-name">${escapeHtml(file.file_name)}</div>
                <div class="recent-file-meta">
                    <span class="badge ${CogniAPI.getFileTypeBadge(file.file_type)}">${file.file_type}</span>
                    <span class="badge ${CogniAPI.getStatusBadge(file.upload_status)}">${file.upload_status}</span>
                    <span class="recent-file-date">${CogniAPI.formatDate(file.uploaded_at)}</span>
                </div>
            </div>
            <div class="recent-file-actions">
                <a href="analysis.html?upload_id=${file.upload_id}" class="btn-secondary btn-sm">
                    <i class="fas fa-bolt"></i> Analyze
                </a>
            </div>
        </div>
    `).join('');
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
