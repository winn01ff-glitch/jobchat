import { createClient } from '@supabase/supabase-js';
import { generateToken } from './helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Warning: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
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
                session_token: generateToken(),
                last_email_sent_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;

        // Trigger email notification for registration
        try {
            fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'registration',
                    applicantName: row.name,
                    applicantEmail: row.email,
                    applicantPhone: row.phone,
                    applicantPosition: row.position
                })
            }).catch(err => console.error('[Notification] failed to trigger registration email:', err));
        } catch (e) {
            console.error('[Notification] error triggering registration email:', e);
        }

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

    updateApplicant: async function (id, data) {
        const { data: row, error } = await supabaseClient
            .from('applicants')
            .update(data)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return row;
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

        // If message is sent by applicant, check if we need to send email alert
        if (senderType === 'applicant') {
            try {
                // Fetch current applicant to check last_email_sent_at
                const { data: applicant } = await supabaseClient
                    .from('applicants')
                    .select('email, phone, position, last_email_sent_at')
                    .eq('id', conversationId)
                    .single();

                if (applicant) {
                    const now = new Date();
                    const lastSent = applicant.last_email_sent_at ? new Date(applicant.last_email_sent_at) : null;
                    const oneHour = 60 * 60 * 1000;

                    if (!lastSent || (now - lastSent) > oneHour) {
                        const nowStr = now.toISOString();
                        await supabaseClient
                            .from('applicants')
                            .update({ last_email_sent_at: nowStr })
                            .eq('id', conversationId);

                        // Trigger email notification
                        fetch('/api/send-notification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'message',
                                applicantName: senderName,
                                applicantEmail: applicant.email,
                                applicantPhone: applicant.phone,
                                applicantPosition: applicant.position,
                                messageContent: content
                            })
                        }).catch(err => console.error('[Notification] failed to trigger message email:', err));
                    }
                }
            } catch (e) {
                console.error('[Notification] error in message throttling logic:', e);
            }
        }

        return data;
    },

    uploadFile: async function (conversationId, file, fileName) {
        // Generate a unique filename to prevent overwriting
        const extension = fileName.split('.').pop();
        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
        const uniqueName = `${baseName}_${Date.now()}.${extension}`;
        const path = `${conversationId}/${uniqueName}`;

        const { data, error } = await supabaseClient.storage
            .from('chat-attachments')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabaseClient.storage
            .from('chat-attachments')
            .getPublicUrl(path);

        return {
            url: publicUrl,
            name: uniqueName
        };
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
        const email = `${username.trim().toLowerCase()}@uphill.com`;
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        if (error || !data.user) {
            throw new Error('Sai tên đăng nhập hoặc mật khẩu');
        }

        // Fetch display profile from public.admins
        const { data: profile, error: profileError } = await supabaseClient
            .from('admins')
            .select('*')
            .eq('id', data.user.id)
            .single();

        const sessionData = { user: data.user, profile: profile || { id: data.user.id, username, display_name: username, avatar: '' } };
        localStorage.setItem('jobchat_admin', JSON.stringify(sessionData));
        return sessionData;
    },

    adminLogout: async function () {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('jobchat_admin');
    },

    getAdminSession: async function () {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (!session) {
            localStorage.removeItem('jobchat_admin');
            return null;
        }
        const saved = localStorage.getItem('jobchat_admin');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {}
        }
        
        // Fallback: Fetch profile if localStorage is empty but session is valid
        const { data: profile } = await supabaseClient
            .from('admins')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const sessionData = { user: session.user, profile: profile || { id: session.user.id, username: session.user.email.split('@')[0], display_name: session.user.email.split('@')[0], avatar: '' } };
        localStorage.setItem('jobchat_admin', JSON.stringify(sessionData));
        return sessionData;
    },

    updateAdminProfile: async function (adminId, data) {
        const saved = localStorage.getItem('jobchat_admin');
        let current = null;
        if (saved) {
            try {
                current = JSON.parse(saved);
            } catch (e) {}
        }

        if (data.password) {
            if (!current || !current.profile || !current.profile.username) {
                throw new Error('Không tìm thấy thông tin phiên làm việc');
            }
            // Verify current password by signing in
            const email = `${current.profile.username.trim().toLowerCase()}@uphill.com`;
            const { error: verifyError } = await supabaseClient.auth.signInWithPassword({
                email,
                password: data.currentPassword
            });
            if (verifyError) {
                throw new Error('Mật khẩu hiện tại không đúng');
            }

            const { error: pwdError } = await supabaseClient.auth.updateUser({
                password: data.password
            });
            if (pwdError) throw pwdError;
        }

        const update = {};
        if (data.display_name !== undefined) update.display_name = data.display_name;
        if (data.avatar !== undefined) update.avatar = data.avatar;

        if (Object.keys(update).length > 0) {
            const { error } = await supabaseClient
                .from('admins')
                .update(update)
                .eq('id', adminId);
            if (error) throw error;
        }

        // Update local session
        if (current) {
            if (current.profile && current.profile.id === adminId) {
                current.profile = { ...current.profile, ...update };
                localStorage.setItem('jobchat_admin', JSON.stringify(current));
            }
        }
    },

    getAllAdmins: async function () {
        const { data, error } = await supabaseClient
            .from('admins')
            .select('id, display_name, avatar, username');
        if (error) throw error;
        return data || [];
    },

    getAdminProfile: async function (adminId) {
        let query = supabaseClient.from('admins').select('id, display_name, avatar, username');
        if (adminId) query = query.eq('id', adminId);
        const { data, error } = await query.limit(1).single();
        if (error) throw error;
        return data;
    },

    // ---- Job Posts ----
    getJob: async function (id) {
        const { data, error } = await supabaseClient
            .from('job_posts')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data;
    },

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
