/* ============================================
   Admin Chat View - Messenger Style
   ============================================ */

var adminChatState = {
    applicant: null,
    subscription: null,
    contextMenuMsg: null,
    offset: 0,
    hasMore: true,
    isLoading: false
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
                (window.innerWidth <= 768 ?
                    '<button class="btn-icon" onclick="backToSidebar()" style="margin-right:-4px;margin-left:-8px;color:var(--messenger-blue);padding:0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>'
                    : '<button class="btn-icon sidebar-toggle-btn" onclick="toggleSidebar()" title="Toggle Sidebar" style="margin-right:12px;color:var(--text-muted);padding:4px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg></button>') +
                '<div class="chat-avatar">' + initials + '</div>' +
                '<div>' +
                    '<div class="chat-header-name">' + escapeHtml(applicant.name) + '</div>' +
                    '<div class="chat-header-status">' + phoneInfo +
                        (applicant.position ? '🏢 ' + escapeHtml(I18n.t('register.positions.' + applicant.position) || applicant.position) : '') + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:6px">' +
                '<button class="btn-icon" onclick="deleteCurrentConversation()" title="' + (I18n.t('common.delete') || 'Delete') + '" style="color:var(--error)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>' +
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
            '<div class="chat-input-wrapper" style="flex:1; display:flex; align-items:center; background:var(--bg-input); border-radius:20px; padding-right:4px">' +
                '<textarea id="admin-chat-input" class="chat-input" rows="1" placeholder="' + t('chat.placeholder') + '" style="background:transparent; margin:0; flex:1"></textarea>' +
                '<button class="emoji-toggle-btn" onclick="EmojiPicker.toggle(\'admin-chat-input\', this)">😊</button>' +
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
        adminChatState.offset = 0;
        adminChatState.hasMore = true;
        var messages = await DB.getMessages(applicantId, adminChatState.offset, 20);
        var container = document.getElementById('admin-chat-messages');
        if (!container) return;

        container.innerHTML = '';
        if (messages.length < 20) adminChatState.hasMore = false;

        if (adminChatState.hasMore) {
            var loadMoreBtn = document.createElement('div');
            loadMoreBtn.id = 'admin-load-more-btn';
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.innerHTML = '<button onclick="loadMoreAdminMessages()" style="background:none;border:none;color:var(--messenger-blue);cursor:pointer;font-size:14px;padding:8px">↑ <span data-i18n="chat.loadMore">' + (I18n.t('chat.loadMore') || 'Tải thêm tin nhắn cũ') + '</span></button>';
            loadMoreBtn.style.textAlign = 'center';
            container.appendChild(loadMoreBtn);
        }

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
            if (Router.currentPage === 'admin-chat' || Router.currentPage === 'admin-dashboard') {
                NotificationManager.showNotification(msg.sender_name, parseMessagePreview(msg.content));
            }
        });
    } catch(e) {
        console.error('Failed to load admin messages:', e);
    }
}

window.loadMoreAdminMessages = async function() {
    if (adminChatState.isLoading || !adminChatState.hasMore || !adminChatState.applicant) return;
    adminChatState.isLoading = true;
    
    var container = document.getElementById('admin-chat-messages');
    var loadMoreBtn = document.getElementById('admin-load-more-btn');
    if (loadMoreBtn) loadMoreBtn.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">Loading...</span>';

    var oldHeight = container.scrollHeight;
    adminChatState.offset += 20;

    try {
        var messages = await DB.getMessages(adminChatState.applicant.id, adminChatState.offset, 20);
        if (messages.length < 20) adminChatState.hasMore = false;

        // Render older messages temporarily to an offscreen div to avoid disrupting the current DOM too much
        var tempDiv = document.createElement('div');
        _adminLastDateLabel = '';
        messages.forEach(function(msg) {
            insertAdminDateSeparator(tempDiv, msg.created_at);
            var isSent = msg.sender_type === 'admin' && window.adminSession && msg.sender_id === window.adminSession.user.id;
            var row = createAdminMessageBubbleDOM(msg, isSent, false);
            tempDiv.appendChild(row);
        });

        // Insert after the load more button
        if (loadMoreBtn) {
            while (tempDiv.firstChild) {
                container.insertBefore(tempDiv.firstChild, loadMoreBtn.nextSibling);
            }
        }

        if (!adminChatState.hasMore && loadMoreBtn) {
            loadMoreBtn.remove();
        } else if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<button onclick="loadMoreAdminMessages()" style="background:none;border:none;color:var(--messenger-blue);cursor:pointer;font-size:14px;padding:8px">↑ <span data-i18n="chat.loadMore">' + (I18n.t('chat.loadMore') || 'Tải thêm tin nhắn cũ') + '</span></button>';
        }

        // Adjust scroll position so it stays where it was
        var newHeight = container.scrollHeight;
        container.scrollTop += (newHeight - oldHeight);

    } catch(e) {
        console.error('Failed to load more admin messages:', e);
    } finally {
        adminChatState.isLoading = false;
    }
};

function hideAdminPreviousLastStatus() {
    var rows = document.querySelectorAll('#admin-chat-messages .message-row.sent .message-status-wrap');
    rows.forEach(function(el) { el.style.display = 'none'; });
}

function createAdminMessageBubbleDOM(msg, isSent, isLast) {
    var row = document.createElement('div');
    row.className = 'message-row ' + (isSent ? 'sent' : 'received');
    if (msg.id) row.dataset.messageId = msg.id;

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

    html += '<div class="message-time msg-time-toggle" style="display:none">' + formatTime(msg.created_at) + '</div>';

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

    return row;
}

function appendAdminMessageBubble(msg, isNewSent, isLast) {
    var container = document.getElementById('admin-chat-messages');
    if (!container) return;

    var admin = window.adminSession;
    var isSent = msg.sender_type === 'admin' && admin && msg.sender_id === admin.user.id;
    var row = createAdminMessageBubbleDOM(msg, isSent, isLast);

    container.appendChild(row);
    if (isNewSent) {
        hideAdminPreviousLastStatus();
        var content = row.querySelector('.message-content');
        if (content && isSent) {
            var statusDiv = document.createElement('div');
            statusDiv.className = 'message-status-wrap';
            statusDiv.style.cssText = 'text-align:right;padding:0 12px';
            statusDiv.innerHTML = getStatusIcon(msg.status || 'sent');
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
    var appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.classList.remove('hidden-mobile');
    var pageContainer = document.getElementById('page-container');
    if (pageContainer) pageContainer.classList.remove('chat-active-mobile');
}

async function deleteCurrentConversation() {
    if (!adminChatState.applicant) return;
    
    var title = I18n.t('common.delete') || 'Xóa';
    var msg = (I18n.t('admin.confirmDelete') || 'Bạn có chắc chắn muốn xóa dữ liệu này? Hành động này không thể hoàn tác.');

    showConfirmModal(title, msg, async function() {
        try {
            await DB.deleteApplicant(adminChatState.applicant.id);
            
            // Return to empty state
            var chatArea = document.getElementById('admin-chat-area');
            if (chatArea) {
                chatArea.innerHTML = '<div class="admin-empty-state">' +
                    '<div class="admin-empty-icon">💬</div>' +
                    '<p>' + (I18n.t('admin.selectConversation') || 'Select a conversation') + '</p>' +
                '</div>';
            }
            
            // Remove from dashboard state if needed or let realtime handle it
            if (typeof dashboardState !== 'undefined') {
                dashboardState.applicants = dashboardState.applicants.filter(function(a) { return a.id !== adminChatState.applicant.id; });
                if (typeof renderConversationList === 'function') renderConversationList();
            }
            
            adminChatState.applicant = null;
            if (window.innerWidth <= 768) backToSidebar();
            showToast((I18n.t('chat.deleted') || 'Deleted'), 'success');
        } catch(e) {
            console.error(e);
            showToast(I18n.t('common.error'), 'error');
        }
    });
}
