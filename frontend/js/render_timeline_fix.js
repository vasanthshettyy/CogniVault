/**
 * Render the AI-Restored activity timeline.
 */
function renderRestoredTimeline(imputedLog) {
    const container = document.getElementById('restored-timeline-container');
    if (!container) return;

    if (!imputedLog || !Array.isArray(imputedLog) || imputedLog.length === 0) {
        container.innerHTML = '<p class="text-muted">No reconstructed data log available.</p>';
        return;
    }

    const htmlRows = imputedLog.map((item, index) => {
        const fields = [];
        const ignoredFields = ['is_imputed', 'imputed_fields', 'field_logic', 'logic_path', 'confidence_score'];
        const timeKeys = ['timestamp', 'time', 'date', 'created_at'];
        
        // 1. Extract Display Time safely
        let displayTime = `Step ${index + 1}`;
        for (const tk of timeKeys) {
            if (item[tk]) {
                displayTime = typeof item[tk] === 'object' ? JSON.stringify(item[tk]) : String(item[tk]);
                break;
            }
        }

        // 2. Render Data Fields
        let highlightedSomething = false;
        Object.keys(item).forEach((key) => {
            // Skip metadata and time fields
            if (ignoredFields.includes(key) || timeKeys.includes(key)) return;
            
            const val = item[key];
            if (val === null || val === undefined || typeof val === 'object') return;

            const isFieldImputed = Array.isArray(item.imputed_fields) && item.imputed_fields.includes(key);
            
            if (!isFieldImputed) {
                // Observable Data
                fields.push(`
                    <div class="restored-item-field">
                        <strong>${key}:</strong> ${escapeHtml(String(val))}
                    </div>
                `);
            } else {
                // AI Imputed Data
                highlightedSomething = true;
                const metadata = (item.field_logic && item.field_logic[key]) ? item.field_logic[key] : null;
                const confidence = (metadata && !isNaN(metadata.confidence)) ? Number(metadata.confidence) : 85;
                const logic = metadata ? metadata.logic : (item.logic_path || 'Forensic pattern reconstruction');
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
                <div class="restored-item-time">${escapeHtml(displayTime)}</div>
                <div class="restored-item-content">
                    ${fields.join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlRows.join('');
}
