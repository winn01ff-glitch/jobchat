/* ============================================
   Admin Chat View - Messenger Style
   ============================================ */

var adminChatState = {
    applicant: null,
    subscription: null,
    contextMenuMsg: null
};

async function renderAdminChatView(applicantId) {
    var chatArea = document.getElementById('admin-chat-area');
    if (!chatArea) return;
    var t = I18n.t.bind(I18n);

    try {
        adminChatState.applicant = await DB.getApplicant(applicantId);
    } catch(e) {
        chatArea.innerHTML = '<div class="admin-empty-state"><p>' + I18n.t('common.error') + '</p></div>';
        return;
    }

    var applicant = adminChatState.applicant;
    if (!applicant) return;
    var initials = applicant.name.charAt(0).toUpperCase();
    var phoneInfo = applicant.phone ? '📱 ' + escapeHtml(applicant.phone) + ' · ' : '';

    chatArea.innerHTML =
        '<div class="chat-header-bar">' +
            '<div class="chat-header-info">' +
                '<div class="chat-avatar">' + initials + '</div>' +
                '<div>' +
                    '<div class="chat-header-name">' + escapeHtml(applicant.name) + '</div>' +
                    '<div class="chat-header-status">' + phoneInfo +
                        '🏢 ' + escapeHtml(I18n.t('register.positions.' + applicant.position) || applicant.position) + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
                (window.innerWidth <= 768 ?
                    '<button class="btn-icon" onclick="backToSidebar()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'
                    : '') +
            '</div>' +
        '</div>' +
        '<div id="admin-chat-messages" class="chat-messages" onclick="dismissAdminContextMenu(); blurAdminChatInput(event)">' +
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
        '<input type="file" id="admin-image-input" accept="image/*" multiple hidden>' +
        '<div id="admin-msg-context-menu" class="msg-context-menu hidden"></div>';

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

    document.getElementById('admin-file-input').addEventListener('change', function(e) {
        for (var i = 0; i < e.target.files.length; i++) sendAdminFile(e.target.files[i], 'file');
        e.target.value = '';
    });
    document.getElementById('admin-image-input').addEventListener('change', function(e) {
        for (var i = 0; i < e.target.files.length; i++) sendAdminFile(e.target.files[i], 'image');
        e.target.value = '';
    });

    loadAdminMessages(applicantId);
}

function blurAdminChatInput(e) {
    if (e.target.classList.contains('chat-messages') || e.target.closest('.chat-welcome')) {
        var input = document.getElementById('admin-chat-input');
        if (input) input.blur();
    }
}

function sendAdminFile(file, type) {
    if (file.size > 10 * 1024 * 1024) { showToast(I18n.t('chat.fileTooLarge'), 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({ type: type, data: e.target.result, name: file.name, size: file.size, mimeType: file.type });
        var admin = window.adminSession;
        if (!admin || !adminChatState.applicant) return;
        DB.sendMessage(adminChatState.applicant.id, 'admin', admin.profile.display_name, admin.user.id, content);
        appendAdminMessageBubble({ sender_type: 'admin', sender_name: admin.profile.display_name, sender_id: admin.user.id, content: content, created_at: new Date().toISOString() }, true, true);
    };
    reader.readAsDataURL(file);
}

function sendAdminLocation() {
    if (!navigator.geolocation) { showToast(I18n.t('chat.locationNotSupported'), 'error'); return; }
    showToast(I18n.t('chat.gettingLocation'), 'info');
    navigator.geolocation.getCurrentPosition(function(pos) {
        var content = JSON.stringify({ type: 'location', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        var admin = window.adminSession;
        if (!admin || !adminChatState.applicant) return;
        DB.sendMessage(adminChatState.applicant.id, 'admin', admin.profile.display_name, admin.user.id, content);
        appendAdminMessageBubble({ sender_type: 'admin', sender_name: admin.profile.display_name, sender_id: admin.user.id, content: content, created_at: new Date().toISOString() }, true, true);
    }, function() { showToast(I18n.t('chat.locationError'), 'error'); });
}

var _adminLastDateLabel = '';
function insertAdminDateSeparator(container, dateStr) {
    var d = new Date(dateStr);
    var today = new Date();
    var label;
    if (d.toDateString() === today.toDateString()) label = I18n.t('chat.today') || 'Today';
    else {
        var yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) label = I18n.t('chat.yesterday') || 'Yesterday';
        else label = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
    }
    if (label !== _adminLastDateLabel) {
        _adminLastDateLabel = label;
        var sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = '<span>' + label + '</span>';
        container.appendChild(sep);
    }
}

async function loadAdminMessages(applicantId) {
    try {
        var messages = await DB.getMessages(applicantId);
        var container = document.getElementById('admin-chat-messages');
        if (!container) return;

        _adminLastDateLabel = '';
        messages.forEach(function(msg, idx) {
            insertAdminDateSeparator(container, msg.created_at);
            appendAdminMessageBubble(msg, false, idx === messages.length - 1);
        });
        scrollAdminToBottom();

        await DB.markMessagesAsSeen(applicantId, 'applicant');

        if (adminChatState.subscription) DB.unsubscribe(adminChatState.subscription);
        adminChatState.subscription = DB.subscribeToMessages(applicantId, function(msg) {
            var admin = window.adminSession;
            if (admin && msg.sender_type === 'admin' && msg.sender_id === admin.user.id) return;

            insertAdminDateSeparator(document.getElementById('admin-chat-messages'), msg.created_at);
            hideAdminPreviousLastStatus();
            appendAdminMessageBubble(msg, false, true);
            scrollAdminToBottom();

            if (msg.sender_type === 'applicant') DB.markMessagesAsSeen(applicantId, 'applicant');
            NotificationManager.showNotification(msg.sender_name, parseMessagePreview(msg.content));
        });
    } catch(e) {
        console.error('Failed to load admin messages:', e);
    }
}

function hideAdminPreviousLastStatus() {
    var rows = document.querySelectorAll('#admin-chat-messages .message-row.sent .message-status-wrap');
    rows.forEach(function(el) { el.style.display = 'none'; });
}

function appendAdminMessageBubble(msg, isNewSent, isLast) {
    var container = document.getElementById('admin-chat-messages');
    if (!container) return;

    var admin = window.adminSession;
    var isSent = msg.sender_type === 'admin' && admin && msg.sender_id === admin.user.id;
    var row = document.createElement('div');
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');
    if (msg.id) row.dataset.messageId = msg.id;

    // Long press / right-click context menu
    var pressTimer;
    row.addEventListener('contextmenu', function(e) { e.preventDefault(); showAdminContextMenu(e, msg, row); });
    row.addEventListener('touchstart', function(e) {
        pressTimer = setTimeout(function() { showAdminContextMenu(e.touches[0], msg, row); }, 500);
    }, { passive: true });
    row.addEventListener('touchend', function() { clearTimeout(pressTimer); }, { passive: true });
    row.addEventListener('touchmove', function() { clearTimeout(pressTimer); }, { passive: true });

    var html = '';
    if (!isSent) {
        html += '<div class="message-avatar">' + (msg.sender_name || 'U').charAt(0).toUpperCase() + '</div>';
    }
    html += '<div class="message-content">';
    if (!isSent) {
        html += '<div class="message-sender">' + escapeHtml(msg.sender_name || '') + '</div>';
    }
    html += renderMessageContent(msg.content, isSent);

    // Time — hidden, toggle on click
    html += '<div class="message-time msg-time-toggle" style="display:none">' + formatTime(msg.created_at) + '</div>';

    // Status on last sent only
    if (isSent && isLast) {
        html += '<div class="message-status-wrap" style="text-align:right;padding:0 12px">' + getStatusIcon(msg.status || 'sent') + '</div>';
    }
    html += '</div>';

    row.innerHTML = html;

    row.addEventListener('click', function(e) {
        if (e.target.closest('.message-file') || e.target.closest('.message-image') || e.target.closest('.message-location')) return;
        var timeEl = row.querySelector('.msg-time-toggle');
        if (timeEl) timeEl.style.display = timeEl.style.display === 'none' ? '' : 'none';
    });

    container.appendChild(row);
    if (isNewSent) {
        hideAdminPreviousLastStatus();
        var content = row.querySelector('.message-content');
        if (content && isSent) {
            var statusDiv = document.createElement('div');
            statusDiv.className = 'message-status-wrap';
            statusDiv.style.textAlign = 'right';
            statusDiv.style.padding = '0 12px';
            statusDiv.innerHTML = getStatusIcon('sent');
            content.appendChild(statusDiv);
        }
        scrollAdminToBottom();
    }
}

// ============ Admin Context Menu ============
function showAdminContextMenu(e, msg, row) {
    dismissAdminContextMenu();
    var menu = document.getElementById('admin-msg-context-menu');
    if (!menu) return;
    var t = I18n.t.bind(I18n);

    var items = '<button onclick="copyAdminMessageText()">' + '📋 ' + (t('chat.copy') || 'Copy') + '</button>';
    if (msg.id) {
        items += '<button onclick="deleteAdminMessageById(\'' + msg.id + '\')" class="ctx-danger">' + '🗑 ' + (t('chat.deleteMsg') || 'Delete') + '</button>';
    }

    menu.innerHTML = items;
    menu.classList.remove('hidden');
    var x = e.clientX || e.pageX || 100;
    var y = e.clientY || e.pageY || 100;
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';
    adminChatState.contextMenuMsg = msg;
}

function dismissAdminContextMenu() {
    var menu = document.getElementById('admin-msg-context-menu');
    if (menu) { menu.classList.add('hidden'); menu.innerHTML = ''; }
}

function copyAdminMessageText() {
    dismissAdminContextMenu();
    var msg = adminChatState.contextMenuMsg;
    if (!msg) return;
    var text = msg.content;
    try {
        var parsed = JSON.parse(text);
        if (parsed.type === 'location') text = parsed.lat + ', ' + parsed.lng;
        else if (parsed.type === 'file' || parsed.type === 'image') text = parsed.name;
    } catch(e) {}
    navigator.clipboard.writeText(text).then(function() {
        showToast(I18n.t('chat.copied') || 'Copied!', 'success');
    }).catch(function() {});
}

async function deleteAdminMessageById(msgId) {
    dismissAdminContextMenu();
    try {
        await DB.deleteMessage(msgId);
        var row = document.querySelector('#admin-chat-messages [data-message-id="' + msgId + '"]');
        if (row) row.remove();
        showToast(I18n.t('chat.deleted') || 'Deleted', 'success');
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
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
        await DB.sendMessage(adminChatState.applicant.id, 'admin', admin.profile.display_name, admin.user.id, text);
        insertAdminDateSeparator(document.getElementById('admin-chat-messages'), new Date().toISOString());
        appendAdminMessageBubble({
            sender_type: 'admin', sender_name: admin.profile.display_name,
            sender_id: admin.user.id, content: text, created_at: new Date().toISOString()
        }, true, true);
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
