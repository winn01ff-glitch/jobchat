/* ============================================
   Admin Chat View - Messenger Style
   ============================================ */

var adminChatState = {
    applicant: null,
    subscription: null
};

async function renderAdminChatView(applicantId) {
    var chatArea = document.getElementById('admin-chat-area');
    if (!chatArea) return;
    var t = I18n.t.bind(I18n);

    try {
        adminChatState.applicant = await DB.getApplicant(applicantId);
    } catch(e) {
        chatArea.innerHTML = '<div class="admin-empty-state"><p>Error loading conversation</p></div>';
        return;
    }

    var applicant = adminChatState.applicant;
    if (!applicant) return;
    var initials = applicant.name.charAt(0).toUpperCase();

    chatArea.innerHTML =
        '<div class="chat-header-bar">' +
            '<div class="chat-header-info">' +
                '<div class="chat-avatar">' + initials + '<span class="avatar-status"></span></div>' +
                '<div>' +
                    '<div class="chat-header-name">' + escapeHtml(applicant.name) + '</div>' +
                    '<div class="chat-header-status">📱 ' + escapeHtml(applicant.phone || '') + ' · 🏢 ' +
                        escapeHtml(I18n.t('register.positions.' + applicant.position) || applicant.position) + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
                (window.innerWidth <= 768 ?
                    '<button class="btn-icon" onclick="backToSidebar()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'
                    : '') +
            '</div>' +
        '</div>' +
        '<div id="admin-chat-messages" class="chat-messages">' +
            '<div class="chat-welcome">' +
                '<div class="chat-welcome-icon">' + initials + '</div>' +
                '<h3>' + escapeHtml(applicant.name) + '</h3>' +
                '<p>' + t('admin.conversationStarted') + ' ' + formatDate(applicant.created_at) + '</p>' +
            '</div>' +
        '</div>' +
        '<div class="chat-input-bar">' +
            '<div class="chat-actions">' +
                '<button class="chat-action-btn" onclick="document.getElementById(\'admin-file-input\').click()" title="' + t('chat.attachFile') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>' +
                '</button>' +
                '<button class="chat-action-btn" onclick="document.getElementById(\'admin-image-input\').click()" title="' + t('chat.sendImage') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
                '</button>' +
                '<button class="chat-action-btn" onclick="sendAdminLocation()" title="' + t('chat.sendLocation') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="chat-input-wrapper">' +
                '<textarea id="admin-chat-input" class="chat-input" rows="1" placeholder="' + t('chat.placeholder') + '"></textarea>' +
            '</div>' +
            '<button class="btn-send" onclick="sendAdminMessage()">' +
                '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
            '</button>' +
        '</div>' +
        '<input type="file" id="admin-file-input" multiple hidden>' +
        '<input type="file" id="admin-image-input" accept="image/*" multiple hidden>';

    // Setup handlers
    var chatInput = document.getElementById('admin-chat-input');
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAdminMessage();
            }
        });
    }

    // File handlers
    document.getElementById('admin-file-input').addEventListener('change', function(e) {
        for (var i = 0; i < e.target.files.length; i++) {
            sendAdminFile(e.target.files[i], 'file');
        }
        e.target.value = '';
    });

    document.getElementById('admin-image-input').addEventListener('change', function(e) {
        for (var i = 0; i < e.target.files.length; i++) {
            sendAdminFile(e.target.files[i], 'image');
        }
        e.target.value = '';
    });

    // Load messages
    loadAdminMessages(applicantId);
}

function sendAdminFile(file, type) {
    if (file.size > 10 * 1024 * 1024) {
        showToast(I18n.t('chat.fileTooLarge'), 'error');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({
            type: type,
            data: e.target.result,
            name: file.name,
            size: file.size,
            mimeType: file.type
        });
        var admin = window.adminSession;
        if (!admin || !adminChatState.applicant) return;
        DB.sendMessage(adminChatState.applicant.id, 'admin', admin.profile.display_name, admin.user.id, content);
        appendAdminMessageBubble({
            sender_type: 'admin',
            sender_name: admin.profile.display_name,
            sender_id: admin.user.id,
            content: content,
            created_at: new Date().toISOString()
        });
    };
    reader.readAsDataURL(file);
}

function sendAdminLocation() {
    if (!navigator.geolocation) {
        showToast(I18n.t('chat.locationNotSupported'), 'error');
        return;
    }
    showToast(I18n.t('chat.gettingLocation'), 'info');
    navigator.geolocation.getCurrentPosition(function(pos) {
        var content = JSON.stringify({
            type: 'location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        });
        var admin = window.adminSession;
        if (!admin || !adminChatState.applicant) return;
        DB.sendMessage(adminChatState.applicant.id, 'admin', admin.profile.display_name, admin.user.id, content);
        appendAdminMessageBubble({
            sender_type: 'admin',
            sender_name: admin.profile.display_name,
            sender_id: admin.user.id,
            content: content,
            created_at: new Date().toISOString()
        });
    }, function(err) {
        showToast(I18n.t('chat.locationError'), 'error');
    });
}

async function loadAdminMessages(applicantId) {
    try {
        var messages = await DB.getMessages(applicantId);
        messages.forEach(function(msg) {
            appendAdminMessageBubble(msg);
        });
        scrollAdminToBottom();

        // Mark applicant messages as seen by admin
        await DB.markMessagesAsSeen(applicantId, 'applicant');

        // Unsubscribe old
        if (adminChatState.subscription) {
            DB.unsubscribe(adminChatState.subscription);
        }

        // Subscribe to new messages
        adminChatState.subscription = DB.subscribeToMessages(applicantId, function(msg) {
            var admin = window.adminSession;
            if (admin && msg.sender_type === 'admin' && msg.sender_id === admin.user.id) return;

            appendAdminMessageBubble(msg);
            scrollAdminToBottom();

            // Auto mark applicant messages as seen
            if (msg.sender_type === 'applicant') {
                DB.markMessagesAsSeen(applicantId, 'applicant');
            }

            NotificationManager.showNotification(msg.sender_name, parseMessagePreview(msg.content));
        });
    } catch(e) {
        console.error('Failed to load admin messages:', e);
    }
}

function appendAdminMessageBubble(msg) {
    var container = document.getElementById('admin-chat-messages');
    if (!container) return;

    var admin = window.adminSession;
    var isSent = msg.sender_type === 'admin' && admin && msg.sender_id === admin.user.id;
    var row = document.createElement('div');
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');
    if (msg.id) row.dataset.messageId = msg.id;

    var html = '';
    if (!isSent) {
        html += '<div class="message-avatar">' + (msg.sender_name || 'U').charAt(0).toUpperCase() + '</div>';
    }
    html += '<div class="message-content">';
    if (!isSent) {
        html += '<div class="message-sender">' + escapeHtml(msg.sender_name || '') + '</div>';
    }
    html += renderMessageContent(msg.content, isSent);
    // Time + status
    var timeHtml = '<div class="message-time">' + formatTime(msg.created_at);
    if (isSent) {
        timeHtml += ' ' + getStatusIcon(msg.status || 'sent');
    }
    timeHtml += '</div>';
    html += timeHtml;
    html += '</div>';

    row.innerHTML = html;
    container.appendChild(row);
}

async function sendAdminMessage() {
    var input = document.getElementById('admin-chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    var admin = window.adminSession;
    if (!admin || !adminChatState.applicant) return;

    input.value = '';
    input.style.height = 'auto';

    try {
        await DB.sendMessage(
            adminChatState.applicant.id,
            'admin',
            admin.profile.display_name,
            admin.user.id,
            text
        );
        appendAdminMessageBubble({
            sender_type: 'admin',
            sender_name: admin.profile.display_name,
            sender_id: admin.user.id,
            content: text,
            created_at: new Date().toISOString()
        });
        scrollAdminToBottom();
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
}

function scrollAdminToBottom() {
    var container = document.getElementById('admin-chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

function backToSidebar() {
    document.getElementById('admin-sidebar').classList.remove('hidden-mobile');
    document.getElementById('admin-chat-area').classList.add('hidden-mobile');
}
