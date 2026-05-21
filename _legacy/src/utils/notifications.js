/* ============================================
   Web Push Notifications & Sound
   ============================================ */

const NotificationManager = {
    permission: 'default',
    soundEnabled: true,

    async init() {
        // Check if notifications are supported
        if ('Notification' in window) {
            this.permission = Notification.permission;
        }
    },

    async requestPermission() {
        if (!('Notification' in window)) return false;

        if (this.permission === 'default') {
            this.permission = await Notification.requestPermission();
        }

        return this.permission === 'granted';
    },

    async showNotification(title, body, options = {}) {
        // Play sound
        this.playSound();

        // Show browser notification
        if (this.permission === 'granted' && document.hidden) {
            try {
                const notification = new Notification(title, {
                    body: body,
                    icon: options.icon || '💬',
                    badge: '💬',
                    tag: options.tag || 'uphill-msg',
                    renotify: true,
                    ...options
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    if (options.onClick) options.onClick();
                };

                // Auto close after 5s
                setTimeout(() => notification.close(), 5000);
            } catch (e) {
                console.warn('Notification failed:', e);
            }
        }

        // Always show in-app toast
        if (!document.hidden) {
            showToast(`${title}: ${body}`, 'info');
        }
    },

    playSound() {
        if (!this.soundEnabled) return;
        try {
            const audio = document.getElementById('notification-sound');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            }
        } catch (e) {
            // Ignore audio errors
        }
    },

    // Update document title with unread count
    updateBadge(count) {
        const baseTitle = 'Uphill';
        if (count > 0) {
            document.title = `(${count}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }
};
