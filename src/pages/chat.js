/* ============================================
   Chat Page - Messenger Style with File/Location
   ============================================ */

var chatState = {
    applicantId: null,
    applicantName: '',
    subscription: null,
    pendingFiles: []
};

function renderChat(params) {
    var page = document.getElementById('page-chat');
    var t = I18n.t.bind(I18n);
    chatState.applicantId = params && params[0] ? params[0] : null;

    page.innerHTML = '<div class="chat-container">' +
        '<div id="chat-messages" class="chat-messages">' +
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
    '</div>';

    // Setup handlers
    setupChatHandlers();

    // Hide back button on chat page (use logout instead)
    document.getElementById('btn-back').classList.add('hidden');

    // Load existing messages
    if (chatState.applicantId) {
        loadChatMessages();
    }
}

function handleApplicantLogout() {
    // Unsubscribe from realtime
    if (chatState.subscription) {
        DB.unsubscribe(chatState.subscription);
        chatState.subscription = null;
    }
    // Clear session data
    localStorage.removeItem('uphill_session');
    localStorage.removeItem('uphill_email');
    chatState.applicantId = null;
    chatState.applicantName = '';
    // Navigate to landing
    Router.navigateTo('landing');
}

function setupChatHandlers() {
    var chatInput = document.getElementById('chat-input');
    var fileInput = document.getElementById('file-input');
    var imageInput = document.getElementById('image-input');

    // Auto-resize textarea
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

    // File attach
    document.getElementById('btn-attach').addEventListener('click', function() {
        fileInput.click();
    });

    // Image attach
    document.getElementById('btn-image').addEventListener('click', function() {
        imageInput.click();
    });

    // Location
    document.getElementById('btn-location').addEventListener('click', function() {
        sendLocation();
    });

    // File input change
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

        if (type === 'image') {
            // Send image directly
            sendImageMessage(file);
        } else {
            sendFileMessage(file);
        }
    }
}

function sendImageMessage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({
            type: 'image',
            data: e.target.result,
            name: file.name,
            size: file.size
        });

        var session = getApplicantSession();
        if (!session) return;

        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({
            sender_type: 'applicant',
            sender_name: session.name,
            content: content,
            created_at: new Date().toISOString()
        });
    };
    reader.readAsDataURL(file);
}

function sendFileMessage(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var content = JSON.stringify({
            type: 'file',
            data: e.target.result,
            name: file.name,
            size: file.size,
            mimeType: file.type
        });

        var session = getApplicantSession();
        if (!session) return;

        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({
            sender_type: 'applicant',
            sender_name: session.name,
            content: content,
            created_at: new Date().toISOString()
        });
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
        var content = JSON.stringify({
            type: 'location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
        });

        var session = getApplicantSession();
        if (!session) return;

        DB.sendMessage(chatState.applicantId, 'applicant', session.name || 'Applicant', session.id, content);
        appendMessageBubble({
            sender_type: 'applicant',
            sender_name: session.name,
            content: content,
            created_at: new Date().toISOString()
        });
    }, function(err) {
        showToast(I18n.t('chat.locationError'), 'error');
    }, { enableHighAccuracy: true, timeout: 10000 });
}

function getApplicantSession() {
    try {
        return JSON.parse(localStorage.getItem('uphill_session'));
    } catch(e) { return null; }
}

async function loadChatMessages() {
    try {
        var messages = await DB.getMessages(chatState.applicantId);
        var container = document.getElementById('chat-messages');
        if (!container) return;

        // Keep welcome, add messages after
        messages.forEach(function(msg) {
            appendMessageBubble(msg);
        });

        scrollToBottom();

        // Mark admin messages as seen by applicant
        await DB.markMessagesAsSeen(chatState.applicantId, 'admin');
        // Mark admin messages as delivered too
        await DB.markMessagesAsDelivered(chatState.applicantId, 'admin');

        // Subscribe to new messages
        if (chatState.subscription) {
            DB.unsubscribe(chatState.subscription);
        }
        chatState.subscription = DB.subscribeToMessages(chatState.applicantId, function(msg) {
            var session = getApplicantSession();
            // Don't show own messages
            if (msg.sender_type === 'applicant' && session && msg.sender_id === session.id) return;

            appendMessageBubble(msg);
            scrollToBottom();

            // Auto mark admin messages as seen since chat is open
            if (msg.sender_type === 'admin') {
                DB.markMessagesAsSeen(chatState.applicantId, 'admin');
            }

            NotificationManager.showNotification(
                msg.sender_name,
                parseMessageContent(msg.content)
            );
        });
    } catch(e) {
        console.error('Failed to load messages:', e);
    }
}

function parseMessageContent(content) {
    try {
        var parsed = JSON.parse(content);
        if (parsed.type === 'image') return '📷 ' + I18n.t('chat.image');
        if (parsed.type === 'file') return '📎 ' + parsed.name;
        if (parsed.type === 'location') return '📍 ' + I18n.t('chat.location');
        return content;
    } catch(e) {
        return content;
    }
}

function appendMessageBubble(msg) {
    var container = document.getElementById('chat-messages');
    if (!container) return;

    var isSent = msg.sender_type === 'applicant';
    var row = document.createElement('div');
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');
    if (msg.id) row.dataset.messageId = msg.id;

    var bubbleHtml = '';
    if (!isSent) {
        bubbleHtml += '<div class="message-avatar">' + (msg.sender_name || 'A').charAt(0).toUpperCase() + '</div>';
    }

    bubbleHtml += '<div class="message-content">';
    if (!isSent && msg.sender_name) {
        bubbleHtml += '<div class="message-sender">' + escapeHtml(msg.sender_name) + '</div>';
    }

    // Parse content for special types
    var contentHtml = renderMessageContent(msg.content, isSent);
    bubbleHtml += contentHtml;

    // Time + status
    var timeHtml = '<div class="message-time">' + formatTime(msg.created_at);
    if (isSent) {
        timeHtml += ' ' + getStatusIcon(msg.status || 'sent');
    }
    timeHtml += '</div>';
    bubbleHtml += timeHtml;
    bubbleHtml += '</div>';

    row.innerHTML = bubbleHtml;
    container.appendChild(row);
    scrollToBottom();
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

    // Regular text
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
        appendMessageBubble({
            sender_type: 'applicant',
            sender_name: session.name,
            content: text,
            created_at: new Date().toISOString()
        });
    } catch(e) {
        showToast(I18n.t('common.error'), 'error');
    }
}

function scrollToBottom() {
    var container = document.getElementById('chat-messages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}
