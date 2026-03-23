/* ============================================
   Router - Hash-based client-side routing
   ============================================ */

const Router = {
    currentPage: 'landing',
    history: [],

    init() {
        // Handle hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Handle initial route
        this.handleRoute();
    },

    handleRoute() {
        const hash = window.location.hash.slice(1) || 'landing';
        const [page, ...params] = hash.split('/');
        this.navigateTo(page, params, false);
    },

    navigateTo(page, params = [], pushHash = true) {
        // Valid pages
        const validPages = ['landing', 'register', 'chat', 'admin-login', 'admin-dashboard', 'admin-chat'];
        if (!validPages.includes(page)) {
            page = 'landing';
        }

        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // Show target page
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // Update hash
        if (pushHash) {
            const hashValue = params.length > 0 ? `${page}/${params.join('/')}` : page;
            window.location.hash = hashValue;
        }

        // Track history
        this.history.push(this.currentPage);
        this.currentPage = page;

        // Update back button
        const backBtn = document.getElementById('btn-back');
        if (backBtn) {
            backBtn.classList.toggle('hidden', page === 'landing' || page === 'admin-dashboard');
        }

        // Trigger page-specific init
        this.onPageEnter(page, params);
    },

    onPageEnter(page, params) {
        switch (page) {
            case 'landing':
                if (typeof renderLanding === 'function') renderLanding();
                break;
            case 'register':
                if (typeof renderRegister === 'function') renderRegister();
                break;
            case 'chat':
                if (typeof renderChat === 'function') renderChat(params[0]);
                break;
            case 'admin-login':
                if (typeof renderAdminLogin === 'function') renderAdminLogin();
                break;
            case 'admin-dashboard':
                if (typeof renderAdminDashboard === 'function') renderAdminDashboard();
                break;
            case 'admin-chat':
                if (typeof renderAdminChat === 'function') renderAdminChat(params[0]);
                break;
        }
    }
};

function goBack() {
    const prev = Router.history.pop();
    if (prev) {
        Router.navigateTo(prev);
    } else {
        Router.navigateTo('landing');
    }
}
