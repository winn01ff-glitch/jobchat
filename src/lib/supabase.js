import { createClient } from '@supabase/supabase-js';
import { generateToken } from './helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Warning: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
}


const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const guestClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

const getClient = () => {
    if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/admin') || path.startsWith('/login')) {
            return adminClient;
        }
    }
    return guestClient;
};

export const supabaseClient = new Proxy({}, {
    get(target, prop) {
        const client = getClient();
        const value = client[prop];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    }
});

const setSessionHeader = () => {
    if (typeof window !== 'undefined') {
        const sessionStr = localStorage.getItem('jobchat_session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                if (session.token) {
                    guestClient.rest.headers.set('x-session-token', session.token);
                    return;
                }
            } catch (e) {}
        }
    }
    guestClient.rest.headers.delete('x-session-token');
};

const originalFrom = guestClient.from;
guestClient.from = function (table) {
    setSessionHeader();
    return originalFrom.call(this, table);
};

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
    supabaseClient,

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
                last_email_sent_at: null
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
        const { data: sessionData, error: sessionError } = await supabaseClient
            .from('applicant_sessions')
            .select('applicant_id')
            .eq('token', token)
            .single();
        if (sessionError || !sessionData) return null;

        const { data: applicantData, error: applicantError } = await supabaseClient
            .from('applicants')
            .select('*')
            .eq('id', sessionData.applicant_id)
            .single();
        if (applicantError) return null;
        return applicantData;
    },

    getApplicantByEmail: async function (email) {
        const clean = (email || '').trim().toLowerCase();
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('*')
            .ilike('email', clean)
            .single();
        if (error) return null;
        return data;
    },

    verifyOtp: async function (email, code) {
        const clean = (email || '').trim().toLowerCase();
        const { data, error } = await supabaseClient
            .rpc('verify_otp', { email_param: clean, code_param: code });
        if (error) throw error;
        return data;
    },

    registerNewApplicant: async function (data) {
        const { data: result, error } = await supabaseClient
            .rpc('register_new_applicant', {
                name_param: data.name,
                email_param: data.email,
                phone_param: data.phone || '',
                position_param: data.position || 'other',
                lang_param: data.language || 'vi'
            });
        if (error) throw error;
        return result;
    },

    checkLoginIdExists: async function (loginId) {
        const clean = (loginId || '').trim().toLowerCase();
        const { data, error } = await supabaseClient
            .rpc('check_login_id_exists', { id_param: clean });
        if (error) return false;
        return !!data;
    },

    registerApplicantWithPassword: async function (data) {
        const cleanLoginId = (data.loginId || '').trim().toLowerCase();
        const cleanEmail = (data.email || '').trim().toLowerCase();

        const { data: result, error } = await supabaseClient
            .rpc('register_applicant_with_password', {
                name_param: data.name,
                id_param: cleanLoginId,
                pw_hash: data.passwordHash,
                email_param: cleanEmail || null,
                phone_param: data.phone || '',
                position_param: data.position || 'other',
                lang_param: data.language || 'vi'
            });

        if (error) throw error;
        return result;
    },

    loginApplicantWithPassword: async function (loginId, passwordHash) {
        const cleanId = (loginId || '').trim().toLowerCase();
        const { data, error } = await supabaseClient
            .rpc('login_applicant_with_password', {
                id_param: cleanId,
                pw_hash: passwordHash
            });

        if (error) {
            throw new Error(error.message || 'Sai tên đăng nhập hoặc mật khẩu');
        }
        return data;
    },

    requestPasswordReset: async function (loginId) {
        const cleanId = (loginId || '').trim().toLowerCase();
        const { data: email, error } = await supabaseClient
            .rpc('get_email_by_login_id', { id_param: cleanId });

        if (error) throw error;
        if (email === undefined || email === null) {
            // Check if user exists but has no email to give correct error key
            const exists = await this.checkLoginIdExists(cleanId);
            if (!exists) {
                return { success: false, error: 'not_found' };
            }
            return { success: false, error: 'no_email' };
        }
        return { success: true, email: email };
    },

    resetPasswordWithOtp: async function (loginId, otp, newPasswordHash) {
        const cleanId = (loginId || '').trim().toLowerCase();
        const { data: success, error } = await supabaseClient
            .rpc('reset_password_with_otp', {
                id_param: cleanId,
                otp_param: otp,
                pw_hash_param: newPasswordHash
            });

        if (error) {
            throw new Error(error.message || 'Đặt lại mật khẩu thất bại');
        }
        return success;
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

    verifyApplicantPassword: async function (id, passwordHash) {
        const { data, error } = await supabaseClient
            .from('applicants')
            .select('password_hash')
            .eq('id', id)
            .maybeSingle();
        if (error || !data) return false;
        return data.password_hash === passwordHash;
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

    deleteConversation: async function (id) {
        const { error } = await supabaseClient
            .from('messages')
            .update({ deleted_by_admin: true })
            .eq('conversation_id', id);
        if (error) throw error;
    },

    // ---- Messages ----
    sendMessage: async function (conversationId, senderType, senderName, senderId, content, payload = null) {
        const insertData = {
            conversation_id: conversationId,
            sender_type: senderType,
            sender_name: senderName,
            sender_id: senderId,
            content: content,
            status: 'sent'
        };
        if (payload) {
            insertData.payload = payload;
        }
        const { data, error } = await supabaseClient
            .from('messages')
            .insert(insertData)
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

        // If message is sent by admin, check if we need to send email alert to applicant
        if (senderType === 'admin') {
            try {
                // Fetch current applicant to check last_applicant_email_sent_at and email
                const { data: applicant } = await supabaseClient
                    .from('applicants')
                    .select('name, email, last_applicant_email_sent_at')
                    .eq('id', conversationId)
                    .single();

                if (applicant && applicant.email) {
                    const now = new Date();
                    const lastSent = applicant.last_applicant_email_sent_at ? new Date(applicant.last_applicant_email_sent_at) : null;
                    const oneHour = 60 * 60 * 1000;

                    if (!lastSent || (now - lastSent) > oneHour) {
                        const nowStr = now.toISOString();
                        await supabaseClient
                            .from('applicants')
                            .update({ last_applicant_email_sent_at: nowStr })
                            .eq('id', conversationId);

                        // Trigger email notification to applicant
                        fetch('/api/send-notification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'admin_message',
                                applicantName: applicant.name,
                                applicantEmail: applicant.email,
                                senderName: senderName,
                                messageContent: content
                            })
                        }).catch(err => console.error('[Notification] failed to trigger admin message email:', err));
                    }
                }
            } catch (e) {
                console.error('[Notification] error in applicant message throttling logic:', e);
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

    deleteMessageLocally: async function (messageId, userType) {
        const updateData = {};
        if (userType === 'admin') {
            updateData.deleted_by_admin = true;
        } else {
            updateData.deleted_by_applicant = true;
        }
        const { error } = await supabaseClient
            .from('messages')
            .update(updateData)
            .eq('id', messageId);
        if (error) throw error;
    },

    clearChatHistoryLocally: async function (conversationId, userType) {
        const updateData = {};
        if (userType === 'admin') {
            updateData.deleted_by_admin = true;
        } else {
            updateData.deleted_by_applicant = true;
        }
        const { error } = await supabaseClient
            .from('messages')
            .update(updateData)
            .eq('conversation_id', conversationId);
        if (error) throw error;
    },

    getMessages: async function (conversationId, offset = 0, limit = 20, userType = null) {
        let query = supabaseClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId);
            
        if (userType === 'admin') {
            query = query.eq('deleted_by_admin', false);
        } else if (userType === 'applicant') {
            query = query.eq('deleted_by_applicant', false);
        }

        const { data, error } = await query
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
            .eq('deleted_by_admin', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) return null;
        return data;
    },

    // ---- Realtime subscriptions ----
    subscribeToMessages: function (conversationId, callback) {
        const channelName = `messages:${conversationId}:${Math.random().toString(36).substring(2, 9)}`;
        return supabaseClient
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: 'conversation_id=eq.' + conversationId
            }, (payload) => callback(payload.new))
            .subscribe();
    },

    subscribeToAllMessages: function (callback) {
        const channelName = `all-messages:${Math.random().toString(36).substring(2, 9)}`;
        return supabaseClient
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages'
            }, (payload) => callback(payload.new))
            .subscribe();
    },

    subscribeToApplicants: function (callback) {
        const channelName = `applicants-realtime:${Math.random().toString(36).substring(2, 9)}`;
        return supabaseClient
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'applicants'
            }, (payload) => callback(payload))
            .subscribe();
    },

    subscribeToTyping: function (conversationId, callback) {
        const channelName = `typing:${conversationId}`;
        const channel = supabaseClient.channel(channelName);
        channel
            .on('broadcast', { event: 'typing' }, ({ payload }) => callback(payload))
            .subscribe();
        return channel;
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
        let session = null;
        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) {
                console.warn('[Admin Auth] getSession error:', error.message);
            } else if (data) {
                session = data.session;
            }
        } catch (e) {
            console.error('[Admin Auth] getSession exception:', e);
        }
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
