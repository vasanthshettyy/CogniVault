/**
 * CogniVault - Analysis Module
 * Renders AI analysis results: scores, reasoning timeline, flags, patterns.
 * Handles polling for in-progress analyses.
 */

document.addEventListener('DOMContentLoaded', initAnalysis);

/**
 * Initialize the analysis page.
 */
async function initAnalysis() {
    if (!CogniAPI.requireAuth()) return;
    setupSidebar();

    const params = new URLSearchParams(window.location.search);
    const analysisId = params.get('analysis_id');
    const uploadId = params.get('upload_id');

    if (analysisId) {
        await loadAnalysisResult(analysisId);
    } else if (uploadId) {
        await startNewAnalysis(uploadId);
    } else {
        // No params — ask user to select an analysis
        document.getElementById('analysis-result-container').innerHTML = `
            <div style="text-align: center; padding: 4rem 1rem; background: var(--surface-light); border-radius: 12px; border: 1px solid var(--border-color); margin-top: 2rem;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 0.5rem;">No Analysis Selected</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Please select an analysis from your history or upload a new log file to begin.</p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <a href="uploads.html" class="btn-primary">Upload File</a>
                    <a href="history.html" class="btn-secondary">View History</a>
                </div>
            </div>
        `;
    }
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
 * Load an existing analysis result by ID.
 * @param {string} analysisId - Analysis UUID.
 */
async function loadAnalysisResult(analysisId) {
    const container = document.getElementById('analysis-result-container');
    showAnalysisLoading(container);

    try {
        const data = await CogniAPI.apiRequest(`/analysis/status/${analysisId}`);
        if (data.status === 'completed') {
            renderAnalysisResult(container, data);
        } else if (data.status === 'failed') {
            CogniAPI.showError('analysis-result-container', data.error_message || 'Analysis failed.');
        } else {
            await pollAnalysisStatus(analysisId, container);
        }
    } catch (error) {
        CogniAPI.showError('analysis-result-container', error.message);
    }
}

/**
 * Start a new analysis from an upload_id.
 * @param {string} uploadId - Upload UUID.
 */
async function startNewAnalysis(uploadId) {
    const container = document.getElementById('analysis-result-container');
    showAnalysisLoading(container);

    try {
        const result = await CogniAPI.apiRequest('/analysis/start', {
            method: 'POST',
            body: JSON.stringify({ upload_id: uploadId })
        });
        await pollAnalysisStatus(result.analysis_id, container);
    } catch (error) {
        CogniAPI.showError('analysis-result-container', error.message);
    }
}

/**
 * Poll analysis status until completed or failed.
 * @param {string} analysisId - Analysis UUID.
 * @param {HTMLElement} container - Result container.
 */
async function pollAnalysisStatus(analysisId, container) {
    const POLL_INTERVAL = 3000;
    const MAX_ATTEMPTS = 60;
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            attempts++;
            try {
                const data = await CogniAPI.apiRequest(`/analysis/status/${analysisId}`);
                if (data.status === 'completed') {
                    clearInterval(interval);
                    renderAnalysisResult(container, data);
                    resolve(data);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    CogniAPI.showError('analysis-result-container', data.error_message || 'Analysis failed.');
                    reject(new Error('Analysis failed'));
                }
            } catch (err) {
                clearInterval(interval);
                CogniAPI.showError('analysis-result-container', err.message);
                reject(err);
            }
            if (attempts >= MAX_ATTEMPTS) {
                clearInterval(interval);
                CogniAPI.showError('analysis-result-container', 'Analysis timed out. Please try again.');
                reject(new Error('Timeout'));
            }
        }, POLL_INTERVAL);
    });
}

/**
 * Show analysis loading state.
 * @param {HTMLElement} container - Container element.
 */
function showAnalysisLoading(container) {
    container.innerHTML = `
        <div class="analysis-loading">
            <div class="spinner spinner-lg"></div>
            <div class="analysis-loading-text">Reconstructing reasoning trace<span class="analysis-loading-dots"></span></div>
            <div class="analysis-loading-sub">Our AI is analyzing behavioral patterns and inferring hidden reasoning steps. This may take up to 30 seconds.</div>
        </div>
    `;
}

/**
 * Render the full analysis result.
 * @param {HTMLElement} container - Container element.
 * @param {object} data - Analysis data from API/mock.
 */
function renderAnalysisResult(container, data) {
    container.innerHTML = '';

    // 1. Meta Stats (Header)
    renderMetaStats(data.missing_density);

    // 2. Score Summary
    container.innerHTML += renderScores(data.confidence_score, data.performance_metric);

    // 3. Summary
    if (data.summary_text || data.summary) {
        container.innerHTML += renderSummary(data.summary_text || data.summary);
    }

    // 4. Reconstructed Steps (simple list)
    if (data.reconstructed_steps && data.reconstructed_steps.length > 0) {
        container.innerHTML += renderReconstructedSteps(data.reconstructed_steps);
    }

    // 5. Detailed Reasoning Timeline
    if (data.reasoning_steps && data.reasoning_steps.length > 0) {
        container.innerHTML += renderReasoningTimeline(data.reasoning_steps);
    }

    // 6. Consistency Flags
    container.innerHTML += renderConsistencyFlags(data.consistency_flags);

    // Setup Restoration Toggle
    setupRestorationToggle(data);

    // Animate elements in
    requestAnimationFrame(() => {
        animateScoreRings(data.confidence_score, data.performance_metric);
        if (data.missing_density !== undefined) {
            animateMetaRing(data.missing_density);
        }
        animateStepCards();
    });
}

/**
 * Render meta stats in the header.
 */
function renderMetaStats(density) {
    const metaContainer = document.getElementById('analysis-meta-stats');
    if (!metaContainer || density === undefined) return;

    const densityClass = density > 40 ? 'high-density' : '';

    metaContainer.innerHTML = `
        <div class="meta-score-ring ${densityClass}">
            <svg viewBox="0 0 48 48">
                <circle class="meta-score-ring-bg" cx="24" cy="24" r="22"></circle>
                <circle class="meta-score-ring-fill" id="meta-density-ring" cx="24" cy="24" r="22"></circle>
            </svg>
            <div class="meta-score-value">${Number(density).toFixed(1)}%</div>
        </div>
        <div class="meta-score-label">
            <span class="meta-score-title">Missing Density</span>
            <span class="meta-score-desc">Percentage of fragmented data bits</span>
        </div>
    `;
}

/**
 * Animate the meta density ring.
 */
function animateMetaRing(density) {
    const ring = document.getElementById('meta-density-ring');
    if (!ring) return;
    const circumference = 2 * Math.PI * 22; // ~138
    const offset = circumference - (density / 100) * circumference;
    setTimeout(() => {
        ring.style.strokeDashoffset = offset;
    }, 500);
}

/**
 * Setup the restoration toggle logic.
 */
function setupRestorationToggle(data) {
    const toggle = document.getElementById('restoration-toggle');
    const restoredContainer = document.getElementById('restored-timeline-container');
    const resultContainer = document.getElementById('analysis-result-container');

    if (!toggle) return;

    toggle.addEventListener('change', (e) => {
        const isRestored = e.target.checked;
        const currentView = isRestored ? resultContainer : restoredContainer;
        const nextView = isRestored ? restoredContainer : resultContainer;

        // Fade out current view
        currentView.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        currentView.style.opacity = '0';
        currentView.style.transform = 'translateY(-10px)';

        setTimeout(() => {
            currentView.style.display = 'none';
            nextView.style.display = 'block';
            nextView.style.opacity = '0';
            nextView.style.transform = 'translateY(10px)';

            if (isRestored) {
                renderRestoredTimeline(data.reconstructed_data_log);
                const timelineContainer = document.getElementById('restored-timeline-container');
                const existingForesight = document.getElementById('predictive-foresight-section');
                if (existingForesight) existingForesight.remove();
                if (data.predictive_foresight && data.predictive_foresight.length > 0) {
                    const foresightHtml = renderPredictivePatterns(data.predictive_foresight);
                    timelineContainer.insertAdjacentHTML('beforeend', foresightHtml);
                }
            }

            // Force reflow
            void nextView.offsetWidth;

            // Fade in next view
            nextView.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            nextView.style.opacity = '1';
            nextView.style.transform = 'translateY(0)';
        }, 300);
    });
}

/**
 * Render predictive behavioral patterns for the restored view.
 */
function renderPredictivePatterns(foresight) {
    const items = foresight.map(item => `
        <div class="pattern-item foresight-item animate-fadeInUp">
            <div class="pattern-bullet"></div>
            <div class="pattern-content">
                <div class="foresight-pattern-name">${escapeHtml(item.pattern_name)}</div>
                <div class="foresight-prediction"><strong>Future Prediction:</strong> ${escapeHtml(item.future_prediction)}</div>
                <div class="foresight-impact"><strong>Potential Impact:</strong> ${escapeHtml(item.impact)}</div>
            </div>
        </div>
    `).join('');

    return `
        <section class="patterns-section foresight-section" id="predictive-foresight-section" style="margin-top: var(--space-10); border-top: 1px solid var(--color-border); padding-top: var(--space-8);">
            <h2><i class="fas fa-crystal-ball"></i> Predictive Behavioral Foresight</h2>
            <p class="section-subtitle" style="margin-bottom: var(--space-6);">How current patterns predict future project evolution and user behavior.</p>
            ${items}
        </section>
    `;
}

/**
 * Render the de-fragmented activity trace.
 */
function renderRestoredTimeline(imputedLog) {
    const container = document.getElementById('restored-timeline');
    if (!container) return;

    if (!imputedLog || imputedLog.length === 0) {
        container.innerHTML = '<p class="text-muted">No reconstructed data log available.</p>';
        return;
    }

    container.innerHTML = imputedLog.map((item, index) => {
        const fields = [];
        // Metadata fields we don't want to show as data boxes
        const ignoredFields = ['is_imputed', 'imputed_fields', 'field_logic', 'original_bits', 'predicted_completion', 'logic_path', 'confidence_score'];
        
        // Find the best field for the timestamp
        const timeKeys = ['timestamp', 'time', 'date', 'created_at'];
        let displayTime = `Step ${index + 1}`;
        for (const tk of timeKeys) {
            if (item[tk]) {
                displayTime = item[tk];
                break;
            }
        }

        // Render ALL other fields
        const keysToRender = Object.keys(item).filter(k => !ignoredFields.includes(k) && !timeKeys.includes(k));
        let highlightedSomething = false;

        keysToRender.forEach((key, i) => {
            const val = item[key];
            if (val === null || val === undefined) return;

            let isFieldImputed = item.imputed_fields && item.imputed_fields.includes(key);
            
            // Fallback: If row is imputed but no specific fields were listed, highlight the first field
            if (item.is_imputed && (!item.imputed_fields || item.imputed_fields.length === 0) && !highlightedSomething) {
                if (key === 'action' || key === 'event_type' || i === 0) {
                    isFieldImputed = true;
                }
            }

            if (!isFieldImputed) {
                // Observable data - Clean box
                fields.push(`
                    <div class="restored-item-field">
                        <strong>${key}:</strong> ${escapeHtml(String(val))}
                    </div>
                `);
            } else {
                // Imputed data - Magic pulse highlight
                highlightedSomething = true;
                const metadata = item.field_logic ? item.field_logic[key] : null;
                const confidence = metadata ? metadata.confidence : 70;
                const logic = metadata ? metadata.logic : (item.logic_path || 'Inferred from behavioral patterns');
                const confClass = CogniAPI.getConfidenceClass(confidence);

                fields.push(`
                    <div class="restored-item-field">
                        <strong>${key}:</strong>
                        <span class="restored-field" data-confidence="${confClass}">
                            <i class="fas fa-magic"></i> ${escapeHtml(String(val))}
                            <span class="confidence-badge ${confClass}">${Math.round(confidence)}%</span>
                            <div class="logic-tooltip">${escapeHtml(logic)}</div>
                        </span>
                    </div>
                `);
            }
        });

        return `
            <div class="restored-item animate-fadeIn">
                <div class="restored-item-time">${escapeHtml(String(displayTime))}</div>
                <div class="restored-item-content">
                    ${fields.join('')}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render score circles.
 */
function renderScores(confidence, performance) {
    return `
        <section class="scores-section animate-fadeInUp">
            <div class="score-card">
                <div class="score-ring">
                    <svg viewBox="0 0 140 140">
                        <circle class="score-ring-bg" cx="70" cy="70" r="65"></circle>
                        <circle class="score-ring-fill confidence" id="confidence-ring" cx="70" cy="70" r="65"></circle>
                    </svg>
                    <div class="score-ring-value">
                        <span id="confidence-value">0</span><span class="score-unit">/100</span>
                    </div>
                </div>
                <div class="score-label">Confidence Score</div>
                <div class="score-sublabel">Overall reconstruction confidence</div>
            </div>
            <div class="score-card">
                <div class="score-ring">
                    <svg viewBox="0 0 140 140">
                        <circle class="score-ring-bg" cx="70" cy="70" r="65"></circle>
                        <circle class="score-ring-fill performance" id="performance-ring" cx="70" cy="70" r="65"></circle>
                    </svg>
                    <div class="score-ring-value">
                        <span id="performance-value">0</span><span class="score-unit">/100</span>
                    </div>
                </div>
                <div class="score-label">Performance Metric</div>
                <div class="score-sublabel">Coherence & completeness</div>
            </div>
        </section>
    `;
}

/**
 * Animate score ring SVGs.
 */
function animateScoreRings(confidence, performance) {
    const circumference = 2 * Math.PI * 65; // ~408

    // Animate confidence ring
    const confRing = document.getElementById('confidence-ring');
    const confValue = document.getElementById('confidence-value');
    if (confRing) {
        const offset = circumference - (confidence / 100) * circumference;
        setTimeout(() => { confRing.style.strokeDashoffset = offset; }, 100);
    }
    if (confValue) animateNumber(confValue, 0, confidence, 1500);

    // Animate performance ring
    const perfRing = document.getElementById('performance-ring');
    const perfValue = document.getElementById('performance-value');
    if (perfRing) {
        const offset = circumference - (performance / 100) * circumference;
        setTimeout(() => { perfRing.style.strokeDashoffset = offset; }, 300);
    }
    if (perfValue) animateNumber(perfValue, 0, performance, 1500);
}

/**
 * Animate a number counting up.
 */
function animateNumber(el, start, end, duration) {
    const startTime = performance.now();
    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (end - start) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

/**
 * Render summary section.
 */
function renderSummary(summary) {
    return `
        <div class="summary-card animate-fadeInUp" style="animation-delay: 0.2s;">
            <h2><i class="fas fa-align-left"></i> Analysis Summary</h2>
            <p class="summary-text">${escapeHtml(summary)}</p>
        </div>
    `;
}

/**
 * Render reconstructed steps list.
 */
function renderReconstructedSteps(steps) {
    const items = steps.map((step, i) => `
        <div class="recon-step">
            <div class="recon-step-num">${i + 1}</div>
            <div class="recon-step-text">${escapeHtml(step)}</div>
        </div>
    `).join('');

    return `
        <section class="recon-steps-section">
            <h2><i class="fas fa-shoe-prints"></i> Reconstructed Reasoning Steps</h2>
            ${items}
        </section>
    `;
}

/**
 * Render detailed reasoning timeline.
 */
function renderReasoningTimeline(steps) {
    const cards = steps.map(step => `
        <div class="step-card" id="step-${step.step_number}">
            <div class="step-header">
                <span class="step-number">${step.step_number}</span>
                <span class="badge ${step.step_type === 'observable' ? 'badge-success' : 'badge-accent'}">
                    ${step.step_type === 'observable' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-lightbulb"></i>'}
                    ${step.step_type}
                </span>
                <span class="step-confidence">${step.confidence}%</span>
            </div>
            <p class="step-description">${escapeHtml(step.description)}</p>
            <div class="step-evidence"><strong>Evidence:</strong> ${escapeHtml(step.evidence)}</div>
            <div class="confidence-bar-container">
                <div class="confidence-bar" data-width="${step.confidence}" style="width: 0%"></div>
            </div>
        </div>
    `).join('');

    return `
        <section class="timeline-section">
            <h2><i class="fas fa-project-diagram"></i> Detailed Reasoning Timeline</h2>
            <div class="timeline">${cards}</div>
        </section>
    `;
}

/**
 * Animate step cards appearing with stagger and confidence bars filling.
 */
function animateStepCards() {
    const cards = document.querySelectorAll('.step-card');
    cards.forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';

            // Animate confidence bar
            const bar = card.querySelector('.confidence-bar');
            if (bar) {
                setTimeout(() => {
                    bar.style.width = bar.dataset.width + '%';
                }, 200);
            }
        }, i * 120);
    });
}

/**
 * Render consistency flags.
 */
function renderConsistencyFlags(flags) {
    if (!flags || flags.length === 0) {
        return `
            <section class="flags-section">
                <h2><i class="fas fa-flag"></i> Consistency Flags</h2>
                <div class="no-flags">
                    <i class="fas fa-check-circle"></i>
                    <span>No consistency issues detected. The reasoning trace is internally consistent.</span>
                </div>
            </section>
        `;
    }

    const flagCards = flags.map(flag => `
        <div class="flag-card severity-${flag.severity}">
            <div class="flag-icon">
                <i class="fas fa-${flag.severity === 'high' ? 'exclamation-circle' : flag.severity === 'medium' ? 'exclamation-triangle' : 'info-circle'}"></i>
            </div>
            <div class="flag-content">
                <div class="flag-description">${escapeHtml(flag.description)}</div>
                <div class="flag-steps">
                    <span class="badge badge-neutral">
                        <i class="fas fa-link"></i>
                        Related steps: ${flag.related_steps.join(', ')}
                    </span>
                    <span class="badge badge-${flag.severity === 'high' ? 'error' : flag.severity === 'medium' ? 'warning' : 'info'}">
                        ${flag.severity} severity
                    </span>
                </div>
            </div>
        </div>
    `).join('');

    return `
        <section class="flags-section">
            <h2><i class="fas fa-flag"></i> Consistency Flags</h2>
            ${flagCards}
        </section>
    `;
}

/**
 * Render behavioral patterns.
 */
function renderPatterns(patterns) {
    const items = patterns.map(p => `
        <div class="pattern-item">
            <div class="pattern-bullet"></div>
            <span>${escapeHtml(p)}</span>
        </div>
    `).join('');

    return `
        <section class="patterns-section">
            <h2><i class="fas fa-fingerprint"></i> Detected Behavioral Patterns</h2>
            ${items}
        </section>
    `;
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
