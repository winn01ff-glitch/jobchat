/* ============================================
   Helper Utilities
   ============================================ */

export function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function generateToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export function formatTime(dateStr, I18n) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return I18n ? I18n.t('chat.sent') : 'Vừa xong';

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

export function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function getInitials(name) {
    if (!name) return '?';
    return name.trim()[0].toUpperCase();
}

export function escapeHtml(text) {
    if (typeof document === 'undefined') {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function showToast(message, type = 'info') {
    if (typeof document === 'undefined') return;
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

export function showConfirmModal(title, message, onConfirm, okText, I18n) {
    if (typeof document === 'undefined') return;
    var overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    
    // Default translations
    var btnCancel = (I18n && I18n.t('admin.cancel')) || 'Hủy';
    var btnOk = okText || (I18n && I18n.t('admin.ok')) || 'Xác nhận';

    overlay.innerHTML = 
        '<div class="confirm-modal-card" onclick="event.stopPropagation()">' +
            '<div class="confirm-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>' +
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

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Auto-resize textarea
export function autoResize(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

export const EmojiPicker = {
    emojis: ['😀','😂','😊','😍','😘','😜','😎','😢','😡','👍','👎','❤️','🔥','🎉','👏','✨','🙌','💯'],
    init: function() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('global-emoji-picker')) return;
        var picker = document.createElement('div');
        picker.id = 'global-emoji-picker';
        picker.className = 'emoji-picker hidden';
        picker.innerHTML = this.emojis.map(function(e) {
            return '<span class="emoji-item" onclick="window.EmojiPickerSelect(\'' + e + '\')">' + e + '</span>';
        }).join('');
        document.body.appendChild(picker);
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('#global-emoji-picker') && !e.target.closest('.emoji-toggle-btn')) {
                picker.classList.add('hidden');
            }
        });
        
        // Expose to window for the onclick handler
        if (typeof window !== 'undefined') {
            window.EmojiPickerSelect = (emoji) => this.select(emoji);
        }
    },
    toggle: function(inputId, btnElement) {
        if (typeof document === 'undefined') return;
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
        if (typeof document === 'undefined') return;
        if (!this.currentInputId) return;
        var input = document.getElementById(this.currentInputId);
        if (input) {
            input.value += emoji;
            input.focus();
            // Trigger input event for React to pick up changes
            var event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        }
        var picker = document.getElementById('global-emoji-picker');
        if (picker) picker.classList.add('hidden');
    }
};


export async function hashPassword(password) {
    if (!password) return '';
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function downloadFile(url, filename) {
    try {
        if (!url) return;
        
        if (url.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || 'download';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return;
        }
        
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename || 'download';
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file, falling back to direct open:', error);
        window.open(url, '_blank');
    }
}
