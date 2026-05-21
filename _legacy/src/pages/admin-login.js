/* ============================================
   Admin Login Page
   ============================================ */
function renderAdminLogin() {
    Router.navigateTo('landing');
    setTimeout(function() { showAdminLoginModal(); }, 100);
}

function togglePasswordVisibility() {
    var pw = document.getElementById('admin-password');
    var btn = pw.parentElement.querySelector('.password-toggle');
    if (pw.type === 'password') {
        pw.type = 'text';
        btn.textContent = '🙈';
    } else {
        pw.type = 'password';
        btn.textContent = '👁️';
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    var btn = document.getElementById('admin-login-btn');
    var username = document.getElementById('admin-username').value.trim();
    var password = document.getElementById('admin-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        var result = await DB.adminLogin(username, password);
        window.adminSession = result;
        NotificationManager.requestPermission();
        
        // Close modal if it exists
        closeAdminLoginModal();
        
        Router.navigateTo('admin-dashboard');
    } catch(err) {
        showToast(I18n.t('admin.loginError'), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span data-i18n="admin.login">' + I18n.t('admin.login') + '</span>';
    }
}

function showAdminLoginModal() {
    var t = I18n.t.bind(I18n);
    var existing = document.getElementById('admin-login-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'admin-login-modal';
    modal.className = 'job-form-modal';
    modal.innerHTML =
        '<div class="job-form-card" style="max-width:400px">' +
            '<div class="job-form-header">' +
                '<h3>🔐 ' + t('admin.loginTitle') + '</h3>' +
                '<button class="job-form-close" onclick="closeAdminLoginModal()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);padding:4px 8px;line-height:1">✕</button>' +
            '</div>' +
            '<div class="job-form-body">' +
                '<form id="modal-admin-login-form" onsubmit="handleAdminLoginModal(event)">' +
                    '<div class="form-group">' +
                        '<label class="form-label">' + t('admin.id') + '</label>' +
                        '<div class="input-with-icon">' +
                            '<span class="input-icon">👤</span>' +
                            '<input type="text" class="form-input" id="modal-admin-username" required placeholder="Uphill..." autofocus>' +
                        '</div>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="form-label">' + t('admin.password') + '</label>' +
                        '<div class="input-with-icon" style="position:relative">' +
                            '<span class="input-icon">🔑</span>' +
                            '<input type="password" class="form-input" id="modal-admin-password" required placeholder="••••••••" style="padding-right:40px">' +
                            '<button type="button" class="password-toggle" onclick="toggleModalPasswordVisibility()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:4px">👁️</button>' +
                        '</div>' +
                    '</div>' +
                '</form>' +
            '</div>' +
            '<div class="job-form-footer">' +
                '<button class="btn-job-cancel" onclick="closeAdminLoginModal()">' + (t('admin.cancel') || 'Cancel') + '</button>' +
                '<button type="submit" form="modal-admin-login-form" class="btn-job-publish" id="modal-admin-login-btn">' +
                    t('admin.login') +
                '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);
}

function closeAdminLoginModal() {
    var modal = document.getElementById('admin-login-modal');
    if (modal) modal.remove();
}

function toggleModalPasswordVisibility() {
    var pw = document.getElementById('modal-admin-password');
    var btn = pw.parentElement.querySelector('.password-toggle');
    if (pw.type === 'password') {
        pw.type = 'text';
        btn.textContent = '🙈';
    } else {
        pw.type = 'password';
        btn.textContent = '👁️';
    }
}

async function handleAdminLoginModal(e) {
    e.preventDefault();
    var btn = document.getElementById('modal-admin-login-btn');
    var username = document.getElementById('modal-admin-username').value.trim();
    var password = document.getElementById('modal-admin-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        var result = await DB.adminLogin(username, password);
        window.adminSession = result;
        NotificationManager.requestPermission();
        closeAdminLoginModal();
        Router.navigateTo('admin-dashboard');
    } catch(err) {
        showToast(I18n.t('admin.loginError'), 'error');
        btn.disabled = false;
        btn.innerHTML = I18n.t('admin.login');
    }
}
