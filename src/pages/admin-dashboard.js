/* ============================================
   Admin Dashboard - Messenger Style
   ============================================ */

var dashboardState = {
    applicants: [],
    selectedId: null,
    subscriptions: [],
    filter: 'all'
};

function renderAdminDashboard() {
    var page = document.getElementById('page-admin-dashboard');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.add('hidden');

    page.innerHTML = '<div class="admin-container">' +
        '<div class="admin-sidebar" id="admin-sidebar">' +
            '<div class="sidebar-header">' +
                '<h2 class="sidebar-title" data-i18n="admin.chats">' + t('admin.chats') + '</h2>' +
                '<div style="display:flex;gap:6px;align-items:center">' +
                    '<span style="font-size:var(--font-xs);color:var(--text-muted)">' + (window.adminSession ? window.adminSession.profile.display_name : '') + '</span>' +
                    '<button class="btn-logout" onclick="handleAdminLogout()" data-i18n="admin.logout">' + t('admin.logout') + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="sidebar-search">' +
                '<div class="search-wrapper">' +
                    '<span class="search-icon">🔍</span>' +
                    '<input type="text" id="search-input" placeholder="' + t('admin.search') + '" oninput="filterConversations()">' +
                '</div>' +
            '</div>' +
            '<div class="sidebar-filters">' +
                '<button class="filter-tab active" data-filter="all" onclick="setFilter(\'all\')" data-i18n="admin.filterAll">' + t('admin.filterAll') + '</button>' +
                '<button class="filter-tab" data-filter="active" onclick="setFilter(\'active\')" data-i18n="admin.filterActive">' + t('admin.filterActive') + '</button>' +
                '<button class="filter-tab" data-filter="new" onclick="setFilter(\'new\')" data-i18n="admin.filterNew">' + t('admin.filterNew') + '</button>' +
            '</div>' +
            '<div class="conversation-list" id="conversation-list"></div>' +
        '</div>' +
        '<div class="admin-chat-area" id="admin-chat-area">' +
            '<div class="admin-empty-state">' +
                '<div class="admin-empty-icon">💬</div>' +
                '<p data-i18n="admin.selectConversation">' + t('admin.selectConversation') + '</p>' +
            '</div>' +
        '</div>' +
    '</div>';

    loadApplicants();
    subscribeToUpdates();
}

async function loadApplicants() {
    try {
        dashboardState.applicants = await DB.getAllApplicants();
        renderConversationList();
    } catch(e) {
        console.error('Failed to load applicants:', e);
    }
}

function renderConversationList() {
    var list = document.getElementById('conversation-list');
    if (!list) return;

    var search = (document.getElementById('search-input') || {}).value || '';
    search = search.toLowerCase();

    var filtered = dashboardState.applicants.filter(function(a) {
        if (search && a.name.toLowerCase().indexOf(search) === -1 && (a.phone || '').indexOf(search) === -1) {
            return false;
        }
        if (dashboardState.filter === 'active') return a.status === 'active';
        if (dashboardState.filter === 'new') {
            var created = new Date(a.created_at);
            var dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return created > dayAgo;
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">' +
            '<p>📭 ' + I18n.t('admin.noConversations') + '</p></div>';
        return;
    }

    list.innerHTML = '';
    filtered.forEach(function(applicant) {
        addConversationItem(list, applicant);
    });
}

async function addConversationItem(list, applicant) {
    var item = document.createElement('div');
    item.className = 'conversation-item' + (dashboardState.selectedId === applicant.id ? ' active' : '');
    item.onclick = function() { selectConversation(applicant.id); };

    var initials = applicant.name.charAt(0).toUpperCase();
    var lastMsg = await DB.getLastMessage(applicant.id);
    var lastMsgText = lastMsg ? parseMessagePreview(lastMsg.content) : I18n.t('admin.newApplicant');
    var timeStr = lastMsg ? formatTime(lastMsg.created_at) : formatTime(applicant.created_at);
    var posLabel = I18n.t('register.positions.' + applicant.position) || applicant.position;

    item.innerHTML = '<div class="conv-avatar">' + initials +
            '<span class="online-dot"></span></div>' +
        '<div class="conv-info">' +
            '<div class="conv-name">' + escapeHtml(applicant.name) +
                '<span class="conv-time">' + timeStr + '</span></div>' +
            '<div class="conv-last-msg">' + escapeHtml(lastMsgText) + '</div>' +
            '<div class="conv-position">🏢 ' + escapeHtml(posLabel) + '</div>' +
        '</div>';

    list.appendChild(item);
}

function parseMessagePreview(content) {
    try {
        var parsed = JSON.parse(content);
        if (parsed.type === 'image') return '📷 ' + I18n.t('chat.image');
        if (parsed.type === 'file') return '📎 ' + parsed.name;
        if (parsed.type === 'location') return '📍 ' + I18n.t('chat.location');
    } catch(e) {}
    return content.length > 40 ? content.substring(0, 40) + '...' : content;
}

function selectConversation(applicantId) {
    dashboardState.selectedId = applicantId;

    // Mobile: hide sidebar, show chat
    var sidebar = document.getElementById('admin-sidebar');
    var chatArea = document.getElementById('admin-chat-area');
    if (window.innerWidth <= 768) {
        sidebar.classList.add('hidden-mobile');
        chatArea.classList.remove('hidden-mobile');
    }

    // Update active state
    document.querySelectorAll('.conversation-item').forEach(function(item) {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    renderAdminChatView(applicantId);
}

function setFilter(filter) {
    dashboardState.filter = filter;
    document.querySelectorAll('.filter-tab').forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    renderConversationList();
}

function filterConversations() {
    renderConversationList();
}

function subscribeToUpdates() {
    // Clean old subscriptions
    dashboardState.subscriptions.forEach(function(sub) { DB.unsubscribe(sub); });
    dashboardState.subscriptions = [];

    // Subscribe to new applicants
    var sub1 = DB.subscribeToNewApplicants(function(applicant) {
        dashboardState.applicants.unshift(applicant);
        renderConversationList();
        NotificationManager.showNotification(
            I18n.t('admin.newApplicant'),
            applicant.name + ' - ' + applicant.position
        );
    });
    if (sub1) dashboardState.subscriptions.push(sub1);

    // Subscribe to all messages
    var sub2 = DB.subscribeToAllMessages(function(msg) {
        renderConversationList();
    });
    if (sub2) dashboardState.subscriptions.push(sub2);
}

async function handleAdminLogout() {
    try {
        await DB.adminLogout();
        window.adminSession = null;
        dashboardState.subscriptions.forEach(function(sub) { DB.unsubscribe(sub); });
        Router.navigateTo('landing');
    } catch(e) {
        console.error('Logout failed:', e);
    }
}
