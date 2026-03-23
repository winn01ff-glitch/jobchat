/* ============================================
   Register Page - Messenger Style
   ============================================ */
function renderRegister() {
    var page = document.getElementById('page-register');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.remove('hidden');

    // Pre-fill email from cache
    var cachedEmail = localStorage.getItem('jobchat_email') || '';

    page.innerHTML = '<div class="form-container">' +
        '<div class="form-card">' +
            '<div class="form-icon-wrapper">✍️</div>' +
            '<h2 class="form-title" data-i18n="register.title">' + t('register.title') + '</h2>' +
            '<p class="form-subtitle" data-i18n="register.subtitle">' + t('register.subtitle') + '</p>' +
            '<form id="register-form" onsubmit="handleRegister(event)">' +
                '<div class="form-group">' +
                    '<label class="form-label" data-i18n="register.name">' + t('register.name') + '</label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">👤</span>' +
                        '<input type="text" class="form-input" id="reg-name" required ' +
                            'placeholder="' + t('register.namePlaceholder') + '" data-i18n-placeholder="register.namePlaceholder">' +
                    '</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">' + t('register.email') + ' <span style="color:var(--error)">*</span></label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">📧</span>' +
                        '<input type="email" class="form-input" id="reg-email" required ' +
                            'value="' + cachedEmail + '" ' +
                            'placeholder="' + t('register.emailPlaceholder') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">' + t('register.phone') + ' <span style="color:var(--text-muted);font-weight:400;font-size:var(--font-xs)">(' + t('register.optional') + ')</span></label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">📱</span>' +
                        '<input type="tel" class="form-input" id="reg-phone" ' +
                            'placeholder="' + t('register.phonePlaceholder') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label" data-i18n="register.position">' + t('register.position') + '</label>' +
                    '<select class="form-select" id="reg-position" required>' +
                        '<option value="" data-i18n="register.positionPlaceholder">' + t('register.positionPlaceholder') + '</option>' +
                        '<option value="factory">' + t('register.positions.factory') + '</option>' +
                        '<option value="restaurant">' + t('register.positions.restaurant') + '</option>' +
                        '<option value="construction">' + t('register.positions.construction') + '</option>' +
                        '<option value="office">' + t('register.positions.office') + '</option>' +
                        '<option value="it">' + t('register.positions.it') + '</option>' +
                        '<option value="other">' + t('register.positions.other') + '</option>' +
                    '</select>' +
                '</div>' +
                '<button type="submit" class="form-submit" id="reg-submit">' +
                    '<span data-i18n="register.submit">' + t('register.submit') + '</span>' +
                '</button>' +
            '</form>' +
        '</div>' +
    '</div>';
}

async function handleRegister(e) {
    e.preventDefault();
    var btn = document.getElementById('reg-submit');
    var name = document.getElementById('reg-name').value.trim();
    var email = document.getElementById('reg-email').value.trim();
    var phone = document.getElementById('reg-phone').value.trim();
    var position = document.getElementById('reg-position').value;

    if (!name || !email || !position) {
        showToast(I18n.t('register.fillAll'), 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        // Check if applicant with this email already exists → re-login
        var existing = await DB.getApplicantByEmail(email);
        if (existing) {
            localStorage.setItem('jobchat_email', email);
            localStorage.setItem('jobchat_session', JSON.stringify({
                id: existing.id, name: existing.name,
                email: email, token: existing.session_token
            }));
            chatState.applicantId = existing.id;
            chatState.applicantName = existing.name;
            showToast(I18n.t('register.welcomeBack') || 'Welcome back!', 'success');
            Router.navigateTo('chat', [existing.id]);
            return;
        }

        // New registration
        var applicant = await DB.createApplicant({
            name: name, email: email, phone: phone, position: position
        });

        // Cache email + session
        localStorage.setItem('jobchat_email', email);
        localStorage.setItem('jobchat_session', JSON.stringify({
            id: applicant.id, name: applicant.name,
            email: email, token: applicant.session_token
        }));

        chatState.applicantId = applicant.id;
        chatState.applicantName = applicant.name;
        NotificationManager.requestPermission();
        Router.navigateTo('chat', [applicant.id]);
    } catch(err) {
        console.error('Registration failed:', err);
        showToast(I18n.t('common.error'), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span>' + I18n.t('register.submit') + '</span>';
    }
}
