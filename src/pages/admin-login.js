/* ============================================
   Admin Login Page
   ============================================ */
function renderAdminLogin() {
    var page = document.getElementById('page-admin-login');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.remove('hidden');

    page.innerHTML = '<div class="admin-login-container">' +
        '<div class="admin-login-card">' +
            '<div class="admin-login-icon">🔐</div>' +
            '<h2 class="admin-login-title" data-i18n="admin.loginTitle">' + t('admin.loginTitle') + '</h2>' +
            '<form id="admin-login-form" onsubmit="handleAdminLogin(event)">' +
                '<div class="form-group">' +
                    '<label class="form-label" data-i18n="admin.email">' + t('admin.email') + '</label>' +
                    '<input type="email" class="form-input" id="admin-email" required placeholder="admin@jobchat.com">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label" data-i18n="admin.password">' + t('admin.password') + '</label>' +
                    '<input type="password" class="form-input" id="admin-password" required placeholder="••••••••">' +
                '</div>' +
                '<button type="submit" class="form-submit" id="admin-login-btn">' +
                    '<span data-i18n="admin.login">' + t('admin.login') + '</span>' +
                '</button>' +
            '</form>' +
        '</div>' +
    '</div>';
}

async function handleAdminLogin(e) {
    e.preventDefault();
    var btn = document.getElementById('admin-login-btn');
    var email = document.getElementById('admin-email').value.trim();
    var password = document.getElementById('admin-password').value;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>';

    try {
        var result = await DB.adminLogin(email, password);
        window.adminSession = result;
        NotificationManager.requestPermission();
        Router.navigateTo('admin-dashboard');
    } catch(err) {
        showToast(I18n.t('admin.loginError'), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span data-i18n="admin.login">' + I18n.t('admin.login') + '</span>';
    }
}
