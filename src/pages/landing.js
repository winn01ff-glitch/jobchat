/* ============================================
   Landing Page - Messenger Style
   ============================================ */
function renderLanding() {
    var page = document.getElementById('page-landing');
    var t = I18n.t.bind(I18n);

    page.innerHTML = '<div class="landing-container">' +
        '<div class="landing-content">' +
            '<div class="company-badge"><span class="pulse-dot"></span> ' + t('landing.badge') + '</div>' +

            '<h2 class="landing-title text-gradient" data-i18n="landing.title">' + t('landing.title') + '</h2>' +
            '<p class="landing-subtitle" data-i18n="landing.subtitle">' + t('landing.subtitle') + '</p>' +
            '<div class="features-grid">' +
                '<div class="feature-card">' +
                    '<div class="feature-icon">💬</div>' +
                    '<div class="feature-title" data-i18n="landing.feature1">' + t('landing.feature1') + '</div>' +
                    '<div class="feature-desc" data-i18n="landing.feature1Desc">' + t('landing.feature1Desc') + '</div>' +
                '</div>' +
                '<div class="feature-card">' +
                    '<div class="feature-icon">⚡</div>' +
                    '<div class="feature-title" data-i18n="landing.feature2">' + t('landing.feature2') + '</div>' +
                    '<div class="feature-desc" data-i18n="landing.feature2Desc">' + t('landing.feature2Desc') + '</div>' +
                '</div>' +
                '<div class="feature-card">' +
                    '<div class="feature-icon">📎</div>' +
                    '<div class="feature-title" data-i18n="landing.feature3">' + t('landing.feature3') + '</div>' +
                    '<div class="feature-desc" data-i18n="landing.feature3Desc">' + t('landing.feature3Desc') + '</div>' +
                '</div>' +
                '<div class="feature-card">' +
                    '<div class="feature-icon">📍</div>' +
                    '<div class="feature-title" data-i18n="landing.feature4">' + t('landing.feature4') + '</div>' +
                    '<div class="feature-desc" data-i18n="landing.feature4Desc">' + t('landing.feature4Desc') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="landing-cta">' +
                '<button class="btn-primary" onclick="Router.navigateTo(\'register\')" data-i18n="landing.cta">' +
                    '💬 ' + t('landing.cta') +
                '</button>' +
                '<button class="btn-secondary" onclick="Router.navigateTo(\'jobs\')" data-i18n="landing.viewJobs">' +
                    '📋 ' + t('landing.viewJobs') +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';
}

function goBack() {
    window.history.back();
}

// Language change listener
window.addEventListener('languageChanged', function() {
    var page = document.getElementById('page-landing');
    if (page && page.classList.contains('active')) {
        renderLanding();
    }
});
