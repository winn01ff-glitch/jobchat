/* ============================================
   Register Page - Email-based login/register
   ============================================ */
function renderRegister(params) {
    var page = document.getElementById('page-register');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.remove('hidden');

    // Pre-fill email from cache
    var cachedEmail = localStorage.getItem('uphill_email') || '';

    // If coming from a job posting, store the position
    var prePosition = (params && params[0]) ? params[0] : '';

    page.innerHTML = '<div class="form-container">' +
        '<div class="form-card">' +
            '<div class="form-icon-wrapper">✍️</div>' +
            '<h2 class="form-title" data-i18n="register.title">' + t('register.title') + '</h2>' +
            '<p class="form-subtitle" data-i18n="register.subtitle">' + t('register.subtitle') + '</p>' +
            '<form id="register-form" onsubmit="handleEmailSubmit(event)">' +
                '<div class="form-group">' +
                    '<label class="form-label">' + t('register.email') + ' <span style="color:var(--error)">*</span></label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">📧</span>' +
                        '<input type="email" class="form-input" id="reg-email" required ' +
                            'value="' + escapeHtml(cachedEmail) + '" ' +
                            'placeholder="' + t('register.emailPlaceholder') + '">' +
                    '</div>' +
                '</div>' +
                '<button type="submit" class="form-submit" id="reg-submit">' +
                    '<span data-i18n="register.submit">' + t('register.submit') + '</span>' +
                '</button>' +
            '</form>' +
        '</div>' +
    '</div>';

    // Store pre-selected position for later
    if (prePosition) {
        page.dataset.prePosition = prePosition;
    }
}

async function handleEmailSubmit(e) {
    e.preventDefault();
    var btn = document.getElementById('reg-submit');
    var email = document.getElementById('reg-email').value.trim().toLowerCase();

    if (!email) {
        showToast(I18n.t('register.fillAll'), 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        // Check if applicant with this email already exists → re-login
        var existing = await DB.getApplicantByEmail(email);
        if (existing) {
            localStorage.setItem('uphill_email', email);
            localStorage.setItem('uphill_session', JSON.stringify({
                id: existing.id, name: existing.name,
                email: email, token: existing.session_token
            }));
            chatState.applicantId = existing.id;
            chatState.applicantName = existing.name;
            showToast(I18n.t('register.welcomeBack') || 'Welcome back!', 'success');
            Router.navigateTo('chat', [existing.id]);
            return;
        }

        // New user → show display name modal
        showDisplayNameModal(email);
    } catch(err) {
        console.error('Email check failed:', err);
        showToast(I18n.t('common.error'), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>' + I18n.t('register.submit') + '</span>';
    }
}

function showDisplayNameModal(email) {
    var t = I18n.t.bind(I18n);
    var existing = document.getElementById('display-name-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'display-name-modal';
    modal.className = 'job-form-modal';
    modal.innerHTML =
        '<div class="job-form-card" style="max-width:420px">' +
            '<div class="job-form-header">' +
                '<h3>👋 ' + t('register.enterName') + '</h3>' +
            '</div>' +
            '<div class="job-form-body">' +
                '<p style="color:var(--text-secondary);margin:0 0 16px;font-size:var(--font-sm)">' +
                    t('register.nameHint') +
                '</p>' +
                '<div class="form-group">' +
                    '<label class="form-label">' + t('register.name') + '</label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">👤</span>' +
                        '<input type="text" class="form-input" id="modal-display-name" required ' +
                            'placeholder="' + t('register.namePlaceholder') + '" autofocus>' +
                    '</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label">' + t('register.phone') + ' <span style="color:var(--text-muted);font-weight:400;font-size:var(--font-xs)">(' + t('register.optional') + ')</span></label>' +
                    '<div class="input-with-icon">' +
                        '<span class="input-icon">📱</span>' +
                        '<input type="tel" class="form-input" id="modal-phone" ' +
                            'placeholder="' + t('register.phonePlaceholder') + '">' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="job-form-footer">' +
                '<button class="btn-job-publish" id="btn-confirm-name" onclick="confirmDisplayName(\'' + escapeHtml(email) + '\')">' +
                    t('register.submit') +
                '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    // Focus and enter key support
    setTimeout(function() {
        var input = document.getElementById('modal-display-name');
        if (input) {
            input.focus();
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmDisplayName(email);
                }
            });
        }
    }, 100);
}

async function confirmDisplayName(email) {
    var nameInput = document.getElementById('modal-display-name');
    var phoneInput = document.getElementById('modal-phone');
    var name = nameInput ? nameInput.value.trim() : '';
    var phone = phoneInput ? phoneInput.value.trim() : '';
    if (!name) {
        nameInput.style.borderColor = 'var(--error)';
        nameInput.focus();
        return;
    }

    var btn = document.getElementById('btn-confirm-name');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        var applicant = await DB.createApplicant({
            name: name, email: email, phone: phone, position: ''
        });

        // Cache session
        localStorage.setItem('uphill_email', email);
        localStorage.setItem('uphill_session', JSON.stringify({
            id: applicant.id, name: applicant.name,
            email: email, token: applicant.session_token
        }));

        chatState.applicantId = applicant.id;
        chatState.applicantName = applicant.name;

        // Close modal
        var modal = document.getElementById('display-name-modal');
        if (modal) modal.remove();

        NotificationManager.requestPermission();
        Router.navigateTo('chat', [applicant.id]);
    } catch(err) {
        console.error('Registration failed:', err);
        showToast(I18n.t('common.error'), 'error');
        btn.disabled = false;
        btn.innerHTML = I18n.t('register.submit');
    }
}
