/* ============================================
   Chat Page - Messenger Style with File/Location
   ============================================ */

var chatState = {
    applicantId: null,
    applicantName: '',
    subscription: null,
    pendingFiles: [],
    contextMenuMsg: null
};

function renderChat(params) {
    var page = document.getElementById('page-chat');
    var t = I18n.t.bind(I18n);
    chatState.applicantId = params && params[0] ? params[0] : null;

    page.innerHTML = '<div class="chat-container">' +
        '<div id="chat-messages" class="chat-messages" onclick="dismissContextMenu(); blurChatInput(event)">' +
            '<div class="chat-welcome">' +
                '<div class="chat-welcome-icon">💬</div>' +
                '<h3 data-i18n="chat.welcomeTitle">' + t('chat.welcomeTitle') + '</h3>' +
                '<p data-i18n="chat.welcomeMsg">' + t('chat.welcomeMsg') + '</p>' +
            '</div>' +
        '</div>' +
        '<div id="file-preview-bar" class="file-preview-bar hidden"></div>' +
        '<div class="chat-input-bar">' +
            '<div class="chat-actions">' +
                '<button class="chat-action-btn" id="btn-attach" title="' + t('chat.attachFile') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>' +
                '</button>' +
                '<button class="chat-action-btn" id="btn-image" title="' + t('chat.sendImage') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
                '</button>' +
                '<button class="chat-action-btn" id="btn-location" title="' + t('chat.sendLocation') + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="chat-input-wrapper">' +
                '<textarea id="chat-input" class="chat-input" rows="1" placeholder="' + t('chat.placeholder') + '" data-i18n-placeholder="chat.placeholder"></textarea>' +
            '</div>' +
            '<button class="btn-send" id="btn-send" onclick="sendApplicantMessage()">' +
                '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
            '</button>' +
        '</div>' +
        '<input type="file" id="file-input" multiple hidden>' +
        '<input type="file" id="image-input" accept="image/*" multiple hidden>' +
    '</div>' +
    '<div id="msg-context-menu" class="msg-context-menu hidden"></div>';

    setupChatHandlers();
    document.getElementById('btn-back').classList.add('hidden');

    if (chatState.applicantId) {
        loadChatMessages();
    }
}

function blurChatInput(e) {
    // On mobile, tap empty space to dismiss keyboard
    if (e.target.classList.contains('chat-messages') || e.target.closest('.chat-welcome')) {
        var input = document.getElementById('chat-input');
        if (input) input.blur();
    }
}

function handleApplicantLogout() {
    if (chatState.subscription) {
        DB.unsubscribe(chatState.subscription);
        chatState.subscription = null;
    }
    localStorage.removeItem('uphill_session');
    localStorage.removeItem('uphill_email');
    chatState.applicantId = null;
    chatState.applicantName = '';
    Router.navigateTo('landing');
}

function setupChatHandlers() {
    var chatInput = document.getElementById('chat-input');
    var fileInput = document.getElementById('file-input');
    var imageInput = document.getElementById('image-input');

    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        });
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendApplicantMessage();
            }
        });
    }

    document.getElementById('btn-attach').addEventListener('click', function() {
        fileInput.click();
    });
    document.getElementById('btn-image').addEventListener('click', function() {
        imageInput.click();
    });
    document.getElementById('btn-location').addEventListener('click', function() {
        sendLocation();
    });

    fileInput.addEventListener('change', function(e) {
        handleFileSelect(e.target.files, 'file');
        e.target.value = '';
    });
    imageInput.addEventListener('change', function(e) {
        handleFileSelect(e.target.files, 'image');
        e.target.value = '';
    });
}

function handleFileSelect(files, type) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (file.size > 10 * 1024 * 1024) {
            showToast(I18n.t('chat.fileTooLarge'), 'error');
            continue;
        }
        if (type === 'image') sendImageMessage(file);
        else sendFileMessage(file);
    }
}

function sendImageMessage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({ type: 'image', data: e.target.result, name: file.name, size: file.size });
        var session = getApplicantSession();
        if (!session) return;
        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({ sender_type: 'applicant', sender_name: session.name, content: content, created_at: new Date().toISOString() }, true);
    };
    reader.readAsDataURL(file);
}

function sendFileMessage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({ type: 'file', data: e.target.result, name: file.name, size: file.size, mimeType: file.type });
        var session = getApplicantSession();
        if (!session) return;
        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({ sender_type: 'applicant', sender_name: session.name, content: content, created_at: new Date().toISOString() }, true);
    };
    reader.readAsDataURL(file);
}

function sendLocation() {
    if (!navigator.geolocation) {
        showToast(I18n.t('chat.locationNotSupported'), 'error');
        return;
    }
    showToast(I18n.t('chat.gettingLocation'), 'info');
    navigator.geolocation.getCurrentPosition(function(pos) {
        var content = JSON.stringify({ type: 'location', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        var session = getApplicantSession();
        if (!session) return;
        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({ sender_type: 'applicant', sender_name: session.name, content: content, created_at: new Date().toISOString() }, true);
    }, function(err) {
        showToast(I18n.t('chat.locationError'), 'error');
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function getApplicantSession() {
    try { return JSON.parse(localStorage.getItem('uphill_session')); } catch(e) { return null; }
}

// ============ Date Separator ============
var _lastDateLabel = '';
function insertDateSeparatorIfNeeded(container, dateStr) {
    var d = new Date(dateStr);
    var today = new Date();
    var label;
    if (d.toDateString() === today.toDateString()) {
        label = I18n.t('chat.today') || 'Today';
    } else {
        var yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            label = I18n.t('chat.yesterday') || 'Yesterday';
        } else {
            label = d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
        }
    }
    if (label !== _lastDateLabel) {
        _lastDateLabel = label;
        var sep = document.createElement('div');
        sep.className = 'date-separator';
        sep.innerHTML = '<span>' + label + '</span>';
        container.appendChild(sep);
    }
}

async function loadChatMessages() {
    try {
        var messages = await DB.getMessages(chatState.applicantId);
        var container = document.getElementById('chat-messages');
        if (!container) return;

        _lastDateLabel = '';
        messages.forEach(function(msg, idx) {
            insertDateSeparatorIfNeeded(container, msg.created_at);
            var isLast = idx === messages.length - 1;
            appendMessageBubble(msg, false, isLast);
        });
        scrollToBottom();

        await DB.markMessagesAsSeen(chatState.applicantId, 'admin');
        await DB.markMessagesAsDelivered(chatState.applicantId, 'admin');

        if (chatState.subscription) DB.unsubscribe(chatState.subscription);
        chatState.subscription = DB.subscribeToMessages(chatState.applicantId, function(msg) {
            var session = getApplicantSession();
            if (msg.sender_type === 'applicant' && session && msg.sender_id === session.id) return;

            insertDateSeparatorIfNeeded(document.getElementById('chat-messages'), msg.created_at);
            // Hide status on previous last sent message
            hidePreviousLastStatus();
            appendMessageBubble(msg, false, true);
            scrollToBottom();

            if (msg.sender_type === 'admin') {
                DB.markMessagesAsSeen(chatState.applicantId, 'admin');
            }
            NotificationManager.showNotification(msg.sender_name, parseMessageContent(msg.content));
        });
    } catch(e) {
        console.error('Failed to load messages:', e);
    }
}

function hidePreviousLastStatus() {
    var rows = document.querySelectorAll('.message-row.sent .message-status-wrap');
    rows.forEach(function(el) { el.style.display = 'none'; });
}

function parseMessageContent(content) {
    try {
        var parsed = JSON.parse(content);
        if (parsed.type === 'image') return '📷 ' + I18n.t('chat.image');
        if (parsed.type === 'file') return '📎 ' + parsed.name;
        if (parsed.type === 'location') return '📍 ' + I18n.t('chat.location');
        return content;
    } catch(e) { return content; }
}

function appendMessageBubble(msg, isNewSent, isLast) {
    var container = document.getElementById('chat-messages');
    if (!container) return;

    var isSent = msg.sender_type === 'applicant';
    var row = document.createElement('div');
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');
    if (msg.id) row.dataset.messageId = msg.id;

    // Long press / right-click for context menu
    var pressTimer;
    row.addEventListener('contextmenu', function(e) { e.preventDefault(); showContextMenu(e, msg, row); });
    row.addEventListener('touchstart', function(e) {
        pressTimer = setTimeout(function() { showContextMenu(e.touches[0], msg, row); }, 500);
    }, { passive: true });
    row.addEventListener('touchend', function() { clearTimeout(pressTimer); }, { passive: true });
    row.addEventListener('touchmove', function() { clearTimeout(pressTimer); }, { passive: true });

    var bubbleHtml = '';
    if (!isSent) {
        bubbleHtml += '<div class="message-avatar">' + (msg.sender_name || 'A').charAt(0).toUpperCase() + '</div>';
    }
    bubbleHtml += '<div class="message-content">';
    if (!isSent && msg.sender_name) {
        bubbleHtml += '<div class="message-sender">' + escapeHtml(msg.sender_name) + '</div>';
    }

    var contentHtml = renderMessageContent(msg.content, isSent);
    bubbleHtml += contentHtml;

    // Time — hidden by default, toggle on click
    var timeHtml = '<div class="message-time msg-time-toggle" style="display:none">' + formatTime(msg.created_at);
    timeHtml += '</div>';
    bubbleHtml += timeHtml;

    // Status — only on last sent message
    if (isSent && isLast) {
        bubbleHtml += '<div class="message-status-wrap" style="text-align:right;padding:0 12px">' + getStatusIcon(msg.status || 'sent') + '</div>';
    }

    bubbleHtml += '</div>';
    row.innerHTML = bubbleHtml;

    // Click to toggle timestamp
    row.addEventListener('click', function(e) {
        if (e.target.closest('.message-file') || e.target.closest('.message-image') || e.target.closest('.message-location')) return;
        var timeEl = row.querySelector('.msg-time-toggle');
        if (timeEl) {
            timeEl.style.display = timeEl.style.display === 'none' ? '' : 'none';
        }
    });

    container.appendChild(row);
    if (isNewSent) {
        hidePreviousLastStatus();
        // Add status to the new sent message
        var content = row.querySelector('.message-content');
        if (content && isSent) {
            var statusDiv = document.createElement('div');
            statusDiv.className = 'message-status-wrap';
            statusDiv.style.textAlign = 'right';
            statusDiv.style.padding = '0 12px';
            statusDiv.innerHTML = getStatusIcon('sent');
            content.appendChild(statusDiv);
        }
        scrollToBottom();
    }
}

// ============ Context Menu ============
function showContextMenu(e, msg, row) {
    dismissContextMenu();
    var menu = document.getElementById('msg-context-menu');
    if (!menu) return;
    var t = I18n.t.bind(I18n);

    var items = '';
    // Copy
    items += '<button onclick="copyMessageText(\'' + (msg.id || '') + '\')">📋 ' + (t('chat.copy') || 'Copy') + '</button>';
    // Delete (only own messages)
    var session = getApplicantSession();
    if (msg.sender_type === 'applicant' && session && msg.id) {
        items += '<button onclick="deleteMessageById(\'' + msg.id + '\')" class="ctx-danger">🗑 ' + (t('chat.deleteMsg') || 'Delete') + '</button>';
    }

    menu.innerHTML = items;
    menu.classList.remove('hidden');

    // Position near touch/click
    var x = e.clientX || e.pageX || 100;
    var y = e.clientY || e.pageY || 100;
    menu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';

    chatState.contextMenuMsg = msg;
    // Store text content for copy
    menu.dataset.content = msg.content;
}

function dismissContextMenu() {
    var menu = document.getElementById('msg-context-menu');
    if (menu) { menu.classList.add('hidden'); menu.innerHTML = ''; }
}

function copyMessageText(msgId) {
    dismissContextMenu();
    var msg = chatState.contextMenuMsg;
    if (!msg) return;
    var text = msg.content;
    try {
        var parsed = JSON.parse(text);
        if (parsed.type === 'location') text = parsed.lat + ', ' + parsed.lng;
        else if (parsed.type === 'file') text = parsed.name;
        else if (parsed.type === 'image') text = parsed.name;
    } catch(e) {}
    navigator.clipboard.writeText(text).then(function() {
        showToast(I18n.t('chat.copied') || 'Copied!', 'success');
    }).catch(function() {});
}

async function deleteMessageById(msgId) {
    dismissContextMenu();
    try {
        await DB.deleteMessage(msgId);
        var row = document.querySelector('[data-message-id="' + msgId + '"]');
        if (row) row.remove();
        showToast(I18n.t('chat.deleted') || 'Deleted', 'success');
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
}

function getStatusIcon(status) {
    switch(status) {
        case 'seen': return '<span class="msg-status seen" title="Seen">👁</span>';
        case 'delivered': return '<span class="msg-status delivered" title="Delivered">✓✓</span>';
        case 'sent': default: return '<span class="msg-status sent-icon" title="Sent">✓</span>';
    }
}

function renderMessageContent(content, isSent) {
    try {
        var parsed = JSON.parse(content);
        if (parsed.type === 'image') {
            return '<img class="message-image" src="' + parsed.data + '" alt="' + escapeHtml(parsed.name) + '" onclick="openLightbox(this.src)">';
        }
        if (parsed.type === 'file') {
            var sizeStr = formatFileSize(parsed.size);
            return '<div class="message-file" onclick="downloadFile(\'' + parsed.data + '\', \'' + escapeHtml(parsed.name) + '\')">' +
                '<span class="message-file-icon">📄</span>' +
                '<div><div class="message-file-name">' + escapeHtml(parsed.name) + '</div>' +
                '<div class="message-file-size">' + sizeStr + '</div></div></div>';
        }
        if (parsed.type === 'location') {
            var mapUrl = 'https://www.google.com/maps?q=' + parsed.lat + ',' + parsed.lng;
            return '<a href="' + mapUrl + '" target="_blank" class="message-location" style="text-decoration:none;color:inherit">' +
                '<div class="message-location-map">📍</div>' +
                '<div class="message-location-text">' + I18n.t('chat.locationShared') + '<br>' +
                '<small>' + parsed.lat.toFixed(4) + ', ' + parsed.lng.toFixed(4) + '</small></div></a>';
        }
    } catch(e) {}
    return '<div class="message-bubble">' + escapeHtml(content) + '</div>';
}

function openLightbox(src) {
    var lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = '<img src="' + src + '">';
    lightbox.onclick = function() { lightbox.remove(); };
    document.body.appendChild(lightbox);
}

function downloadFile(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function sendApplicantMessage() {
    var input = document.getElementById('chat-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    var session = getApplicantSession();
    if (!session) return;

    input.value = '';
    input.style.height = 'auto';

    try {
        await DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, text);
        insertDateSeparatorIfNeeded(document.getElementById('chat-messages'), new Date().toISOString());
        appendMessageBubble({
            sender_type: 'applicant', sender_name: session.name,
            content: text, created_at: new Date().toISOString()
        }, true, true);
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
}

function scrollToBottom() {
    var container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

// Close context menu on scroll or outside click
document.addEventListener('click', function(e) {
    if (!e.target.closest('.msg-context-menu')) dismissContextMenu();
});
