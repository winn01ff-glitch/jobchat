import { createClient } from '@supabase/supabase-js';
import { generateToken } from './helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Called from SupabaseProvider on app startup — just verifies connection
export async function initSupabase() {
    try {
        const { error } = await supabaseClient.from('applicants').select('id').limit(1);
        if (error) {
            console.error('[Supabase] Connection error:', error.message);
            return false;
        }
        console.log('[Supabase] Connected ✓');
        return true;
    } catch (e) {
        console.error('[Supabase] Unreachable:', e.message);
        return false;
    }
}

// ============ Database Operations ============
export const DB = {

    // ---- Applicants ----
    createApplicant: async function (data) {
        const { data: row, error } = await supabaseClient
            .from('applicants')
            .insert({
                name: data.name,
                email: data.email || '',
                phone: data.phone || '',
                position: data.position,
                language: data.language || (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi',
                status: 'active',
                session_token: generateToken()
            })
            .select()
            .single();
        if (error) throw error;
        return row;
    },

    getApplicant: async function (id) {
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

    getApplicantByToken: async function (token) {
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('*')
            .eq('session_token', token)
            .single();
        if (error) return null;
        return data;
    },

    getApplicantByEmail: async function (email) {
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('*')
            .eq('email', email)
            .single();
        if (error) return null;
        return data;
    },

    getAllApplicants: async function () {
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    updateApplicantStatus: async function (id, status) {
        const { error } = await supabaseClient
            .from('applicants')
            .update({ status })
            .eq('id', id);
        if (error) throw error;
    },

    deleteApplicant: async function (id) {
        await supabaseClient.from('messages').delete().eq('conversation_id', id);
        const { error } = await supabaseClient.from('applicants').delete().eq('id', id);
        if (error) throw error;
    },

    // ---- Messages ----
    sendMessage: async function (conversationId, senderType, senderName, senderId, content) {
        const { data, error } = await supabaseClient
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_type: senderType,
                sender_name: senderName,
                sender_id: senderId,
                content: content,
                status: 'sent'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateMessageStatus: async function (messageId, status) {
        const { error } = await supabaseClient
            .from('messages')
            .update({ status })
            .eq('id', messageId);
        if (error) console.error('updateMessageStatus error:', error.message);
    },

    markMessagesAsDelivered: async function (conversationId, senderType) {
        const { error } = await supabaseClient
            .from('messages')
            .update({ status: 'delivered' })
            .eq('conversation_id', conversationId)
            .eq('sender_type', senderType)
            .eq('status', 'sent');
        if (error) console.error('markMessagesAsDelivered error:', error.message);
    },

    markMessagesAsSeen: async function (conversationId, senderType) {
        const { error } = await supabaseClient
            .from('messages')
            .update({ status: 'seen' })
            .eq('conversation_id', conversationId)
            .eq('sender_type', senderType)
            .in('status', ['sent', 'delivered']);
        if (error) console.error('markMessagesAsSeen error:', error.message);
    },

    deleteMessage: async function (messageId) {
        const { error } = await supabaseClient
            .from('messages')
            .delete()
            .eq('id', messageId);
        if (error) throw error;
    },

    getMessages: async function (conversationId, offset = 0, limit = 20) {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) throw error;
        return (data || []).reverse();
    },

    getLastMessage: async function (conversationId) {
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) return null;
        return data;
    },

    // ---- Realtime subscriptions ----
    subscribeToMessages: function (conversationId, callback) {
        return supabaseClient
            .channel('messages:' + conversationId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'conversation_id=eq.' + conversationId
            }, (payload) => callback(payload.new))
            .subscribe();
    },

    subscribeToAllMessages: function (callback) {
        return supabaseClient
            .channel('all-messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, (payload) => callback(payload.new))
            .subscribe();
    },

    subscribeToNewApplicants: function (callback) {
        return supabaseClient
            .channel('new-applicants')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'applicants'
            }, (payload) => callback(payload.new))
            .subscribe();
    },

    unsubscribe: function (subscription) {
        if (subscription) supabaseClient.removeChannel(subscription);
    },

    // ---- Admin Auth ----
    adminLogin: async function (username, password) {
        const { data, error } = await supabaseClient
            .from('admins')
            .select('*')
            .ilike('username', username)
            .eq('password_hash', password)
            .single();
        if (error || !data) throw new Error('Sai tên đăng nhập hoặc mật khẩu');
        localStorage.setItem('jobchat_admin', JSON.stringify(data));
        return { user: { id: data.id }, profile: data };
    },

    adminLogout: async function () {
        localStorage.removeItem('jobchat_admin');
    },

    getAdminSession: async function () {
        const saved = localStorage.getItem('jobchat_admin');
        if (!saved) return null;
        try {
            const admin = JSON.parse(saved);
            return { user: { id: admin.id }, profile: admin };
        } catch (e) { return null; }
    },

    updateAdminProfile: async function (adminId, data) {
        const update = {};
        if (data.display_name !== undefined) update.display_name = data.display_name;
        if (data.avatar !== undefined) update.avatar = data.avatar;
        if (data.password_hash !== undefined) update.password_hash = data.password_hash;
        const { error } = await supabaseClient
            .from('admins')
            .update(update)
            .eq('id', adminId);
        if (error) throw error;
        // Update local session
        const saved = localStorage.getItem('jobchat_admin');
        if (saved) {
            const current = JSON.parse(saved);
            if (current.id === adminId) {
                localStorage.setItem('jobchat_admin', JSON.stringify({ ...current, ...update }));
            }
        }
    },

    getAdminProfile: async function (adminId) {
        let query = supabaseClient.from('admins').select('id, display_name, avatar, username');
        if (adminId) query = query.eq('id', adminId);
        const { data, error } = await query.limit(1).single();
        if (error) throw error;
        return data;
    },

    // ---- Job Posts ----
    getPublishedJobs: async function () {
        const { data, error } = await supabaseClient
            .from('job_posts')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    getAllJobs: async function () {
        const { data, error } = await supabaseClient
            .from('job_posts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    createJob: async function (data) {
        const { data: row, error } = await supabaseClient
            .from('job_posts')
            .insert({
                title: data.title,
                content: data.content,
                position: data.position || '',
                salary: data.salary || '',
                location: data.location || '',
                status: data.status || 'draft',
                author_id: data.author_id || '',
                author_name: data.author_name || ''
            })
            .select()
            .single();
        if (error) throw error;
        return row;
    },

    updateJob: async function (id, data) {
        data.updated_at = new Date().toISOString();
        const { data: row, error } = await supabaseClient
            .from('job_posts')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return row;
    },

    deleteJob: async function (id) {
        const { error } = await supabaseClient
            .from('job_posts')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
