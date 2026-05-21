/* ============================================
   Helper Utilities
   ============================================ */

function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return I18n.t('chat.sent');

    // Same day
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Older
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirmModal(title, message, onConfirm, okText) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    
    // Default translations
    var btnCancel = (typeof I18n !== 'undefined' && I18n.t('admin.cancel')) || 'Hủy';
    var btnOk = okText || (typeof I18n !== 'undefined' && I18n.t('admin.ok')) || 'Xóa';

    overlay.innerHTML = 
        '<div class="confirm-modal-card" onclick="event.stopPropagation()">' +
            '<h3>' + escapeHtml(title) + '</h3>' +
            '<p>' + escapeHtml(message) + '</p>' +
            '<div class="confirm-modal-actions">' +
                '<button class="btn-cancel" onclick="this.closest(\'.confirm-modal-overlay\').remove()">' + escapeHtml(btnCancel) + '</button>' +
                '<button class="btn-confirm" id="confirm-modal-ok">' + escapeHtml(btnOk) + '</button>' +
            '</div>' +
        '</div>';
        
    // Close on overlay click
    overlay.onclick = function() {
        overlay.remove();
    };

    document.body.appendChild(overlay);

    document.getElementById('confirm-modal-ok').onclick = function() {
        overlay.remove();
        if (onConfirm) onConfirm();
    };
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

var EmojiPicker = {
    emojis: ['😀','😂','😊','😍','😘','😜','😎','😢','😡','👍','👎','❤️','🔥','🎉','👏','✨','🙌','💯'],
    init: function() {
        if (document.getElementById('global-emoji-picker')) return;
        var picker = document.createElement('div');
        picker.id = 'global-emoji-picker';
        picker.className = 'emoji-picker hidden';
        picker.innerHTML = this.emojis.map(function(e) {
            return '<span class="emoji-item" onclick="EmojiPicker.select(\'' + e + '\')">' + e + '</span>';
        }).join('');
        document.body.appendChild(picker);
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#global-emoji-picker') && !e.target.closest('.emoji-toggle-btn')) {
                picker.classList.add('hidden');
            }
        });
    },
    toggle: function(inputId, btnElement) {
        this.init();
        var picker = document.getElementById('global-emoji-picker');
        this.currentInputId = inputId;
        
        if (!picker.classList.contains('hidden') && this.lastBtn === btnElement) {
            picker.classList.add('hidden');
            return;
        }
        
        this.lastBtn = btnElement;
        var rect = btnElement.getBoundingClientRect();
        picker.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
        picker.style.right = (window.innerWidth - rect.right - 10) + 'px';
        picker.classList.remove('hidden');
    },
    select: function(emoji) {
        if (!this.currentInputId) return;
        var input = document.getElementById(this.currentInputId);
        if (input) {
            input.value += emoji;
            input.focus();
        }
        var picker = document.getElementById('global-emoji-picker');
        if (picker) picker.classList.add('hidden');
    }
};
