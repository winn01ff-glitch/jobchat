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

        // Check for existing applicant session
        var sessionStr = localStorage.getItem('uphill_session');
        if (sessionStr) {
            try {
                var parsed = JSON.parse(sessionStr);
                // Try email-based recovery (primary)
                if (parsed && parsed.email) {
                    var byEmail = await DB.getApplicantByEmail(parsed.email);
                    if (byEmail) {
                        localStorage.setItem('uphill_session', JSON.stringify({
                            id: byEmail.id, name: byEmail.name,
                            email: byEmail.email, token: byEmail.session_token
                        }));
                        chatState.applicantId = byEmail.id;
                        chatState.applicantName = byEmail.name;
                        Router.init();
                        Router.navigateTo('chat', [byEmail.id]);
                        return;
                    }
                }
                // Fallback: try token-based
                if (parsed && parsed.id && parsed.token) {
                    var applicant = await DB.getApplicantByToken(parsed.token);
                    if (applicant) {
                        Router.init();
                        Router.navigateTo('chat', [applicant.id]);
                        return;
                    }
                }
            } catch (e) {
                localStorage.removeItem('uphill_session');
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
