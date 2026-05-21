/* ============================================
   Admin Dashboard - Messenger Style
   ============================================ */

var dashboardState = {
    applicants: [],
    selectedId: null,
    subscriptions: [],
    filter: 'all',
    activeTab: 'chats',
    jobs: [],
    editingJob: null,
    previewJobId: null
};

function renderAdminDashboard(params) {
    var page = document.getElementById('page-admin-dashboard');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.add('hidden');

    if (!window.adminSession) {
        Router.navigateTo('landing');
        setTimeout(function() { showAdminLoginModal(); }, 100);
        return;
    }

    if (params && params.length > 0) {
        dashboardState.selectedId = isNaN(params[0]) ? params[0] : parseInt(params[0], 10);
    }

    page.innerHTML = '<div class="admin-container">' +
        '<div class="admin-sidebar" id="admin-sidebar">' +
            '<div class="sidebar-search">' +
                '<div class="search-wrapper">' +
                    '<span class="search-icon">🔍</span>' +
                    '<input type="text" id="search-input" name="search_conversation" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="' + t('admin.search') + '" oninput="filterConversations()">' +
                '</div>' +
            '</div>' +
            '<div class="sidebar-filters">' +
                '<button class="filter-tab active" data-filter="all" onclick="setFilter(\'all\')" data-i18n="admin.filterAll">' + t('admin.filterAll') + '</button>' +
                '<button class="filter-tab" data-filter="unread" onclick="setFilter(\'unread\')" data-i18n="admin.filterUnread">' + t('admin.filterUnread') + '</button>' +
            '</div>' +
            '<div class="conversation-list" id="conversation-list"></div>' +
        '</div>' +
        '<div class="admin-chat-area hidden-mobile" id="admin-chat-area">' +
            '<div class="admin-empty-state">' +
                '<div class="admin-empty-icon">💬</div>' +
                '<p data-i18n="admin.selectConversation">' + t('admin.selectConversation') + '</p>' +
            '</div>' +
        '</div>' +
        /* Settings Modal */
        '<div id="admin-settings-modal" class="settings-modal hidden">' +
            '<div class="settings-overlay" onclick="closeAdminSettings()"></div>' +
            '<div class="settings-card">' +
                '<button onclick="handleAdminLogout()" data-i18n-title="admin.logout" title="' + t('admin.logout') + '" style="position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:var(--error);padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;transition:background 0.2s" onmouseover="this.style.background=\'rgba(240,40,73,0.1)\'" onmouseout="this.style.background=\'none\'">' +
                    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>' +
                '</button>' +
                '<h3 style="margin:0 0 12px;font-size:18px">⚙️ <span data-i18n="admin.settings">' + t('admin.settings') + '</span></h3>' +
                '<div style="text-align:center;margin-bottom:12px">' +
                    '<div id="settings-avatar-preview" class="settings-avatar" onclick="document.getElementById(\'avatar-input\').click()">' +
                        getAdminAvatar() +
                    '</div>' +
                    '<p style="font-size:var(--font-xs);color:var(--text-muted);margin:4px 0 0" data-i18n="admin.clickToChangeAvatar">' + t('admin.clickToChangeAvatar') + '</p>' +
                    '<input type="file" id="avatar-input" accept="image/*" hidden onchange="handleAvatarChange(event)">' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:8px">' +
                    '<label class="form-label" data-i18n="admin.displayName">' + t('admin.displayName') + '</label>' +
                    '<input type="text" class="form-input" id="settings-display-name" value="' + (window.adminSession ? escapeHtml(window.adminSession.profile.display_name) : '') + '">' +
                '</div>' +
                '<hr style="border:none;border-top:1px solid var(--border-light);margin:8px 0">' +
                '<div class="form-group" style="margin-bottom:8px">' +
                    '<label class="form-label">🔑 <span data-i18n="admin.currentPassword">' + t('admin.currentPassword') + '</span></label>' +
                    '<div style="position:relative">' +
                        '<input type="password" class="form-input" id="settings-current-password" data-i18n-placeholder="admin.currentPasswordPlaceholder" placeholder="' + t('admin.currentPasswordPlaceholder') + '" style="padding-right:40px">' +
                        '<button type="button" onclick="togglePwField(\'settings-current-password\', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted)">👁️</button>' +
                    '</div>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:8px">' +
                    '<label class="form-label">🔐 <span data-i18n="admin.newPassword">' + t('admin.newPassword') + '</span></label>' +
                    '<div style="position:relative">' +
                        '<input type="password" class="form-input" id="settings-new-password" data-i18n-placeholder="admin.newPasswordPlaceholder" placeholder="' + t('admin.newPasswordPlaceholder') + '" style="padding-right:40px">' +
                        '<button type="button" onclick="togglePwField(\'settings-new-password\', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted)">👁️</button>' +
                    '</div>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label" data-i18n="admin.confirmPassword">' + t('admin.confirmPassword') + '</label>' +
                    '<div style="position:relative">' +
                        '<input type="password" class="form-input" id="settings-confirm-password" data-i18n-placeholder="admin.confirmPasswordPlaceholder" placeholder="' + t('admin.confirmPasswordPlaceholder') + '" style="padding-right:40px">' +
                        '<button type="button" onclick="togglePwField(\'settings-confirm-password\', this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted)">👁️</button>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">' +
                    '<button onclick="closeAdminSettings()" style="padding:8px 20px;border:1px solid var(--border-light);border-radius:8px;background:white;cursor:pointer" data-i18n="admin.cancel">' + t('admin.cancel') + '</button>' +
                    '<button onclick="saveAdminSettings()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--messenger-blue);color:white;cursor:pointer;font-weight:600" data-i18n="admin.save">' + t('admin.save') + '</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';

    loadApplicants();
    subscribeToUpdates();
    showAdminHeaderControls();
}

async function loadApplicants() {
    try {
        dashboardState.applicants = await DB.getAllApplicants();
        // Deduplicate by ID
        var seenIds = {};
        dashboardState.applicants = dashboardState.applicants.filter(function(a) {
            if (seenIds[a.id]) return false;
            seenIds[a.id] = true;
            return true;
        });
        // Compute unread status for each applicant
        for (var i = 0; i < dashboardState.applicants.length; i++) {
            var a = dashboardState.applicants[i];
            var lastMsg = await DB.getLastMessage(a.id);
            a._hasUnread = lastMsg && lastMsg.sender_type === 'applicant' && (lastMsg.status === 'sent' || lastMsg.status === 'delivered');
        }
        await renderConversationList();
        if (dashboardState.selectedId) {
            selectConversation(dashboardState.selectedId);
        }
    } catch(e) {
        console.error('Failed to load applicants:', e);
    }
}

var _renderCounter = 0;

async function renderConversationList() {
    var list = document.getElementById('conversation-list');
    if (!list) return;

    var renderId = ++_renderCounter; // Cancel stale renders

    var search = (document.getElementById('search-input') || {}).value || '';
    search = search.toLowerCase();

    var filtered = dashboardState.applicants.filter(function(a) {
        if (search && a.name.toLowerCase().indexOf(search) === -1 && (a.phone || '').indexOf(search) === -1) {
            return false;
        }
        if (dashboardState.filter === 'unread') {
            return a._hasUnread === true;
        }
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">' +
            '<p>📭 ' + I18n.t('admin.noConversations') + '</p></div>';
        return;
    }

    // Build all items asynchronously, then render at once
    var items = [];
    for (var i = 0; i < filtered.length; i++) {
        if (renderId !== _renderCounter) return; // Stale render — abort
        var item = await buildConversationItem(filtered[i]);
        items.push(item);
    }

    if (renderId !== _renderCounter) return; // Stale render — abort

    list.innerHTML = '';
    items.forEach(function(item) { list.appendChild(item); });
}

async function buildConversationItem(applicant) {
    var item = document.createElement('div');
    item.className = 'conversation-item' + (dashboardState.selectedId === applicant.id ? ' active' : '') + (applicant._hasUnread ? ' unread' : '');
    item.onclick = function() { selectConversation(applicant.id); };

    var initials = applicant.name.charAt(0).toUpperCase();
    var lastMsg = await DB.getLastMessage(applicant.id);
    var lastMsgText = lastMsg ? parseMessagePreview(lastMsg.content) : I18n.t('admin.newApplicant');
    var timeStr = lastMsg ? formatTime(lastMsg.created_at) : formatTime(applicant.created_at);
    var phoneStr = applicant.phone ? '📱 ' + escapeHtml(applicant.phone) : '';

    item.innerHTML = '<div class="conv-avatar">' + initials + '</div>' +
        '<div class="conv-info">' +
            '<div class="conv-name">' + escapeHtml(applicant.name) +
                '<span class="conv-time">' + timeStr + '</span></div>' +
            (phoneStr ? '<div class="conv-phone">' + phoneStr + '</div>' : '') +
            '<div class="conv-last-msg">' + escapeHtml(lastMsgText) + '</div>' +
        '</div>';

    return item;
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
        var appHeader = document.getElementById('app-header');
        if (appHeader) appHeader.classList.add('hidden-mobile');
        var pageContainer = document.getElementById('page-container');
        if (pageContainer) pageContainer.classList.add('chat-active-mobile');
    }

    // Update active state
    document.querySelectorAll('.conversation-item').forEach(function(item) {
        item.classList.remove('active');
    });
    // Find and highlight the selected item
    var items = document.querySelectorAll('.conversation-item');
    items.forEach(function(item, idx) {
        if (dashboardState.applicants[idx] && dashboardState.applicants[idx].id === applicantId) {
            item.classList.add('active');
        }
    });

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
        // Check for duplicate before adding
        var exists = dashboardState.applicants.some(function(a) { return a.id === applicant.id; });
        if (!exists) {
            dashboardState.applicants.unshift(applicant);
        }
        renderConversationList();
        if (Router.currentPage === 'admin-dashboard' || Router.currentPage === 'admin-chat') {
            NotificationManager.showNotification(
                I18n.t('admin.newApplicant'),
                applicant.name + (applicant.position ? ' - ' + applicant.position : '')
            );
        }
    });
    if (sub1) dashboardState.subscriptions.push(sub1);

    // Subscribe to all messages — debounced reload to stay in sync
    var _reloadTimer = null;
    var sub2 = DB.subscribeToAllMessages(function(msg) {
        clearTimeout(_reloadTimer);
        _reloadTimer = setTimeout(function() { loadApplicants(); }, 300);
    });
    if (sub2) dashboardState.subscriptions.push(sub2);
}

function handleAdminLogout() {
    var title = (typeof I18n !== 'undefined' && I18n.t('admin.logout')) || 'Đăng xuất';
    var msg = (typeof I18n !== 'undefined' && I18n.t('chat.confirmLogout')) || 'Bạn có chắc chắn muốn đăng xuất?';

    showConfirmModal(title, msg, async function() {
        try {
            await DB.adminLogout();
            window.adminSession = null;
            dashboardState.subscriptions.forEach(function(sub) { DB.unsubscribe(sub); });
            hideAdminHeaderControls();
            Router.navigateTo('landing');
        } catch(e) {
            console.error('Logout failed:', e);
        }
    }, title);
}

function showAdminHeaderControls() {
    var controls = document.getElementById('admin-header-controls');
    var nameEl = document.getElementById('admin-header-name');
    var adminLoginBtn = document.getElementById('btn-admin-login');
    if (controls && window.adminSession) {
        nameEl.textContent = window.adminSession.profile.display_name;
        controls.classList.remove('hidden');
        if (adminLoginBtn) adminLoginBtn.classList.add('hidden');
    }
}

function hideAdminHeaderControls() {
    var controls = document.getElementById('admin-header-controls');
    if (controls) controls.classList.add('hidden');
    // Don't auto-show admin login btn here; the router handles it
}

// ============ Admin Settings ============

function getAdminAvatar() {
    if (!window.adminSession) return '👤';
    var avatar = window.adminSession.profile.avatar;
    if (avatar) {
        return '<img src="' + avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    }
    return window.adminSession.profile.display_name.charAt(0).toUpperCase();
}

window.toggleSidebar = function() {
    var sidebar = document.getElementById('admin-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
    }
};

function openAdminSettings() {
    var modal = document.getElementById('admin-settings-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAdminSettings() {
    var modal = document.getElementById('admin-settings-modal');
    if (modal) modal.classList.add('hidden');
}

function handleAvatarChange(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var preview = document.getElementById('settings-avatar-preview');
        if (preview) {
            preview.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
            preview.dataset.newAvatar = ev.target.result;
        }
    };
    reader.readAsDataURL(file);
}

function saveAdminSettings() {
    var nameInput = document.getElementById('settings-display-name');
    var preview = document.getElementById('settings-avatar-preview');
    var currentPw = document.getElementById('settings-current-password');
    var newPw = document.getElementById('settings-new-password');
    var confirmPw = document.getElementById('settings-confirm-password');
    var t = I18n.t.bind(I18n);

    var newName = nameInput ? nameInput.value.trim() : '';
    var newAvatar = preview ? preview.dataset.newAvatar || '' : '';
    var currentPassword = currentPw ? currentPw.value : '';
    var password = newPw ? newPw.value : '';
    var confirm = confirmPw ? confirmPw.value : '';

    if (!newName) {
        showToast(t('admin.nameRequired'), 'error');
        return;
    }

    // Password change validation
    if (password || confirm || currentPassword) {
        if (!currentPassword || currentPassword.length < 4) {
            showToast(t('admin.enterCurrentPassword') || 'Mật khẩu hiện tại phải có ít nhất 4 ký tự', 'error');
            return;
        }
        // Verify current password
        if (window.adminSession && currentPassword !== window.adminSession.profile.password_hash) {
            showToast(t('admin.currentPasswordWrong'), 'error');
            return;
        }
        if (password !== confirm) {
            showToast(t('admin.passwordMismatch'), 'error');
            return;
        }
        if (password.length < 4) {
            showToast(t('admin.passwordTooShort') || 'Mật khẩu mới phải có ít nhất 4 ký tự', 'error');
            return;
        }
    }

    // Build update data
    var updateData = { display_name: newName };
    if (newAvatar) updateData.avatar = newAvatar;
    if (password) updateData.password_hash = password;

    // Update session
    if (window.adminSession) {
        window.adminSession.profile.display_name = newName;
        if (newAvatar) window.adminSession.profile.avatar = newAvatar;
        if (password) window.adminSession.profile.password_hash = password;
        localStorage.setItem('jobchat_admin', JSON.stringify(window.adminSession.profile));

        // Save to database
        DB.updateAdminProfile(window.adminSession.user.id, updateData);
    }

    closeAdminSettings();
    showToast(t('admin.settingsSaved'), 'success');
    renderAdminDashboard();
}

function togglePwField(fieldId, btn) {
    var pw = document.getElementById(fieldId);
    if (!pw) return;
    if (pw.type === 'password') {
        pw.type = 'text';
        btn.textContent = '🙈';
    } else {
        pw.type = 'password';
        btn.textContent = '👁️';
    }
}

// ============ Tab Switching (removed — jobs tab no longer exists) ============

// ============ Job Post Management ============

async function loadAdminJobs() {
    try {
        dashboardState.jobs = await DB.getAllJobs();
        renderJobPostList();
        // Also update right panel if jobs tab is active
        if (dashboardState.activeTab === 'jobs') {
            renderJobPreviewPanel();
        }
    } catch(e) {
        console.error('Failed to load jobs:', e);
    }
}

function renderJobPreviewPanel() {
    var chatArea = document.getElementById('admin-chat-area');
    if (!chatArea) return;
    var t = I18n.t.bind(I18n);

    // If a specific job is selected, show its applicant-view preview
    if (dashboardState.previewJobId) {
        var job = dashboardState.jobs.find(function(j) { return j.id === dashboardState.previewJobId; });
        if (job) {
            showJobApplicantPreview(job);
            return;
        }
    }

    // No job selected — show empty state like chat
    chatArea.innerHTML = '<div class="admin-empty-state">' +
        '<div class="admin-empty-icon">📋</div>' +
        '<p>' + (dashboardState.jobs.length === 0 ? t('admin.noJobPosts') : t('admin.selectJobPreview')) + '</p>' +
    '</div>';
}

function selectJobPreview(jobId) {
    dashboardState.previewJobId = jobId;
    // Update highlight on left sidebar items
    var items = document.querySelectorAll('.job-post-item');
    items.forEach(function(el) { el.classList.remove('selected'); });
    // Find and highlight the selected one
    var list = document.getElementById('job-post-list');
    if (list) {
        var cards = list.children;
        for (var i = 0; i < dashboardState.jobs.length; i++) {
            if (dashboardState.jobs[i].id === jobId && cards[i]) {
                cards[i].classList.add('selected');
            }
        }
    }
    renderJobPreviewPanel();
}

function showJobApplicantPreview(job) {
    var chatArea = document.getElementById('admin-chat-area');
    if (!chatArea) return;
    var t = I18n.t.bind(I18n);
    var posLabel = t('register.positions.' + job.position) || job.position || '';
    var statusBadge = job.status === 'published'
        ? '<span style="background:rgba(52,199,89,0.12);color:var(--success);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">✅ Published</span>'
        : '<span style="background:rgba(255,149,0,0.12);color:#ff9500;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">📝 Draft</span>';

    chatArea.innerHTML =
        '<div class="job-applicant-preview">' +
            '<div class="job-ap-toolbar">' +
                '<button onclick="dashboardState.previewJobId=null;renderJobPreviewPanel()" class="job-ap-back">← ' + t('admin.jobPosts') + '</button>' +
                '<div style="display:flex;gap:6px">' +
                    '<button onclick="editJob(\'' + job.id + '\')" class="job-ap-edit">✏️ ' + t('admin.editJob') + '</button>' +
                '</div>' +
            '</div>' +
            '<div class="job-ap-card">' +
                '<div class="job-ap-status">' + statusBadge + '</div>' +
                '<h2 class="job-ap-title">' + escapeHtml(job.title) + '</h2>' +
                '<div class="job-ap-meta">' +
                    (posLabel ? '<div class="job-ap-meta-item">🏢 ' + escapeHtml(posLabel) + '</div>' : '') +
                    (job.salary ? '<div class="job-ap-meta-item">💰 ' + escapeHtml(job.salary) + '</div>' : '') +
                    (job.location ? '<div class="job-ap-meta-item">📍 ' + escapeHtml(job.location) + '</div>' : '') +
                '</div>' +
                '<hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0">' +
                '<div class="job-ap-content">' + escapeHtml(job.content || '').replace(/\n/g, '<br>') + '</div>' +
                '<hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0">' +
                '<button class="job-ap-apply-btn" disabled>' +
                    '💬 ' + t('jobs.applyNow') +
                '</button>' +
                '<p style="text-align:center;font-size:11px;color:var(--text-muted);margin-top:8px">👆 ' + t('jobs.viewDetail') + ' — Applicant View Preview</p>' +
            '</div>' +
        '</div>';
}

function renderJobPostList() {
    var list = document.getElementById('job-post-list');
    if (!list) return;
    var t = I18n.t.bind(I18n);

    if (dashboardState.jobs.length === 0) {
        list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">' +
            '<p>📋 ' + t('admin.noJobPosts') + '</p></div>';
        return;
    }

    list.innerHTML = '';
    dashboardState.jobs.forEach(function(job, index) {
        var item = document.createElement('div');
        item.className = 'job-post-item' + (dashboardState.previewJobId === job.id ? ' selected' : '');
        item.onclick = function() { selectJobPreview(job.id); };
        var posLabel = t('register.positions.' + job.position) || job.position || '';
        var statusClass = job.status === 'published' ? 'published' : 'draft';
        var statusText = job.status === 'published' ? '✅ Published' : '📝 Draft';

        item.innerHTML =
            '<div class="job-post-item-header">' +
                '<span class="job-post-item-title">' + escapeHtml(job.title) + '</span>' +
                '<span class="job-post-item-status ' + statusClass + '">' + statusText + '</span>' +
            '</div>' +
            '<div class="job-post-item-meta">' +
                (posLabel ? '🏢 ' + escapeHtml(posLabel) + ' · ' : '') +
                (job.salary ? '💰 ' + escapeHtml(job.salary) + ' · ' : '') +
                (job.location ? '📍 ' + escapeHtml(job.location) : '') +
            '</div>' +
            '<div class="job-post-item-actions">' +
                '<button onclick="event.stopPropagation();editJob(\'' + job.id + '\')">' + t('admin.editJob') + '</button>' +
                '<button class="btn-delete" onclick="event.stopPropagation();deleteJob(\'' + job.id + '\')">' + t('admin.deleteJob') + '</button>' +
            '</div>';
        list.appendChild(item);
    });

    // Auto-select first job if none selected
    if (!dashboardState.previewJobId && dashboardState.jobs.length > 0) {
        // Don't auto-select, show empty state
    }
    renderJobPreviewPanel();
}

function openJobForm(job) {
    var t = I18n.t.bind(I18n);
    dashboardState.editingJob = job || null;

    var modal = document.createElement('div');
    modal.className = 'job-form-modal';
    modal.id = 'job-form-modal';
    modal.onclick = function(e) { if (e.target === modal) closeJobForm(); };

    modal.innerHTML =
        '<div class="job-form-card">' +
            '<div class="job-form-header">' +
                '<h3>' + (job ? t('admin.editJob') : t('admin.createJob')) + '</h3>' +
                '<button class="job-form-close" onclick="closeJobForm()">✕</button>' +
            '</div>' +
            '<div class="job-form-body">' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">' + t('admin.jobTitle') + ' *</label>' +
                    '<input type="text" class="form-input" id="job-title" value="' + (job ? escapeHtml(job.title) : '') + '">' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">' + t('admin.jobPosition') + '</label>' +
                    '<select class="form-select" id="job-position">' +
                        '<option value="">' + t('register.positionPlaceholder') + '</option>' +
                        '<option value="factory"' + (job && job.position === 'factory' ? ' selected' : '') + '>' + t('register.positions.factory') + '</option>' +
                        '<option value="restaurant"' + (job && job.position === 'restaurant' ? ' selected' : '') + '>' + t('register.positions.restaurant') + '</option>' +
                        '<option value="construction"' + (job && job.position === 'construction' ? ' selected' : '') + '>' + t('register.positions.construction') + '</option>' +
                        '<option value="office"' + (job && job.position === 'office' ? ' selected' : '') + '>' + t('register.positions.office') + '</option>' +
                        '<option value="it"' + (job && job.position === 'it' ? ' selected' : '') + '>' + t('register.positions.it') + '</option>' +
                        '<option value="other"' + (job && job.position === 'other' ? ' selected' : '') + '>' + t('register.positions.other') + '</option>' +
                    '</select>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">' + t('admin.jobSalary') + '</label>' +
                    '<input type="text" class="form-input" id="job-salary" placeholder="例: ¥250,000/月" value="' + (job ? escapeHtml(job.salary || '') : '') + '">' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">' + t('admin.jobLocation') + '</label>' +
                    '<input type="text" class="form-input" id="job-location" placeholder="例: 東京" value="' + (job ? escapeHtml(job.location || '') : '') + '">' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">' + t('admin.jobContent') + ' *</label>' +
                    '<textarea class="form-input" id="job-content" rows="8" style="min-height:150px;resize:vertical" placeholder="Nhập nội dung bài tuyển dụng...">' + (job ? escapeHtml(job.content) : '') + '</textarea>' +
                '</div>' +
            '</div>' +
            '<div class="job-form-footer">' +
                '<button class="btn-job-cancel" onclick="closeJobForm()">✕ Cancel</button>' +
                '<button class="btn-job-draft" onclick="saveJob(\'draft\')">' + t('admin.saveDraft') + '</button>' +
                '<button class="btn-job-publish" onclick="saveJob(\'published\')">' + t('admin.publish') + '</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);
}

function closeJobForm() {
    var modal = document.getElementById('job-form-modal');
    if (modal) modal.remove();
    dashboardState.editingJob = null;
}

async function saveJob(status) {
    var title = document.getElementById('job-title').value.trim();
    var content = document.getElementById('job-content').value.trim();
    var position = document.getElementById('job-position').value;
    var salary = document.getElementById('job-salary').value.trim();
    var location = document.getElementById('job-location').value.trim();

    if (!title || !content) {
        showToast(I18n.t('register.fillAll'), 'error');
        return;
    }

    var admin = window.adminSession;
    var data = {
        title: title, content: content, position: position,
        salary: salary, location: location, status: status,
        author_id: admin ? admin.user.id : '',
        author_name: admin ? admin.profile.display_name : ''
    };

    try {
        if (dashboardState.editingJob) {
            await DB.updateJob(dashboardState.editingJob.id, data);
        } else {
            await DB.createJob(data);
        }
        closeJobForm();
        loadAdminJobs();
        showToast(status === 'published' ? '✅ Published!' : '📝 Saved as draft', 'success');
    } catch(e) {
        console.error('Save job failed:', e);
        showToast(I18n.t('common.error'), 'error');
    }
}

function editJob(jobId) {
    var job = dashboardState.jobs.find(function(j) { return j.id === jobId; });
    if (job) openJobForm(job);
}

async function deleteJob(jobId) {
    if (!confirm(I18n.t('admin.confirmDelete'))) return;
    try {
        await DB.deleteJob(jobId);
        loadAdminJobs();
        showToast('Deleted ✓', 'success');
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
}
