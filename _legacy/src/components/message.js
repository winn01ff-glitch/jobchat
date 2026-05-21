/* ============================================
   Message Component
   ============================================ */

function createMessageElement(msg, isSent, showSender = true) {
    const row = document.createElement('div');
    row.className = `message-row ${isSent ? 'sent' : 'received'}`;
    row.dataset.messageId = msg.id;

    const content = document.createElement('div');
    content.className = 'message-content';

    // Show sender name for admin messages or in group context
    if (showSender && msg.sender_type === 'admin' && !isSent) {
        const sender = document.createElement('div');
        sender.className = 'message-sender';
        sender.textContent = msg.sender_name;
        content.appendChild(sender);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = msg.content;
    content.appendChild(bubble);

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = formatTime(msg.created_at);
    content.appendChild(time);

    // Avatar for received messages
    if (!isSent) {
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = getInitials(msg.sender_name);
        row.appendChild(avatar);
    }

    row.appendChild(content);
    return row;
}

function createSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.innerHTML = `<span class="time-divider">${escapeHtml(text)}</span>`;
    return div;
}

function createTypingIndicator(name) {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
        <span>${escapeHtml(name)} ${I18n.t('chat.typing')}</span>
    `;
    return div;
}
