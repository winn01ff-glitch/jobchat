/* ============================================
   Supabase Client Configuration
   ============================================ */

// IMPORTANT: Replace these with your actual Supabase project credentials
var SUPABASE_URL = 'https://jlokmkjqwyrawlholojb.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_aoNLC5tnZ7LKI09z07baiw_tpGwvUXf';

// Use supabaseClient (NOT supabase) to avoid collision with CDN global
var supabaseClient = null;

function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL') {
        console.warn('[JobChat] Demo mode — no Supabase credentials.');
        return null;
    }
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('[JobChat] Supabase connected.');
            return supabaseClient;
        } else {
            console.warn('[JobChat] Supabase SDK not loaded yet. Using demo mode.');
            return null;
        }
    } catch(e) {
        console.warn('[JobChat] Supabase init failed. Demo mode.', e);
        return null;
    }
}

// ============ Demo Mode (no Supabase) ============
var DemoDB = {
    data: {
        applicants: [],
        messages: []
    },
    listeners: {
        messages: {},
        allMessages: [],
        newApplicants: []
    },

    init: function() {
        var saved = localStorage.getItem('jobchat_demo_data');
        if (saved) {
            try { this.data = JSON.parse(saved); } catch(e) {}
        }
    },

    save: function() {
        localStorage.setItem('jobchat_demo_data', JSON.stringify(this.data));
    },

    createApplicant: function(data) {
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
        return this.data.applicants.find(function(a) { return a.id === id; }) || null;
    },

    getApplicantByToken: function(token) {
        return this.data.applicants.find(function(a) { return a.session_token === token; }) || null;
    },

    getApplicantByEmail: function(email) {
        return this.data.applicants.find(function(a) { return a.email === email; }) || null;
    },

    getAllApplicants: function() {
        return this.data.applicants.slice();
    },

    updateApplicantStatus: function(id, status) {
        var found = this.data.applicants.find(function(a) { return a.id === id; });
        if (found) { found.status = status; this.save(); }
    },

    sendMessage: function(conversationId, senderType, senderName, senderId, content) {
        var msg = {
            id: generateId(),
            conversation_id: conversationId,
            sender_type: senderType,
            sender_name: senderName,
            sender_id: senderId,
            content: content,
            created_at: new Date().toISOString()
        };
        this.data.messages.push(msg);
        this.save();

        var convListeners = this.listeners.messages[conversationId] || [];
        convListeners.forEach(function(cb) { cb(msg); });
        this.listeners.allMessages.forEach(function(cb) { cb(msg); });

        return msg;
    },

    getMessages: function(conversationId) {
        return this.data.messages.filter(function(m) { return m.conversation_id === conversationId; });
    },

    getLastMessage: function(conversationId) {
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

    adminLogin: function(email, password) {
        var demoAdmins = [
            { id: 'admin1', email: 'admin1@jobchat.com', display_name: 'Admin 1', role: 'admin' },
            { id: 'admin2', email: 'admin2@jobchat.com', display_name: 'Admin 2', role: 'admin' },
            { id: 'admin3', email: 'admin3@jobchat.com', display_name: 'Admin 3', role: 'admin' },
            { id: 'admin4', email: 'admin4@jobchat.com', display_name: 'Admin 4', role: 'admin' }
        ];
        var admin = demoAdmins.find(function(a) { return a.email === email; });
        if (admin && password === 'demo1234') {
            localStorage.setItem('jobchat_admin', JSON.stringify(admin));
            return { user: { id: admin.id, email: admin.email }, profile: admin };
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
            return { user: { id: admin.id, email: admin.email }, profile: admin };
        } catch(e) { return null; }
    }
};

// ============ Database Operations ============
// Uses supabaseClient (not supabase) to avoid CDN global collision
var DB = {
    createApplicant: async function(data) {
        if (!supabaseClient) return DemoDB.createApplicant(data);
        var result = await supabaseClient.from('applicants').insert({
            name: data.name, email: data.email || '', phone: data.phone || '',
            position: data.position, language: I18n.currentLang,
            status: 'active', session_token: generateToken()
        }).select().single();
        if (result.error) throw result.error;
        return result.data;
    },

    getApplicant: async function(id) {
        if (!supabaseClient) return DemoDB.getApplicant(id);
        var result = await supabaseClient.from('applicants').select('*').eq('id', id).single();
        if (result.error) throw result.error;
        return result.data;
    },

    getApplicantByToken: async function(token) {
        if (!supabaseClient) return DemoDB.getApplicantByToken(token);
        var result = await supabaseClient.from('applicants').select('*').eq('session_token', token).single();
        if (result.error) return null;
        return result.data;
    },

    getApplicantByEmail: async function(email) {
        if (!supabaseClient) return DemoDB.getApplicantByEmail(email);
        var result = await supabaseClient.from('applicants').select('*').eq('email', email).single();
        if (result.error) return null;
        return result.data;
    },

    getAllApplicants: async function() {
        if (!supabaseClient) return DemoDB.getAllApplicants();
        var result = await supabaseClient.from('applicants').select('*').order('created_at', { ascending: false });
        if (result.error) throw result.error;
        return result.data || [];
    },

    updateApplicantStatus: async function(id, status) {
        if (!supabaseClient) return DemoDB.updateApplicantStatus(id, status);
        var result = await supabaseClient.from('applicants').update({ status: status }).eq('id', id);
        if (result.error) throw result.error;
    },

    sendMessage: async function(conversationId, senderType, senderName, senderId, content) {
        if (!supabaseClient) return DemoDB.sendMessage(conversationId, senderType, senderName, senderId, content);
        var result = await supabaseClient.from('messages').insert({
            conversation_id: conversationId, sender_type: senderType,
            sender_name: senderName, sender_id: senderId, content: content
        }).select().single();
        if (result.error) throw result.error;
        return result.data;
    },

    getMessages: async function(conversationId) {
        if (!supabaseClient) return DemoDB.getMessages(conversationId);
        var result = await supabaseClient.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        if (result.error) throw result.error;
        return result.data || [];
    },

    getLastMessage: async function(conversationId) {
        if (!supabaseClient) return DemoDB.getLastMessage(conversationId);
        var result = await supabaseClient.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1).single();
        if (result.error) return null;
        return result.data;
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
        if (!supabaseClient) return;
        if (subscription) supabaseClient.removeChannel(subscription);
    },

    adminLogin: async function(email, password) {
        if (!supabaseClient) return DemoDB.adminLogin(email, password);
        var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (result.error) throw result.error;
        var profileResult = await supabaseClient.from('admins').select('*').eq('id', result.data.user.id).single();
        return { user: result.data.user, profile: profileResult.data };
    },

    adminLogout: async function() {
        if (!supabaseClient) return DemoDB.adminLogout();
        await supabaseClient.auth.signOut();
    },

    getAdminSession: async function() {
        if (!supabaseClient) return DemoDB.getAdminSession();
        var result = await supabaseClient.auth.getSession();
        if (!result.data.session) return null;
        var profileResult = await supabaseClient.from('admins').select('*').eq('id', result.data.session.user.id).single();
        return { user: result.data.session.user, profile: profileResult.data };
    }
};
