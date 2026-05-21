/* ============================================
   Supabase Client Configuration
   ============================================ */

// IMPORTANT: Replace these with your actual Supabase project credentials
var SUPABASE_URL = 'https://jlokmkjqwyrawlholojb.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsb2tta2pxd3lyYXdsaG9sb2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzU2MTgsImV4cCI6MjA4OTgxMTYxOH0.Pn34tBWy-sSavRgfVGYnt-4uaBxnNSCdune6lKWzVHE';

// supabaseClient stays null until health check confirms connectivity
var supabaseClient = null;
var _pendingClient = null;

function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL') {
        console.warn('[JobChat] Demo mode — no Supabase credentials.');
        return Promise.resolve(false);
    }
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            _pendingClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[JobChat] Checking Supabase connectivity...');
            return checkSupabaseConnectivity();
        } else {
            console.warn('[JobChat] Supabase SDK not loaded. Using DemoDB.');
            return Promise.resolve(false);
        }
    } catch(e) {
        console.warn('[JobChat] Supabase init failed. DemoDB mode.', e);
        return Promise.resolve(false);
    }
}

function checkSupabaseConnectivity() {
    return new Promise(function(resolve) {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 2000);

        fetch(SUPABASE_URL + '/rest/v1/applicants?limit=0', {
            method: 'GET',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
            signal: controller.signal
        }).then(function(res) {
            clearTimeout(timeoutId);
            if (res.ok) {
                supabaseClient = _pendingClient;
                console.log('[JobChat] Supabase connected ✓');
                resolve(true);
            } else {
                console.warn('[JobChat] Supabase error (status ' + res.status + '). Using DemoDB.');
                _pendingClient = null;
                resolve(false);
            }
        }).catch(function() {
            clearTimeout(timeoutId);
            console.warn('[JobChat] Supabase unreachable. Using DemoDB.');
            _pendingClient = null;
            resolve(false);
        });
    });
}

// ============ Demo Mode with Cross-Tab Sync ============
var DemoDB = {
    data: {
        applicants: [],
        messages: [],
        job_posts: []
    },
    listeners: {
        messages: {},
        allMessages: [],
        newApplicants: []
    },

    init: function() {
        this.reload();
        this._deduplicateApplicants();
        // Cross-tab sync: listen for localStorage changes from other tabs
        var self = this;
        window.addEventListener('storage', function(e) {
            if (e.key === 'jobchat_demo_data' && e.newValue) {
                try {
                    var oldData = self.data;
                    var newData = JSON.parse(e.newValue);

                    // Detect new messages from other tab
                    var oldMsgIds = {};
                    oldData.messages.forEach(function(m) { oldMsgIds[m.id] = true; });
                    var newMessages = newData.messages.filter(function(m) { return !oldMsgIds[m.id]; });

                    // Detect new applicants from other tab
                    var oldAppIds = {};
                    oldData.applicants.forEach(function(a) { oldAppIds[a.id] = true; });
                    var newApplicants = newData.applicants.filter(function(a) { return !oldAppIds[a.id]; });

                    // Update in-memory data
                    self.data = newData;

                    // Fire message listeners for new messages
                    newMessages.forEach(function(msg) {
                        var convCbs = self.listeners.messages[msg.conversation_id] || [];
                        convCbs.forEach(function(cb) { cb(msg); });
                        self.listeners.allMessages.forEach(function(cb) { cb(msg); });
                    });

                    // Fire new applicant listeners
                    newApplicants.forEach(function(app) {
                        self.listeners.newApplicants.forEach(function(cb) { cb(app); });
                    });
                } catch(ex) {
                    console.warn('[DemoDB] Cross-tab sync error:', ex);
                }
            }
        });
    },

    save: function() {
        localStorage.setItem('jobchat_demo_data', JSON.stringify(this.data));
    },

    reload: function() {
        var saved = localStorage.getItem('jobchat_demo_data');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
                if (!this.data.job_posts) this.data.job_posts = [];
            } catch(e) {}
        }
    },

    _deduplicateApplicants: function() {
        var seen = {};
        var cleaned = [];
        this.data.applicants.forEach(function(a) {
            var key = a.email ? a.email.toLowerCase() : a.id;
            if (!seen[key]) {
                seen[key] = true;
                cleaned.push(a);
            }
        });
        if (cleaned.length !== this.data.applicants.length) {
            console.log('[DemoDB] Cleaned ' + (this.data.applicants.length - cleaned.length) + ' duplicate applicants');
            this.data.applicants = cleaned;
            this.save();
        }
    },

    createApplicant: function(data) {
        this.reload();
        // Prevent duplicate accounts with same email
        if (data.email) {
            var existing = this.data.applicants.find(function(a) {
                return a.email && a.email.toLowerCase() === data.email.toLowerCase();
            });
            if (existing) return existing;
        }
        var applicant = {
            id: generateId(),
            name: data.name,
            email: data.email || '',
            phone: data.phone || '',
            position: data.position,
            language: I18n.currentLang,
            status: 'active',
            session_token: generateToken(),
            created_at: new Date().toISOString()
        };
        this.data.applicants.unshift(applicant);
        this.save();
        this.listeners.newApplicants.forEach(function(cb) { cb(applicant); });
        return applicant;
    },

    getApplicant: function(id) {
        this.reload();
        return this.data.applicants.find(function(a) { return a.id === id; }) || null;
    },

    getApplicantByToken: function(token) {
        this.reload();
        return this.data.applicants.find(function(a) { return a.session_token === token; }) || null;
    },

    getApplicantByEmail: function(email) {
        this.reload();
        return this.data.applicants.find(function(a) { return a.email === email; }) || null;
    },

    getAllApplicants: function() {
        this.reload();
        return this.data.applicants.slice();
    },

    updateApplicantStatus: function(id, status) {
        this.reload();
        var found = this.data.applicants.find(function(a) { return a.id === id; });
        if (found) { found.status = status; this.save(); }
    },

    deleteApplicant: function(id) {
        this.reload();
        this.data.applicants = this.data.applicants.filter(function(a) { return a.id !== id; });
        this.data.messages = this.data.messages.filter(function(m) { return m.conversation_id !== id; });
        this.save();
    },

    sendMessage: function(conversationId, senderType, senderName, senderId, content) {
        this.reload();
        var msg = {
            id: generateId(),
            conversation_id: conversationId,
            sender_type: senderType,
            sender_name: senderName,
            sender_id: senderId,
            content: content,
            status: 'sent',
            created_at: new Date().toISOString()
        };
        this.data.messages.push(msg);
        this.save();

        var convListeners = this.listeners.messages[conversationId] || [];
        convListeners.forEach(function(cb) { cb(msg); });
        this.listeners.allMessages.forEach(function(cb) { cb(msg); });

        return msg;
    },

    updateMessageStatus: function(messageId, status) {
        this.reload();
        var msg = this.data.messages.find(function(m) { return m.id === messageId; });
        if (msg) { msg.status = status; this.save(); }
    },

    markMessagesAsDelivered: function(conversationId, senderType) {
        this.reload();
        var changed = [];
        this.data.messages.forEach(function(m) {
            if (m.conversation_id === conversationId && m.sender_type === senderType && m.status === 'sent') {
                m.status = 'delivered';
                changed.push(m);
            }
        });
        if (changed.length) this.save();
        return changed;
    },

    markMessagesAsSeen: function(conversationId, senderType) {
        this.reload();
        var changed = [];
        this.data.messages.forEach(function(m) {
            if (m.conversation_id === conversationId && m.sender_type === senderType && (m.status === 'sent' || m.status === 'delivered')) {
                m.status = 'seen';
                changed.push(m);
            }
        });
        if (changed.length) this.save();
        return changed;
    },

    deleteMessage: function(messageId) {
        this.reload();
        this.data.messages = this.data.messages.filter(function(m) { return m.id !== messageId; });
        this.save();
    },

    getMessages: function(conversationId, offset = 0, limit = 20) {
        this.reload();
        var msgs = this.data.messages.filter(function(m) { return m.conversation_id === conversationId; });
        var start = Math.max(0, msgs.length - offset - limit);
        var end = msgs.length - offset;
        if (end <= 0) return [];
        return msgs.slice(start, end);
    },

    getLastMessage: function(conversationId) {
        this.reload();
        var msgs = this.data.messages.filter(function(m) { return m.conversation_id === conversationId; });
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    },

    subscribeToMessages: function(conversationId, callback) {
        if (!this.listeners.messages[conversationId]) {
            this.listeners.messages[conversationId] = [];
        }
        this.listeners.messages[conversationId].push(callback);
        return { conversationId: conversationId, callback: callback };
    },

    subscribeToAllMessages: function(callback) {
        this.listeners.allMessages.push(callback);
        return { type: 'all', callback: callback };
    },

    subscribeToNewApplicants: function(callback) {
        this.listeners.newApplicants.push(callback);
        return { type: 'applicants', callback: callback };
    },

    // ============ Job Posts (Demo) ============
    getPublishedJobs: function() {
        return this.data.job_posts.filter(function(j) { return j.status === 'published'; }).sort(function(a,b) { return new Date(b.created_at) - new Date(a.created_at); });
    },

    getAllJobs: function() {
        return this.data.job_posts.slice().sort(function(a,b) { return new Date(b.created_at) - new Date(a.created_at); });
    },

    createJob: function(data) {
        var job = {
            id: generateId(),
            title: data.title,
            content: data.content,
            position: data.position || '',
            salary: data.salary || '',
            location: data.location || '',
            status: data.status || 'draft',
            author_id: data.author_id || '',
            author_name: data.author_name || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        this.data.job_posts.unshift(job);
        this.save();
        return job;
    },

    updateJob: function(id, data) {
        var job = this.data.job_posts.find(function(j) { return j.id === id; });
        if (job) {
            Object.keys(data).forEach(function(k) { job[k] = data[k]; });
            job.updated_at = new Date().toISOString();
            this.save();
        }
        return job;
    },

    deleteJob: function(id) {
        this.data.job_posts = this.data.job_posts.filter(function(j) { return j.id !== id; });
        this.save();
    },

    adminLogin: function(username, password) {
        var demoAdmins = [
            { id: 'admin1', username: 'Thang', display_name: 'Thang', role: 'admin', avatar: '', password_hash: '1936' },
            { id: 'admin2', username: 'Minh', display_name: 'Minh', role: 'admin', avatar: '', password_hash: '1936' },
            { id: 'admin3', username: 'Okuyama', display_name: 'Okuyama', role: 'admin', avatar: '', password_hash: '1936' },
            { id: 'admin4', username: 'Nakagawa', display_name: 'Nakagawa', role: 'admin', avatar: '', password_hash: '1936' }
        ];
        var admin = demoAdmins.find(function(a) { return a.username.toLowerCase() === username.toLowerCase(); });
        if (admin && password === admin.password_hash) {
            localStorage.setItem('jobchat_admin', JSON.stringify(admin));
            return { user: { id: admin.id }, profile: admin };
        }
        throw new Error('Invalid credentials');
    },

    adminLogout: function() {
        localStorage.removeItem('jobchat_admin');
    },

    getAdminSession: function() {
        var saved = localStorage.getItem('jobchat_admin');
        if (!saved) return null;
        try {
            var admin = JSON.parse(saved);
            return { user: { id: admin.id }, profile: admin };
        } catch(e) { return null; }
    }
};

// ============ Database Operations ============
// Uses supabaseClient (not supabase) to avoid CDN global collision
var DB = {
    createApplicant: async function(data) {
        if (!supabaseClient) return DemoDB.createApplicant(data);
        try {
            var result = await supabaseClient.from('applicants').insert({
                name: data.name, email: data.email || '', phone: data.phone || '',
                position: data.position, language: I18n.currentLang,
                status: 'active', session_token: generateToken()
            }).select().single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('Supabase createApplicant failed, using DemoDB:', e.message);
            return DemoDB.createApplicant(data);
        }
    },

    getApplicant: async function(id) {
        if (!supabaseClient) return DemoDB.getApplicant(id);
        try {
            var result = await supabaseClient.from('applicants').select('*').eq('id', id).single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('Supabase getApplicant failed, using DemoDB:', e.message);
            return DemoDB.getApplicant(id);
        }
    },

    getApplicantByToken: async function(token) {
        if (!supabaseClient) return DemoDB.getApplicantByToken(token);
        try {
            var result = await supabaseClient.from('applicants').select('*').eq('session_token', token).single();
            if (result.error) return DemoDB.getApplicantByToken(token);
            return result.data;
        } catch(e) {
            console.warn('Supabase getApplicantByToken failed, using DemoDB:', e.message);
            return DemoDB.getApplicantByToken(token);
        }
    },

    getApplicantByEmail: async function(email) {
        if (!supabaseClient) return DemoDB.getApplicantByEmail(email);
        try {
            var result = await supabaseClient.from('applicants').select('*').eq('email', email).single();
            if (result.error) return DemoDB.getApplicantByEmail(email);
            return result.data;
        } catch(e) {
            console.warn('Supabase getApplicantByEmail failed, using DemoDB:', e.message);
            return DemoDB.getApplicantByEmail(email);
        }
    },

    getAllApplicants: async function() {
        if (!supabaseClient) return DemoDB.getAllApplicants();
        try {
            var result = await supabaseClient.from('applicants').select('*').order('created_at', { ascending: false });
            if (result.error) throw result.error;
            return result.data || [];
        } catch(e) {
            console.warn('Supabase getAllApplicants failed, using DemoDB:', e.message);
            return DemoDB.getAllApplicants();
        }
    },

    updateApplicantStatus: async function(id, status) {
        if (!supabaseClient) return DemoDB.updateApplicantStatus(id, status);
        try {
            var result = await supabaseClient.from('applicants').update({ status: status }).eq('id', id);
            if (result.error) throw result.error;
        } catch(e) {
            console.warn('Supabase updateApplicantStatus failed, using DemoDB:', e.message);
            return DemoDB.updateApplicantStatus(id, status);
        }
    },

    deleteApplicant: async function(id) {
        if (!supabaseClient) return DemoDB.deleteApplicant(id);
        try {
            // Delete messages first (if no cascade)
            await supabaseClient.from('messages').delete().eq('conversation_id', id);
            // Then delete applicant
            var result = await supabaseClient.from('applicants').delete().eq('id', id);
            if (result.error) throw result.error;
        } catch(e) {
            console.warn('Supabase deleteApplicant failed, using DemoDB:', e.message);
            return DemoDB.deleteApplicant(id);
        }
    },

    sendMessage: async function(conversationId, senderType, senderName, senderId, content) {
        if (!supabaseClient) return DemoDB.sendMessage(conversationId, senderType, senderName, senderId, content);
        try {
            var result = await supabaseClient.from('messages').insert({
                conversation_id: conversationId, sender_type: senderType,
                sender_name: senderName, sender_id: senderId, content: content,
                status: 'sent'
            }).select().single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('Supabase sendMessage failed, using DemoDB:', e.message);
            return DemoDB.sendMessage(conversationId, senderType, senderName, senderId, content);
        }
    },

    updateMessageStatus: async function(messageId, status) {
        if (!supabaseClient) return DemoDB.updateMessageStatus(messageId, status);
        try {
            await supabaseClient.from('messages').update({ status: status }).eq('id', messageId);
        } catch(e) {
            console.warn('Supabase updateMessageStatus failed, using DemoDB:', e.message);
            return DemoDB.updateMessageStatus(messageId, status);
        }
    },

    markMessagesAsDelivered: async function(conversationId, senderType) {
        if (!supabaseClient) return DemoDB.markMessagesAsDelivered(conversationId, senderType);
        try {
            await supabaseClient.from('messages').update({ status: 'delivered' })
                .eq('conversation_id', conversationId).eq('sender_type', senderType).eq('status', 'sent');
        } catch(e) {
            console.warn('Supabase markMessagesAsDelivered failed, using DemoDB:', e.message);
            return DemoDB.markMessagesAsDelivered(conversationId, senderType);
        }
    },

    markMessagesAsSeen: async function(conversationId, senderType) {
        if (!supabaseClient) return DemoDB.markMessagesAsSeen(conversationId, senderType);
        try {
            await supabaseClient.from('messages').update({ status: 'seen' })
                .eq('conversation_id', conversationId).eq('sender_type', senderType).in('status', ['sent', 'delivered']);
        } catch(e) {
            console.warn('Supabase markMessagesAsSeen failed, using DemoDB:', e.message);
            return DemoDB.markMessagesAsSeen(conversationId, senderType);
        }
    },

    deleteMessage: async function(messageId) {
        if (!supabaseClient) return DemoDB.deleteMessage(messageId);
        try {
            await supabaseClient.from('messages').delete().eq('id', messageId);
        } catch(e) {
            console.warn('Supabase deleteMessage failed, using DemoDB:', e.message);
            DemoDB.deleteMessage(messageId);
        }
    },

    getMessages: async function(conversationId, offset = 0, limit = 20) {
        if (!supabaseClient) return DemoDB.getMessages(conversationId, offset, limit);
        try {
            var result = await supabaseClient.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
            if (result.error) throw result.error;
            return (result.data || []).reverse();
        } catch(e) {
            console.warn('Supabase getMessages failed, using DemoDB:', e.message);
            return DemoDB.getMessages(conversationId);
        }
    },

    getLastMessage: async function(conversationId) {
        if (!supabaseClient) return DemoDB.getLastMessage(conversationId);
        try {
            var result = await supabaseClient.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).single();
            if (result.error) return DemoDB.getLastMessage(conversationId);
            return result.data;
        } catch(e) {
            console.warn('Supabase getLastMessage failed, using DemoDB:', e.message);
            return DemoDB.getLastMessage(conversationId);
        }
    },

    subscribeToMessages: function(conversationId, callback) {
        if (!supabaseClient) return DemoDB.subscribeToMessages(conversationId, callback);
        return supabaseClient.channel('messages:' + conversationId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId }, function(payload) { callback(payload.new); })
            .subscribe();
    },

    subscribeToAllMessages: function(callback) {
        if (!supabaseClient) return DemoDB.subscribeToAllMessages(callback);
        return supabaseClient.channel('all-messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function(payload) { callback(payload.new); })
            .subscribe();
    },

    subscribeToNewApplicants: function(callback) {
        if (!supabaseClient) return DemoDB.subscribeToNewApplicants(callback);
        return supabaseClient.channel('new-applicants')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applicants' }, function(payload) { callback(payload.new); })
            .subscribe();
    },

    unsubscribe: function(subscription) {
        if (!subscription) return;
        if (!supabaseClient) {
            // DemoDB: remove listener by reference
            if (subscription.conversationId) {
                var arr = DemoDB.listeners.messages[subscription.conversationId];
                if (arr) {
                    var idx = arr.indexOf(subscription.callback);
                    if (idx > -1) arr.splice(idx, 1);
                }
            } else if (subscription.type === 'all') {
                var idx = DemoDB.listeners.allMessages.indexOf(subscription.callback);
                if (idx > -1) DemoDB.listeners.allMessages.splice(idx, 1);
            } else if (subscription.type === 'applicants') {
                var idx = DemoDB.listeners.newApplicants.indexOf(subscription.callback);
                if (idx > -1) DemoDB.listeners.newApplicants.splice(idx, 1);
            }
            return;
        }
        supabaseClient.removeChannel(subscription);
    },

    adminLogin: async function(username, password) {
        if (!supabaseClient) return DemoDB.adminLogin(username, password);
        try {
            var result = await supabaseClient.from('admins').select('*').ilike('username', username).eq('password_hash', password).single();
            if (result.error || !result.data) {
                console.warn('Supabase adminLogin failed, trying DemoDB');
                return DemoDB.adminLogin(username, password);
            }
            var admin = result.data;
            localStorage.setItem('jobchat_admin', JSON.stringify(admin));
            return { user: { id: admin.id }, profile: admin };
        } catch(e) {
            console.warn('Supabase adminLogin failed, using DemoDB:', e.message);
            return DemoDB.adminLogin(username, password);
        }
    },

    adminLogout: async function() {
        localStorage.removeItem('jobchat_admin');
    },

    getAdminSession: async function() {
        var saved = localStorage.getItem('jobchat_admin');
        if (!saved) return null;
        try {
            var admin = JSON.parse(saved);
            return { user: { id: admin.id }, profile: admin };
        } catch(e) { return null; }
    },

    updateAdminProfile: async function(adminId, data) {
        if (!supabaseClient) {
            // DemoDB: just update localStorage
            var saved = localStorage.getItem('jobchat_admin');
            if (saved) {
                var admin = JSON.parse(saved);
                if (data.display_name) admin.display_name = data.display_name;
                if (data.avatar) admin.avatar = data.avatar;
                if (data.password_hash) admin.password_hash = data.password_hash;
                localStorage.setItem('jobchat_admin', JSON.stringify(admin));
            }
            return;
        }
        var update = {};
        if (data.display_name) update.display_name = data.display_name;
        if (data.avatar) update.avatar = data.avatar;
        if (data.password_hash) update.password_hash = data.password_hash;
        await supabaseClient.from('admins').update(update).eq('id', adminId);
    },

    getAdminProfile: async function(adminId) {
        if (!supabaseClient) {
            var saved = localStorage.getItem('jobchat_admin');
            if (saved) {
                var admin = JSON.parse(saved);
                if (admin.id == adminId || !adminId) return admin;
            }
            return { display_name: 'Admin', avatar: '' };
        }
        try {
            var result = await supabaseClient.from('admins').select('id, display_name, avatar').eq('id', adminId).single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('getAdminProfile error:', e);
            var saved = localStorage.getItem('jobchat_admin');
            if (saved) {
                var admin = JSON.parse(saved);
                if (admin.id == adminId || !adminId) return admin;
            }
            return { display_name: 'Admin', avatar: '' };
        }
    },

    // ============ Job Posts ============
    getPublishedJobs: async function() {
        if (!supabaseClient) return DemoDB.getPublishedJobs();
        try {
            var result = await supabaseClient.from('job_posts').select('*').eq('status', 'published').order('created_at', { ascending: false });
            if (result.error) throw result.error;
            return result.data || [];
        } catch(e) {
            console.warn('job_posts table may not exist, using DemoDB:', e.message);
            return DemoDB.getPublishedJobs();
        }
    },

    getAllJobs: async function() {
        if (!supabaseClient) return DemoDB.getAllJobs();
        try {
            var result = await supabaseClient.from('job_posts').select('*').order('created_at', { ascending: false });
            if (result.error) throw result.error;
            return result.data || [];
        } catch(e) {
            console.warn('job_posts table may not exist, using DemoDB:', e.message);
            return DemoDB.getAllJobs();
        }
    },

    createJob: async function(data) {
        if (!supabaseClient) return DemoDB.createJob(data);
        try {
            var result = await supabaseClient.from('job_posts').insert({
                title: data.title, content: data.content, position: data.position || '',
                salary: data.salary || '', location: data.location || '',
                status: data.status || 'draft', author_id: data.author_id || '',
                author_name: data.author_name || ''
            }).select().single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('job_posts table may not exist, using DemoDB:', e.message);
            return DemoDB.createJob(data);
        }
    },

    updateJob: async function(id, data) {
        if (!supabaseClient) return DemoDB.updateJob(id, data);
        try {
            data.updated_at = new Date().toISOString();
            var result = await supabaseClient.from('job_posts').update(data).eq('id', id).select().single();
            if (result.error) throw result.error;
            return result.data;
        } catch(e) {
            console.warn('job_posts table may not exist, using DemoDB:', e.message);
            return DemoDB.updateJob(id, data);
        }
    },

    deleteJob: async function(id) {
        if (!supabaseClient) return DemoDB.deleteJob(id);
        try {
            await supabaseClient.from('job_posts').delete().eq('id', id);
        } catch(e) {
            console.warn('job_posts table may not exist, using DemoDB:', e.message);
            DemoDB.deleteJob(id);
        }
    }
};
