/* ============================================
   Jobs Page - Job Listings for Applicants
   ============================================ */

async function renderJobs() {
    var page = document.getElementById('page-jobs');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.remove('hidden');

    page.innerHTML = '<div class="jobs-container">' +
        '<div class="jobs-header">' +
            '<h2 data-i18n="jobs.title">' + t('jobs.title') + '</h2>' +
            '<p data-i18n="jobs.subtitle">' + t('jobs.subtitle') + '</p>' +
        '</div>' +
        '<div class="jobs-list" id="jobs-list">' +
            '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner"></div></div>' +
        '</div>' +
    '</div>';

    try {
        var jobs = await DB.getPublishedJobs();
        var list = document.getElementById('jobs-list');
        if (!list) return;

        if (jobs.length === 0) {
            list.innerHTML = '<div class="jobs-empty">' +
                '<div class="jobs-empty-icon">📋</div>' +
                '<p data-i18n="jobs.noJobs">' + t('jobs.noJobs') + '</p>' +
            '</div>';
            return;
        }

        list.innerHTML = '';
        jobs.forEach(function(job) {
            var posLabel = t('register.positions.' + job.position) || job.position || '';
            var preview = job.content.length > 100 ? job.content.substring(0, 100) + '...' : job.content;
            var dateStr = formatDate(job.created_at);

            var card = document.createElement('div');
            card.className = 'job-card';
            card.onclick = function() { showJobDetail(job); };
            card.innerHTML =
                '<div class="job-card-header">' +
                    '<h3 class="job-card-title">' + escapeHtml(job.title) + '</h3>' +
                    (posLabel ? '<span class="job-card-badge">' + escapeHtml(posLabel) + '</span>' : '') +
                '</div>' +
                '<div class="job-card-meta">' +
                    (job.salary ? '<div class="job-card-meta-item"><span class="meta-icon">💰</span>' + escapeHtml(job.salary) + '</div>' : '') +
                    (job.location ? '<div class="job-card-meta-item"><span class="meta-icon">📍</span>' + escapeHtml(job.location) + '</div>' : '') +
                '</div>' +
                '<div class="job-card-preview">' + escapeHtml(preview) + '</div>' +
                '<div class="job-card-footer">' +
                    '<span class="job-card-date">' + dateStr + '</span>' +
                    '<span class="job-card-action">' + t('jobs.viewDetail') + ' →</span>' +
                '</div>';
            list.appendChild(card);
        });
    } catch(e) {
        console.error('Failed to load jobs:', e);
        // Show empty state instead of error (table may not exist yet)
        var list = document.getElementById('jobs-list');
        if (list) {
            list.innerHTML = '<div class="jobs-empty">' +
                '<div class="jobs-empty-icon">📋</div>' +
                '<p data-i18n="jobs.noJobs">' + t('jobs.noJobs') + '</p>' +
            '</div>';
        }
    }
}

function showJobDetail(job) {
    var t = I18n.t.bind(I18n);
    var posLabel = t('register.positions.' + job.position) || job.position || '';

    var overlay = document.createElement('div');
    overlay.className = 'job-detail-overlay';
    overlay.id = 'job-detail-overlay';
    overlay.onclick = function(e) {
        if (e.target === overlay) overlay.remove();
    };

    overlay.innerHTML =
        '<div class="job-detail-card">' +
            '<div class="job-detail-header">' +
                '<button class="job-detail-close" onclick="document.getElementById(\'job-detail-overlay\').remove()">✕</button>' +
                '<h2 class="job-detail-title">' + escapeHtml(job.title) + '</h2>' +
                '<div class="job-detail-meta">' +
                    (posLabel ? '<span class="job-detail-meta-item">🏢 ' + escapeHtml(posLabel) + '</span>' : '') +
                    (job.salary ? '<span class="job-detail-meta-item">💰 ' + escapeHtml(job.salary) + '</span>' : '') +
                    (job.location ? '<span class="job-detail-meta-item">📍 ' + escapeHtml(job.location) + '</span>' : '') +
                '</div>' +
            '</div>' +
            '<div class="job-detail-body">' +
                '<div class="job-detail-content">' + escapeHtml(job.content) + '</div>' +
            '</div>' +
            '<div class="job-detail-footer">' +
                '<button class="job-detail-apply" onclick="applyFromJob(\'' + escapeHtml(job.position || '') + '\')">' +
                    '💬 ' + t('jobs.applyNow') +
                '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
}

function applyFromJob(position) {
    // Close modal
    var overlay = document.getElementById('job-detail-overlay');
    if (overlay) overlay.remove();
    // Navigate to register with position pre-selected
    Router.navigateTo('register');
    // Pre-select position after render
    setTimeout(function() {
        var posSelect = document.getElementById('reg-position');
        if (posSelect && position) {
            posSelect.value = position;
        }
    }, 100);
}

// Language change listener
window.addEventListener('languageChanged', function() {
    var page = document.getElementById('page-jobs');
    if (page && page.classList.contains('active')) {
        renderJobs();
    }
});
