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
                    '<label class="form-label" data-i18n="admin.id">' + t('admin.id') + '</label>' +
                    '<input type="text" class="form-input" id="admin-username" required placeholder="Uphill...">' +
                '</div>' +
                '<div class="form-group">' +
                    '<label class="form-label" data-i18n="admin.password">' + t('admin.password') + '</label>' +
                    '<div style="position:relative">' +
                        '<input type="password" class="form-input" id="admin-password" required placeholder="••••••••" style="padding-right:40px">' +
                        '<button type="button" class="password-toggle" onclick="togglePasswordVisibility()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;color:var(--text-muted);padding:4px">👁️</button>' +
                    '</div>' +
                '</div>' +
                '<button type="submit" class="form-submit" id="admin-login-btn">' +
                    '<span data-i18n="admin.login">' + t('admin.login') + '</span>' +
                '</button>' +
            '</form>' +
        '</div>' +
    '</div>';
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
        Router.navigateTo('admin-dashboard');
    } catch(err) {
        showToast(I18n.t('admin.loginError'), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span data-i18n="admin.login">' + I18n.t('admin.login') + '</span>';
    }
}
