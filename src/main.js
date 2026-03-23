/* ============================================
   Main Entry Point
   ============================================ */

async function initApp() {
    try {
        // Initialize demo DB
        DemoDB.init();

        // Initialize Supabase (will fallback to DemoDB if not configured)
        initSupabase();

        // Initialize i18n
        await I18n.init();

        // Initialize notifications
        await NotificationManager.init();

        // Check for existing applicant session (token-based or email-based)
        var sessionStr = localStorage.getItem('jobchat_session');
        if (sessionStr) {
            try {
                var parsed = JSON.parse(sessionStr);
                if (parsed && parsed.id && parsed.token) {
                    var applicant = await DB.getApplicantByToken(parsed.token);
                    if (applicant) {
                        Router.init();
                        Router.navigateTo('chat', [applicant.id]);
                        return;
                    }
                }
                // Fallback: try email-based recovery
                if (parsed && parsed.email) {
                    var byEmail = await DB.getApplicantByEmail(parsed.email);
                    if (byEmail) {
                        localStorage.setItem('jobchat_session', JSON.stringify({
                            id: byEmail.id, name: byEmail.name,
                            email: byEmail.email, token: byEmail.session_token
                        }));
                        Router.init();
                        Router.navigateTo('chat', [byEmail.id]);
                        return;
                    }
                }
            } catch (e) {
                localStorage.removeItem('jobchat_session');
            }
        }

        // Check for admin session
        var adminSession = await DB.getAdminSession();
        if (adminSession) {
            window.adminSession = adminSession;
            Router.init();
            Router.navigateTo('admin-dashboard');
            return;
        }

        // Initialize router (will show landing page by default)
        Router.init();

    } catch (error) {
        console.error('App initialization failed:', error);
        // Fallback: just render landing page
        Router.init();
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
