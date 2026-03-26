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
    editingJob: null
};

function renderAdminDashboard() {
    var page = document.getElementById('page-admin-dashboard');
    var t = I18n.t.bind(I18n);

    document.getElementById('btn-back').classList.add('hidden');

    page.innerHTML = '<div class="admin-container">' +
        '<div class="admin-sidebar" id="admin-sidebar">' +
            '<div class="sidebar-header">' +
                '<h2 class="sidebar-title" data-i18n="admin.chats">' + t('admin.chats') + '</h2>' +
            '</div>' +
            '<div class="admin-tab-bar">' +
                '<button class="admin-tab active" data-tab="chats" onclick="switchAdminTab(\'chats\')">' +
                    '💬 ' + t('admin.chats') +
                '</button>' +
                '<button class="admin-tab" data-tab="jobs" onclick="switchAdminTab(\'jobs\')">' +
                    '📝 ' + t('admin.jobPosts') +
                '</button>' +
            '</div>' +
            '<div id="tab-content-chats">' +
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
            '<div id="tab-content-jobs" class="hidden">' +
                '<button class="btn-add-job" onclick="openJobForm()">+ ' + t('admin.createJob') + '</button>' +
                '<div class="job-post-list" id="job-post-list"></div>' +
            '</div>' +
        '</div>' +
        '<div class="admin-chat-area" id="admin-chat-area">' +
            '<div class="admin-empty-state">' +
                '<div class="admin-empty-icon">💬</div>' +
                '<p data-i18n="admin.selectConversation">' + t('admin.selectConversation') + '</p>' +
            '</div>' +
        '</div>' +
        /* Settings Modal */
        '<div id="admin-settings-modal" class="settings-modal hidden">' +
            '<div class="settings-overlay" onclick="closeAdminSettings()"></div>' +
            '<div class="settings-card">' +
                '<h3 style="margin:0 0 16px;font-size:18px">⚙️ Settings</h3>' +
                '<div style="text-align:center;margin-bottom:16px">' +
                    '<div id="settings-avatar-preview" class="settings-avatar" onclick="document.getElementById(\'avatar-input\').click()">' +
                        getAdminAvatar() +
                    '</div>' +
                    '<p style="font-size:var(--font-xs);color:var(--text-muted);margin:6px 0 0">Click to change avatar</p>' +
                    '<input type="file" id="avatar-input" accept="image/*" hidden onchange="handleAvatarChange(event)">' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">Display Name</label>' +
                    '<input type="text" class="form-input" id="settings-display-name" value="' + (window.adminSession ? escapeHtml(window.adminSession.profile.display_name) : '') + '">' +
                '</div>' +
                '<hr style="border:none;border-top:1px solid var(--border-light);margin:12px 0">' +
                '<div class="form-group" style="margin-bottom:12px">' +
                    '<label class="form-label">🔑 New Password</label>' +
                    '<div style="position:relative">' +
                        '<input type="password" class="form-input" id="settings-new-password" placeholder="Leave blank to keep current" style="padding-right:40px">' +
                        '<button type="button" onclick="toggleSettingsPw()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted)">👁️</button>' +
                    '</div>' +
                '</div>' +
                '<div class="form-group" style="margin-bottom:16px">' +
                    '<label class="form-label">Confirm Password</label>' +
                    '<input type="password" class="form-input" id="settings-confirm-password" placeholder="Confirm new password">' +
                '</div>' +
                '<div style="display:flex;gap:8px;justify-content:flex-end">' +
                    '<button onclick="closeAdminSettings()" style="padding:8px 20px;border:1px solid var(--border);border-radius:8px;background:white;cursor:pointer">Cancel</button>' +
                    '<button onclick="saveAdminSettings()" style="padding:8px 20px;border:none;border-radius:8px;background:var(--primary);color:white;cursor:pointer;font-weight:600">Save</button>' +
                '</div>' +
                '<hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0 12px">' +
                '<button onclick="handleAdminLogout()" style="width:100%;padding:10px;border:1px solid var(--error);border-radius:8px;background:rgba(240,40,73,0.06);color:var(--error);cursor:pointer;font-weight:600;font-family:var(--font-family);font-size:var(--font-sm);transition:var(--transition-fast)" onmouseover="this.style.background=\'rgba(240,40,73,0.12)\'" onmouseout="this.style.background=\'rgba(240,40,73,0.06)\'">' +
                    '🚪 ' + t('admin.logout') +
                '</button>' +
            '</div>' +
        '</div>' +
    '</div>';

    loadApplicants();
    loadAdminJobs();
    subscribeToUpdates();
    showAdminHeaderControls();
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
        hideAdminHeaderControls();
        Router.navigateTo('landing');
    } catch(e) {
        console.error('Logout failed:', e);
    }
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
    var newPw = document.getElementById('settings-new-password');
    var confirmPw = document.getElementById('settings-confirm-password');

    var newName = nameInput ? nameInput.value.trim() : '';
    var newAvatar = preview ? preview.dataset.newAvatar || '' : '';
    var password = newPw ? newPw.value : '';
    var confirm = confirmPw ? confirmPw.value : '';

    if (!newName) {
        showToast('Name cannot be empty', 'error');
        return;
    }

    if (password && password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    if (password && password.length < 4) {
        showToast('Password must be at least 4 characters', 'error');
        return;
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
    showToast('Settings saved ✓', 'success');
    renderAdminDashboard();
}

function toggleSettingsPw() {
    var pw = document.getElementById('settings-new-password');
    var btn = pw.parentElement.querySelector('button');
    if (pw.type === 'password') {
        pw.type = 'text';
        btn.textContent = '🙈';
    } else {
        pw.type = 'password';
        btn.textContent = '👁️';
    }
}

// ============ Tab Switching ============

function switchAdminTab(tab) {
    dashboardState.activeTab = tab;
    document.querySelectorAll('.admin-tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    var chatsContent = document.getElementById('tab-content-chats');
    var jobsContent = document.getElementById('tab-content-jobs');
    if (chatsContent) chatsContent.classList.toggle('hidden', tab !== 'chats');
    if (jobsContent) jobsContent.classList.toggle('hidden', tab !== 'jobs');
    if (tab === 'jobs') {
        loadAdminJobs();
        renderJobPreviewPanel();
    } else {
        // Reset right panel to chat empty state
        var chatArea = document.getElementById('admin-chat-area');
        if (chatArea && !dashboardState.selectedId) {
            var t = I18n.t.bind(I18n);
            chatArea.innerHTML = '<div class="admin-empty-state">' +
                '<div class="admin-empty-icon">💬</div>' +
                '<p data-i18n="admin.selectConversation">' + t('admin.selectConversation') + '</p>' +
            '</div>';
        }
    }
}

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
    var publishedJobs = dashboardState.jobs.filter(function(j) { return j.status === 'published'; });
    var draftJobs = dashboardState.jobs.filter(function(j) { return j.status !== 'published'; });

    if (dashboardState.jobs.length === 0) {
        chatArea.innerHTML = '<div class="admin-empty-state">' +
            '<div class="admin-empty-icon">📋</div>' +
            '<p>' + t('admin.noJobPosts') + '</p>' +
        '</div>';
        return;
    }

    var html = '<div class="job-preview-panel">';
    html += '<h3 class="job-preview-title">📝 ' + t('admin.jobPosts') + '</h3>';

    if (publishedJobs.length > 0) {
        html += '<div class="job-preview-section">';
        html += '<h4 class="job-preview-label">✅ Published (' + publishedJobs.length + ')</h4>';
        publishedJobs.forEach(function(job) {
            var posLabel = t('register.positions.' + job.position) || job.position || '';
            html += '<div class="job-preview-card published" onclick="editJob(\'' + job.id + '\')">'+
                '<div class="job-preview-card-title">' + escapeHtml(job.title) + '</div>' +
                '<div class="job-preview-card-meta">' +
                    (posLabel ? '🏢 ' + escapeHtml(posLabel) : '') +
                    (job.salary ? ' · 💰 ' + escapeHtml(job.salary) : '') +
                    (job.location ? ' · 📍 ' + escapeHtml(job.location) : '') +
                '</div>' +
                '<div class="job-preview-card-content">' + escapeHtml(job.content || '').substring(0, 120) + (job.content && job.content.length > 120 ? '...' : '') + '</div>' +
            '</div>';
        });
        html += '</div>';
    }

    if (draftJobs.length > 0) {
        html += '<div class="job-preview-section">';
        html += '<h4 class="job-preview-label">📝 Drafts (' + draftJobs.length + ')</h4>';
        draftJobs.forEach(function(job) {
            html += '<div class="job-preview-card draft" onclick="editJob(\'' + job.id + '\')">'+
                '<div class="job-preview-card-title">' + escapeHtml(job.title) + '</div>' +
                '<div class="job-preview-card-content">' + escapeHtml(job.content || '').substring(0, 80) + '...</div>' +
            '</div>';
        });
        html += '</div>';
    }

    html += '</div>';
    chatArea.innerHTML = html;
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
    dashboardState.jobs.forEach(function(job) {
        var item = document.createElement('div');
        item.className = 'job-post-item';
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
                '<button onclick="editJob(\'' + job.id + '\')">' + t('admin.editJob') + '</button>' +
                '<button class="btn-delete" onclick="deleteJob(\'' + job.id + '\')">' + t('admin.deleteJob') + '</button>' +
            '</div>';
        list.appendChild(item);
    });
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
