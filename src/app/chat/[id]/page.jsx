'use client';
import React, { useState, useEffect, useRef, use } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotification } from '../../../context/NotificationContext';
import { DB } from '../../../lib/supabase';
import { ChatBubble, SystemMessage, TypingIndicator } from '../../../components/ChatBubble';
import { autoResize, EmojiPicker, showConfirmModal, downloadFile } from '../../../lib/helpers';

const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Keep PNG if original is PNG, otherwise compress to JPEG (common JPG format)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const ext = file.type === 'image/png' ? '.png' : '.jpg';

        canvas.toBlob(
          (blob) => {
            resolve({
              blob: blob || file,
              mimeType: mimeType,
              ext: ext
            });
          },
          mimeType,
          mimeType === 'image/jpeg' ? 0.85 : undefined
        );
      };
      img.onerror = () => resolve({ blob: file, mimeType: file.type, ext: file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg' });
    };
    reader.onerror = () => resolve({ blob: file, mimeType: file.type, ext: file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg' });
  });
};

const isAttachment = (content) => {
  if (!content) return false;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && ('type' in parsed);
  } catch (e) {
    return false;
  }
};

const formatPreviewText = (text) => {
  if (!text) return '';
  const singleLine = text.replace(/[\r\n]+/g, ' ');
  if (singleLine.length > 25) {
    return '...' + singleLine.slice(-22);
  }
  return singleLine;
};

export default function ChatPage({ params }) {
  const resolvedParams = use(params);
  const applicantId = resolvedParams.id;
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { showToast } = useNotification();

  const [showMediaSidebar, setShowMediaSidebar] = useState(false);
  const [mediaTab, setMediaTab] = useState('images'); // 'images' or 'files'
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [applicantEmail, setApplicantEmail] = useState('');
  const [showEmailBanner, setShowEmailBanner] = useState(false);
  const [showEmailReminderModal, setShowEmailReminderModal] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderOtp, setReminderOtp] = useState('');
  const [reminderOtpStep, setReminderOtpStep] = useState(false);
  const [reminderOtpLoading, setReminderOtpLoading] = useState(false);
  const [reminderOtpError, setReminderOtpError] = useState('');
  const [reminderCountdown, setReminderCountdown] = useState(0);
  const [isReminderResending, setIsReminderResending] = useState(false);

  const [messages, setMessages] = useState([]);
  const [applicantName, setApplicantName] = useState('');
  const [inputText, setInputText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [isScrollDone, setIsScrollDone] = useState(false);

  useEffect(() => {
    // Add active class for chat page layout to body and document
    document.documentElement.classList.add('chat-page-active');
    document.body.classList.add('chat-page-active');
    
    // Trigger visualViewport resize check if helper exists
    if (window.visualViewport) {
      window.dispatchEvent(new Event('resize'));
    }

    const handleGlobalClick = (e) => {
      if (!e.target.closest('.message-row') && !e.target.closest('.msg-action-btn')) {
        setActiveMessageId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick, { passive: true });

    const handleToggleMediaSidebar = () => {
      setShowMediaSidebar(prev => !prev);
    };
    window.addEventListener('chat-toggle-media-sidebar', handleToggleMediaSidebar);

    const handleAuthChange = async () => {
      const sessionStr = localStorage.getItem('jobchat_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          const applicant = await DB.getApplicantByToken(session.token);
          if (applicant) {
            setApplicantEmail(applicant.email || '');
            if (applicant.email) {
              setShowEmailBanner(false);
            }
          }
        } catch(e) {}
      }
    };
    window.addEventListener('authChange', handleAuthChange);

    return () => {
      document.documentElement.classList.remove('chat-page-active');
      document.body.classList.remove('chat-page-active');
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
      window.removeEventListener('chat-toggle-media-sidebar', handleToggleMediaSidebar);
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [adminsMap, setAdminsMap] = useState({});
  const [areActionsCollapsed, setAreActionsCollapsed] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const saveDraft = (id, val) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (val) {
          localStorage.setItem(`jobchat_draft_${id}`, val);
        } else {
          localStorage.removeItem(`jobchat_draft_${id}`);
        }
      } catch (e) {}
    }, 400);
  };

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const isProgrammaticScrolling = useRef(false);
  const lastTypingBroadcastTimeRef = useRef(0);
  const lastTypingStateRef = useRef(false);

  const getReplyText = (msg) => {
    if (!msg) return '';
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === 'image') return t('chat.image') || 'Hình ảnh';
      if (parsed.type === 'file') return parsed.name;
      if (parsed.type === 'location') return t('chat.locationShared') || 'Đã chia sẻ vị trí';
    } catch(e) {}
    return msg.content;
  };

  useEffect(() => {
    let active = true;
    let subChannel = null;

    const checkAuthAndInit = async () => {
      const sessionStr = localStorage.getItem('jobchat_session');
      if (!sessionStr) {
        if (active) router.push('/register');
        return;
      }
      try {
        const session = JSON.parse(sessionStr);
        if (session.id !== applicantId) {
          if (active) router.push('/register');
          return;
        }

        // Verify applicant still exists in database
        const applicant = await DB.getApplicantByToken(session.token);
        if (!active) return;
        if (!applicant) {
          console.warn('Session is invalid or applicant was deleted in database.');
          localStorage.removeItem('jobchat_session');
          window.dispatchEvent(new Event('authChange'));
          showToast(t('auth.errorAccountDeleted') || 'Tài khoản của bạn đã bị xóa hoặc không còn tồn tại.', 'error');
          router.push('/register');
          return;
        }

        setApplicantName(applicant.name);
        setApplicantEmail(applicant.email || '');
        const dismissed = localStorage.getItem(`jobchat_email_banner_dismissed_${applicantId}`);
        if (!applicant.email && !dismissed) {
          setShowEmailBanner(true);
        }
        const modalDismissed = sessionStorage.getItem(`jobchat_email_reminder_dismissed_${applicantId}`);
        if (!applicant.email && !modalDismissed) {
          setShowEmailReminderModal(true);
        }
        loadInitialMessages(applicantId);

        // Load cached draft
        const cachedDraft = localStorage.getItem(`jobchat_draft_${applicantId}`);
        if (cachedDraft) {
          setInputText(cachedDraft);
          if (textareaRef.current) {
            textareaRef.current.value = cachedDraft;
            // Force a synchronous resize so the user never sees a 1-line cutoff
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'; // Reset native height
                autoResize(textareaRef.current);
              }
            }, 10);
            setTimeout(() => {
              if (textareaRef.current) autoResize(textareaRef.current);
            }, 100);
          }
          setAreActionsCollapsed(false); // Actions should remain un-collapsed if there's no active typing initially, or true if we want them collapsed. Let's keep the existing behaviour but ensure resize. Wait, the user's image had them NOT collapsed. If we want them collapsed, we use setAreActionsCollapsed(true).
          // Actually, let's just leave setAreActionsCollapsed(true) as it was.
        }

        const fetchAdmins = async () => {
          try {
            const list = await DB.getAllAdmins();
            if (!active) return;
            const map = {};
            list.forEach(adm => {
              map[adm.id] = adm;
            });
            setAdminsMap(map);
          } catch(e) {}
        };
        fetchAdmins();

        if (!active) return;
        subChannel = DB.subscribeToMessages(applicantId, (msg) => {
          if (!active) return;
          const sStr = localStorage.getItem('jobchat_session');
          if (sStr) {
            try {
              const s = JSON.parse(sStr);
              if (msg.sender_type === 'applicant' && msg.sender_id === s.id) {
                return; // Prevent duplicate message from subscription
              }
            } catch(e) {}
          }
          handleNewMessage(msg);
        });
        setSubscription(subChannel);
      } catch(e) {
        if (active) {
          localStorage.removeItem('jobchat_session');
          router.push('/register');
        }
      }
    };

    checkAuthAndInit();

    return () => {
      active = false;
      if (subChannel) {
        DB.unsubscribe(subChannel);
      }
    };
  }, [applicantId]);

  // Re-measure textarea height when collapsed-height is removed (actions collapse, textarea widens)
  useEffect(() => {
    if (!areActionsCollapsed) return; // collapsed-height active → CSS !important handles height, skip
    if (!textareaRef.current || !inputText) return;
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        autoResize(textareaRef.current);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [areActionsCollapsed]);


  useEffect(() => {
    if (messages.length > 0 && applicantId) {
      const firstMsg = messages[0];
      if (firstMsg && firstMsg.conversation_id === applicantId) {
        localStorage.setItem(`jobchat_cache_msgs_${applicantId}`, JSON.stringify(messages.slice(-100)));
      }
    }
  }, [messages, applicantId]);

  useEffect(() => {
    if (!applicantId || !applicantName) return;

    const processPendingApplication = async () => {
      try {
        const jobStr = localStorage.getItem('uphill_apply_job');
        if (!jobStr) return;

        const jobInfo = JSON.parse(jobStr);
        if (!jobInfo || !jobInfo.id || !jobInfo.title) return;

        // 1. Update the DB record
        await DB.updateApplicant(applicantId, { applied_job_title: jobInfo.title });

        // 2. Send the auto-apply message
        const messageText = `【応募】この求人に応募します： "${jobInfo.title}" (https://${window.location.host}/jobs/${jobInfo.id})`;
        const actualMsg = await DB.sendMessage(applicantId, 'applicant', applicantName, applicantId, messageText);
        setMessages(prev => {
          // Prevent duplicates if already added
          if (prev.some(m => m.id === actualMsg.id || m.content === messageText)) return prev;
          return [...prev, actualMsg];
        });

        // 3. Clear from local storage
        localStorage.removeItem('uphill_apply_job');
        
        // Scroll to bottom
        setTimeout(scrollToBottom, 100);
      } catch (e) {
        console.error('[Apply Tracking] Failed to process pending application:', e);
      }
    };

    processPendingApplication();
  }, [applicantId, applicantName]);

  useEffect(() => {
    if (reminderCountdown > 0) {
      const timer = setTimeout(() => setReminderCountdown(reminderCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [reminderCountdown]);

  const handleSendReminderOtp = async () => {
    const cleanEmail = reminderEmail.trim().toLowerCase();
    if (!cleanEmail) {
      showToast(t('common.error') || 'Vui lòng nhập email', 'error');
      return;
    }
    setReminderOtpLoading(true);
    try {
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, lang: currentLang })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }
      showToast(t('register.otpSent') || 'Mã xác thực đã được gửi tới email của bạn!', 'success');
      setReminderOtpStep(true);
      setReminderOtpError('');
      setReminderCountdown(60);
    } catch (err) {
      console.error(err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại.', 'error');
    } finally {
      setReminderOtpLoading(false);
    }
  };

  const handleVerifyReminderOtp = async () => {
    const cleanEmail = reminderEmail.trim().toLowerCase();
    const cleanOtp = reminderOtp.trim();
    if (!cleanOtp) {
      setReminderOtpError(t('auth.enterOtp') || 'Vui lòng nhập mã OTP');
      return;
    }
    setReminderOtpLoading(true);
    try {
      const result = await DB.verifyOtp(cleanEmail, cleanOtp);
      if (!result || !result.success) {
        setReminderOtpError(t('register.invalidOtp') || 'Mã xác thực không chính xác.');
        return;
      }
      
      // Update email immediately in DB & LocalState
      await DB.updateApplicant(applicantId, { email: cleanEmail });
      setApplicantEmail(cleanEmail);

      // Update session Storage
      const sessionStr = localStorage.getItem('jobchat_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          session.email = cleanEmail;
          localStorage.setItem('jobchat_session', JSON.stringify(session));
        } catch (e) {}
      }

      showToast(t('auth.emailLinkedSuccess') || 'Đã liên kết email thành công!', 'success');
      setShowEmailReminderModal(false);
    } catch (err) {
      console.error(err);
      setReminderOtpError(t('common.error') || 'Đã xảy ra lỗi');
    } finally {
      setReminderOtpLoading(false);
    }
  };

  const handleReminderResendOtp = async () => {
    if (reminderCountdown > 0 || isReminderResending) return;
    const cleanEmail = reminderEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    setIsReminderResending(true);
    try {
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, lang: currentLang })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(t('auth.otpSentSuccess') || 'Mã xác thực đã được gửi lại!', 'success');
      setReminderCountdown(60);
    } catch (err) {
      console.error(err);
      showToast(t('register.sendOtpFailed') || 'Gửi lại mã thất bại.', 'error');
    } finally {
      setIsReminderResending(false);
    }
  };

  useEffect(() => {
    if (!applicantId) return;
    const channelName = `typing:${applicantId}`;
    const channel = DB.supabaseClient.channel(channelName);
    
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.sender_type === 'admin') {
          setIsPartnerTyping(payload.isTyping);
          if (payload.isTyping) {
            setPartnerName(payload.sender_name || t('chat.adminName') || 'Đội ngũ tuyển dụng');
            const adminInfo = payload.sender_id ? adminsMap[payload.sender_id] : null;
            setPartnerAvatar(adminInfo?.avatar || payload.avatar || null);
          }
        }
      })
      .subscribe();
      
    typingChannelRef.current = channel;
    
    return () => {
      DB.supabaseClient.removeChannel(channel);
    };
  }, [applicantId]);

  useEffect(() => {
    if (isPartnerTyping) {
      const container = listRef.current;
      if (container) {
        const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 250;
        if (isAtBottom) {
          setTimeout(scrollToBottom, 50);
        }
      } else {
        setTimeout(scrollToBottom, 50);
      }
    }
  }, [isPartnerTyping]);

  useEffect(() => {
    const handleClearHistory = async () => {
      try {
        await DB.clearChatHistoryLocally(applicantId, 'applicant');
        setMessages([]);
        showToast(t('chat.historyCleared') || 'Đã xóa lịch sử trò chuyện', 'success');
      } catch (err) {
        showToast(t('common.error'), 'error');
      }
    };

    window.addEventListener('chat-clear-history', handleClearHistory);
    return () => window.removeEventListener('chat-clear-history', handleClearHistory);
  }, [applicantId, t, showToast]);

  useEffect(() => {
    if (!applicantId) return;

    const interval = setInterval(async () => {
      try {
        const msgs = await DB.getMessages(applicantId, 0, 50, 'applicant');
        setMessages(prev => {
          // Use an object map to merge messages and prevent duplicates
          const prevMap = {};
          prev.forEach(m => {
            prevMap[m.id] = m;
          });

          let changed = false;
          // Check if there are any new messages or status changes
          msgs.forEach(m => {
            if (!prevMap[m.id]) {
              prevMap[m.id] = m;
              changed = true;
            } else {
              // Update status/content if changed (e.g. status goes from sending to sent)
              if (prevMap[m.id].status !== m.status || prevMap[m.id].content !== m.content) {
                prevMap[m.id] = m;
                changed = true;
              }
            }
          });

          if (!changed) return prev;

          // Detect if a new admin message was received
          const hasNewAdminMsg = msgs.length > 0 && 
            msgs[msgs.length - 1].sender_type === 'admin' && 
            !prev.some(m => m.id === msgs[msgs.length - 1].id);
            
          if (hasNewAdminMsg) {
            const container = listRef.current;
            const isAtBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight <= 150) : true;
            if (isAtBottom) {
              setTimeout(scrollToBottom, 50);
              DB.markMessagesAsSeen(applicantId, 'admin');
            } else {
              setNewMessagesCount(prevCount => prevCount + 1);
            }
          }

          const merged = Object.values(prevMap);
          merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          return merged;
        });
      } catch (e) {
        console.error('Polling failed:', e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [applicantId]);

  const loadInitialMessages = async (id) => {
    isInitialScrollDone.current = false;
    setIsScrollDone(false);

    // 1. Try loading from cache first
    const cached = localStorage.getItem(`jobchat_cache_msgs_${id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
          setMessagesOffset(parsed.length);
          setIsLoading(false);
        }
      } catch(e) {}
    }

    try {
      const msgs = await DB.getMessages(id, 0, 50, 'applicant');
      setMessages(msgs);
      setMessagesOffset(50);
      if (msgs.length < 50) setHasMoreMessages(false);
      else setHasMoreMessages(true);
      
      // Save to cache
      localStorage.setItem(`jobchat_cache_msgs_${id}`, JSON.stringify(msgs));

      setIsLoading(false);
      
      // Scroll to bottom instantly
      setTimeout(() => {
        scrollToBottom('auto');
        setIsScrollDone(true);
        setTimeout(() => {
          isInitialScrollDone.current = true;
        }, 100);
      }, 50);
      DB.markMessagesAsSeen(id, 'admin');
    } catch (err) {
      console.error('Failed to load initial chat state:', err);
      localStorage.removeItem('jobchat_session');
      router.push('/register');
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMessages || !hasMoreMessages) return;
    const container = listRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setIsLoadingMessages(true);
    
    try {
      const msgs = await DB.getMessages(applicantId, messagesOffset, 50, 'applicant');
      if (msgs.length > 0) {
        flushSync(() => {
          setMessages(prev => {
            const filtered = msgs.filter(m => !prev.some(pm => pm.id === m.id));
            return [...filtered, ...prev];
          });
          setMessagesOffset(prev => prev + msgs.length);
          if (msgs.length < 50) setHasMoreMessages(false);
        });

        // The DOM is now updated synchronously, so we can adjust scroll position immediately
        const scrollDiff = container.scrollHeight - prevScrollHeight;
        container.scrollTop = prevScrollTop + scrollDiff;
      } else {
        setHasMoreMessages(false);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleNewMessage = (msg) => {
    setMessages(prev => {
      // Prevent duplicates
      if (prev.find(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setMessagesOffset(prev => prev + 1);
    
    // If we are at the bottom, auto scroll
    const container = listRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
      if (isAtBottom || msg.sender_type === 'applicant') {
        setTimeout(scrollToBottom, 50);
      } else {
        setNewMessagesCount(prev => prev + 1);
      }
    } else {
      setTimeout(scrollToBottom, 50);
    }
    
    if (msg.sender_type === 'admin') {
      DB.markMessagesAsSeen(applicantId, 'admin');
    }
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    const handleScrollToBottom = () => {
      scrollToBottom('smooth');
    };
    window.addEventListener('chat-scroll-to-bottom', handleScrollToBottom);
    return () => {
      window.removeEventListener('chat-scroll-to-bottom', handleScrollToBottom);
    };
  }, []);


  const handleScroll = () => {
    const container = listRef.current;
    if (!container) return;
    
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 150;
    
    if (isProgrammaticScrolling.current) {
      if (!isScrolledUp) {
        isProgrammaticScrolling.current = false;
      }
      setShowScrollBtn(false);
      return;
    }

    setShowScrollBtn(isScrolledUp);
    
    if (!isScrolledUp) {
      setNewMessagesCount(0);
    }
  };

  const handleTextChange = (val) => {
    setInputText(val);
    if (applicantId) {
      saveDraft(applicantId, val);
    }
    if (val.length > 0 && !areActionsCollapsed) {
      setAreActionsCollapsed(true);
    }
    
    // Broadcast typing state (throttled to once every 2.5 seconds)
    if (typingChannelRef.current) {
      const now = Date.now();
      const isTyping = val.length > 0;
      if (isTyping !== lastTypingStateRef.current || now - lastTypingBroadcastTimeRef.current > 2500) {
        lastTypingBroadcastTimeRef.current = now;
        lastTypingStateRef.current = isTyping;
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { sender_type: 'applicant', isTyping }
        });
      }
    }
    
    // Auto-clear typing status after 3s of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (val.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        if (typingChannelRef.current) {
          typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { sender_type: 'applicant', isTyping: false }
          });
        }
      }, 3000);
    }
  };

  const handleSend = async (customContent = null, keepFocus = false) => {
    EmojiPicker.hide();
    const contentVal = typeof customContent === 'string' ? customContent : null;
    const text = (textareaRef.current?.value || inputText).trim();
    if (!text && !contentVal) return;
    
    let payload = null;
    if (replyToMessage) {
      payload = {
        reply_to: {
          id: replyToMessage.id,
          content: replyToMessage.content,
          sender_name: replyToMessage.sender_name || (replyToMessage.sender_type === 'admin' ? t('chat.adminName') : applicantName),
          sender_id: replyToMessage.sender_id || (replyToMessage.sender_type === 'admin' ? 'admin' : applicantId)
        }
      };
      setReplyToMessage(null);
    }

    const tempId = 'temp-' + Date.now();
    const newMsg = {
      id: tempId,
      content: contentVal || text,
      sender_type: 'applicant',
      sender_name: applicantName,
      created_at: new Date().toISOString(),
      status: 'sending',
      payload: payload
    };
    
    setMessages(prev => [...prev, newMsg]);
    
    // Immediately clear typing state on sending
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_type: 'applicant', isTyping: false }
      });
    }

    if (!isAttachment(contentVal)) {
      setInputText('');
      if (applicantId) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        localStorage.removeItem(`jobchat_draft_${applicantId}`);
      }
      setAreActionsCollapsed(false);
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
        if (keepFocus) {
          textareaRef.current.focus({ preventScroll: true });
        }
      }
    }
    setTimeout(scrollToBottom, 50);

    try {
      const actualMsg = await DB.sendMessage(applicantId, 'applicant', applicantName, applicantId, contentVal || text, payload);
       // Replace temp with actual, carrying over tempId to keep React key stable
      setMessages(prev => prev.map(m => m.id === tempId ? { ...actualMsg, tempId: tempId } : m));
    } catch(err) {
      console.error('Send failed', err);
      if (err && (err.code === '23503' || err.code === '42501' || (err.message && (err.message.includes('foreign key') || err.message.includes('permission') || err.message.includes('policy'))))) {
        showToast(t('auth.errorAccountDeleted') || 'Tài khoản của bạn đã bị xóa hoặc không còn tồn tại.', 'error');
        localStorage.removeItem('jobchat_session');
        window.dispatchEvent(new Event('authChange'));
        router.push('/register');
        return;
      }
      showToast(t('common.error'), 'error');
      // Mark as failed
      setMessages(prev => prev.map(m => m.id === tempId ? {...m, status: 'failed'} : m));
    }
  };

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast(t('chat.fileTooLarge') || 'Kích thước tập tin vượt quá giới hạn (Tối đa 10MB)', 'error');
      e.target.value = '';
      return;
    }
    
    showToast(t('chat.uploading') || 'Đang tải lên...', 'info');
    
    try {
      let fileToUpload = file;
      let uploadName = file.name;
      
      if (type === 'image') {
        // Compress image client-side to JPG/PNG
        const { blob, mimeType, ext } = await compressImage(file);
        const baseName = file.name.includes('.') ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name;
        uploadName = `${baseName}${ext}`;
        fileToUpload = new File([blob], uploadName, { type: mimeType });
      }

      // Upload file to Supabase Storage
      const uploadResult = await DB.uploadFile(applicantId, fileToUpload, uploadName);
      
      const content = JSON.stringify({
        type: type,
        url: uploadResult.url,
        name: uploadResult.name,
        size: fileToUpload.size,
        mimeType: fileToUpload.type
      });
      
      handleSend(content, window.expandBtnFocused);
      showToast(t('chat.uploadSuccess') || 'Tải lên thành công!', 'success');
    } catch (err) {
      console.error('File upload failed:', err);
      showToast(t('chat.uploadFailed') || 'Tải lên thất bại, vui lòng thử lại.', 'error');
    } finally {
      e.target.value = ''; // Reset input
    }
  };

  const handleLocationSend = () => {
    if (!navigator.geolocation) {
      showToast(t('chat.locationNotSupported') || 'Trình duyệt không hỗ trợ Vị trí', 'error');
      return;
    }
    showToast(t('chat.gettingLocation') || 'Đang lấy vị trí...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const content = JSON.stringify({
          type: 'location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        handleSend(content, window.expandBtnFocused);
      },
      (err) => {
        showToast(t('chat.locationError') || 'Không thể lấy vị trí', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const isMobileOrTablet = typeof window !== 'undefined' && (
        /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && /Macintosh|MacIntel/.test(navigator.userAgent))
      );
      if (!isMobileOrTablet && !e.shiftKey) {
        e.preventDefault();
        handleSend(null, true);
      }
    }
  };

  const getSharedMedia = () => {
    const list = [];
    messages.forEach(m => {
      try {
        const parsed = JSON.parse(m.content);
        if (parsed.type === 'image' || parsed.type === 'file') {
          list.push({ id: m.id, ...parsed });
        }
      } catch(e) {}
    });
    return list.reverse();
  };

  const mediaList = getSharedMedia();

  const handleDismissEmailBanner = () => {
    setShowEmailBanner(false);
    localStorage.setItem(`jobchat_email_banner_dismissed_${applicantId}`, 'true');
  };

  if (isLoading) {
    return <div className="chat-container"><div className="spinner"></div></div>;
  }

  return (
    <div className="chat-container" style={{ flexDirection: 'row' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        {showEmailBanner && !applicantEmail && (
          <div 
            className="email-banner" 
            style={{
              background: 'rgba(255, 152, 0, 0.08)',
              borderBottom: '1px solid rgba(255, 152, 0, 0.2)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              zIndex: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>✉️</span>
              <span>
                {lang === 'vi' 
                  ? 'Liên kết Email trong phần Cài đặt để nhận thông báo tức thì khi nhà tuyển dụng nhắn tin.'
                  : lang === 'ja'
                  ? '設定でメールアドレスを連携すると、採用担当者からメッセージが届いた際に通知を受け取れます。'
                  : 'Link your Email in Settings to receive instant notifications when the employer messages you.'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('chat-open-applicant-settings'))}
                style={{
                  background: 'var(--messenger-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {lang === 'vi' ? 'Cài đặt' : lang === 'ja' ? '設定' : 'Settings'}
              </button>
              <button 
                onClick={handleDismissEmailBanner}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '2px'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {connectionStatus !== 'online' && (
          <div className={`network-banner ${connectionStatus}`}>
            {connectionStatus === 'offline' && (t('chat.networkOffline') || '⚠️ Không có kết nối mạng. Vui lòng kiểm tra lại thiết bị.')}
            {connectionStatus === 'reconnecting' && (t('chat.networkReconnecting') || '🔄 Đang kết nối lại...')}
            {connectionStatus === 'connected' && (t('chat.networkConnected') || '🟢 Đã kết nối lại thành công!')}
          </div>
        )}

        <div 
          className="chat-messages" 
          id="chat-messages" 
          ref={listRef} 
          onScroll={handleScroll}
          onClick={() => textareaRef.current?.blur()}
          onTouchStart={() => textareaRef.current?.blur()}
          style={{ opacity: isScrollDone ? 1 : 0, transition: 'none' }}
        >
          <div className="chat-messages-inner">
            <div className="chat-welcome">
              <div className="chat-welcome-icon">💬</div>
              <h3>{t('chat.welcomeTitle')}</h3>
              <p>{t('chat.welcomeMsg')}</p>
            </div>
            {hasMoreMessages && (
              <div style={{ textAlign: 'center', margin: '15px 0' }}>
                <button 
                  onClick={loadMoreMessages} 
                  disabled={isLoadingMessages}
                  className="btn-load-more"
                  style={{
                    background: 'rgba(0, 132, 255, 0.08)',
                    color: 'var(--messenger-blue)',
                    border: '1px solid rgba(0, 132, 255, 0.15)',
                    borderRadius: '20px',
                    padding: '6px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {isLoadingMessages ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                      <svg style={{ animation: 'spin 1s linear infinite', width: '14px', height: '14px', color: 'var(--messenger-blue)' }} viewBox="0 0 24 24" fill="none">
                        <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('chat.loading') || 'Đang tải...'}
                    </span>
                  ) : (
                    t('chat.loadMore') || 'Tải thêm tin nhắn cũ'
                  )}
                </button>
              </div>
            )}
            
            {messages.filter(msg => !msg.deleted_by_applicant).map((msg, index, filteredMsgs) => {
              let showDateSeparator = false;
              let dateLabel = '';
              const d = new Date(msg.created_at);
              const today = new Date();
              
              if (index === 0) {
                showDateSeparator = true;
              } else {
                const prevD = new Date(filteredMsgs[index - 1].created_at);
                if (d.toDateString() !== prevD.toDateString()) {
                  showDateSeparator = true;
                }
              }
              
              if (showDateSeparator) {
                if (d.toDateString() === today.toDateString()) {
                  dateLabel = t('chat.today') || 'Hôm nay';
                } else {
                  const yesterday = new Date(today);
                  yesterday.setDate(today.getDate() - 1);
                  if (d.toDateString() === yesterday.toDateString()) {
                    dateLabel = t('chat.yesterday') || 'Hôm qua';
                  } else {
                    dateLabel = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
                  }
                }
              }

              let isLastInGroup = true;
              const nextMsg = filteredMsgs[index + 1];
              if (nextMsg) {
                const nextD = new Date(nextMsg.created_at);
                const isSameSender = nextMsg.sender_type === msg.sender_type && 
                                     (msg.sender_type !== 'admin' || nextMsg.sender_id === msg.sender_id);
                if (isSameSender && nextD.toDateString() === d.toDateString()) {
                  isLastInGroup = false;
                }
              }

              let isFirstInGroup = true;
              const prevMsg = filteredMsgs[index - 1];
              if (prevMsg) {
                const prevD = new Date(prevMsg.created_at);
                const isSameSender = prevMsg.sender_type === msg.sender_type && 
                                     (msg.sender_type !== 'admin' || prevMsg.sender_id === msg.sender_id);
                if (isSameSender && prevD.toDateString() === d.toDateString()) {
                  isFirstInGroup = false;
                }
              }

              // AdminInfo is matched by sender_id from adminsMap
              const msgAdminInfo = msg.sender_type === 'admin' ? (adminsMap[msg.sender_id] || { display_name: msg.sender_name || t('chat.adminName') }) : null;

              return (
                <React.Fragment key={msg.tempId || msg.id}>
                  {showDateSeparator && (
                    <div className="date-separator">
                      <span>{dateLabel}</span>
                    </div>
                  )}
                  <ChatBubble 
                    msg={msg} 
                    isSent={msg.sender_type === 'applicant'} 
                    showSender={msg.sender_type === 'admin' ? isFirstInGroup : false} 
                    showAvatar={isLastInGroup}
                    adminInfo={msgAdminInfo}
                    onDelete={async (msgId) => {
                      try {
                        await DB.deleteMessageLocally(msgId, 'applicant');
                        setMessages(prev => prev.filter(m => m.id !== msgId));
                        showToast(t('chat.deleted') || 'Đã xóa', 'success');
                      } catch(e) {
                        showToast(t('common.error'), 'error');
                      }
                    }}
                    onReply={(replyMsg) => setReplyToMessage(replyMsg)}
                    activeMessageId={activeMessageId}
                    setActiveMessageId={setActiveMessageId}
                    onImageClick={(img) => setActiveLightboxImage(img)}
                  />
                </React.Fragment>
              );
            })}
            {isPartnerTyping && (
              <TypingIndicator name={partnerName || t('chat.adminName') || 'Đội ngũ tuyển dụng'} avatar={partnerAvatar} />
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {showScrollBtn && (
          <button 
            className={`scroll-bottom-btn ${newMessagesCount > 0 ? 'new-msg' : ''}`}
            onClick={() => {
              isProgrammaticScrolling.current = true;
              setShowScrollBtn(false);
              scrollToBottom();
              setNewMessagesCount(0);
            }}
            style={newMessagesCount === 0 ? {
              width: '32px',
              height: '32px',
              padding: 0,
              justifyContent: 'center',
              borderRadius: '50%'
            } : {}}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
            {newMessagesCount > 0 && (
              <span>
                {newMessagesCount} {t('chat.newMessages') || 'tin nhắn mới'}
              </span>
            )}
          </button>
        )}

        {replyToMessage && (
          <div className="reply-bar-container">
            <div className="reply-bar-inner">
              <div className="reply-bar-info">
                <div className="reply-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--messenger-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v2.5"/></svg>
                  <span>
                    {t('chat.replyingTo') || 'Đang trả lời'}{' '}
                    {replyToMessage.sender_id === applicantId 
                      ? (t('chat.replyToSelf') || 'chính mình') 
                      : (replyToMessage.sender_name || t('chat.adminName'))}
                  </span>
                </div>
                <div className="reply-bar-content">
                  {getReplyText(replyToMessage)}
                </div>
              </div>
              <button className="reply-bar-close" onClick={() => setReplyToMessage(null)}>
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="chat-input-bar">
          <div className="chat-input-container">
            <input type="file" id="chat-file-upload" style={{display:'none'}} ref={fileInputRef} onChange={e => handleFileSelect(e, 'file')} />
            <input type="file" id="chat-image-upload" accept="image/*" style={{display:'none'}} ref={imageInputRef} onChange={e => handleFileSelect(e, 'image')} />
            <button 
              className={`chat-action-btn expand-btn ${areActionsCollapsed ? 'active' : ''}`}
              title="Mở rộng" 
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onClick={() => {
                setAreActionsCollapsed(false);
                if (textareaRef.current) {
                  textareaRef.current.scrollTop = 0;
                  textareaRef.current.setSelectionRange(0, 0);
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            
            <div className={`chat-actions ${areActionsCollapsed ? 'collapsed' : ''}`}>
              <button 
                className="chat-action-btn" 
                title={t('chat.attachFile') || 'Đính kèm file'} 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <button 
                className="chat-action-btn" 
                title={t('chat.sendImage') || 'Gửi ảnh'} 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => imageInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              </button>
              <button 
                className="chat-action-btn" 
                title={t('chat.sendLocation') || 'Gửi vị trí'} 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={handleLocationSend}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </button>
            </div>

            <div className="chat-input-wrapper" style={{flex:1, display:'flex', alignItems:'center', background:'var(--bg-input)', borderRadius:'20px', paddingRight:'4px'}}>
              <div 
                style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}
                onClick={() => {
                  textareaRef.current?.focus();
                }}
              >
                <textarea 
                  id="chat-input"
                  ref={textareaRef}
                  value={inputText}
                  className={`chat-input ${!areActionsCollapsed ? 'collapsed-height' : ''}`}
                  placeholder={t('chat.placeholder') || 'Nhắn tin...'}
                  wrap="soft"
                  onFocus={(e) => {
                    setIsInputFocused(true);
                    setAreActionsCollapsed(true);
                    setTimeout(() => scrollToBottom('smooth'), 100);
                    setTimeout(() => scrollToBottom('smooth'), 300);
                    
                    const el = e.target;
                    const val = el.value;
                    setTimeout(() => {
                      el.setSelectionRange(val.length, val.length);
                      el.scrollTop = el.scrollHeight;
                    }, 10);
                  }}
                  onBlur={() => {
                    setIsInputFocused(false);
                    setAreActionsCollapsed(false);
                    if (textareaRef.current) {
                      textareaRef.current.scrollTop = 0;
                    }
                  }}
                  onClick={() => {
                    if (!areActionsCollapsed) {
                      // Returning from collapsed view → move cursor to end
                      setTimeout(() => {
                        if (textareaRef.current) {
                          const len = textareaRef.current.value.length;
                          textareaRef.current.setSelectionRange(len, len);
                          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                        }
                      }, 10);
                    }
                    setAreActionsCollapsed(true);
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleTextChange(val);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  rows="1"
                  style={{
                    background: 'transparent', 
                    margin: 0, 
                    flex: 1, 
                    border: 'none', 
                    outline: 'none', 
                    resize: 'none', 
                    overflowX: 'hidden',
                    overflowY: 'auto', 
                    maxHeight: '120px',
                    color: 'var(--text-primary)',
                  }}
                ></textarea>
              </div>
              <button 
                className="emoji-toggle-btn" 
                onMouseDown={(e) => {
                  e.preventDefault();
                  window.emojiToggleFocused = (document.activeElement === textareaRef.current);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  window.emojiToggleFocused = (document.activeElement === textareaRef.current);
                }}
                onClick={(e) => EmojiPicker.toggle('chat-input', e.currentTarget, window.emojiToggleFocused)}
              >
                😊
              </button>
            </div>
            <button 
              className="btn-send" 
              onMouseDown={() => {
                window.sendButtonFocused = (document.activeElement === textareaRef.current);
              }}
              onTouchStart={() => {
                window.sendButtonFocused = (document.activeElement === textareaRef.current);
              }}
              onClick={() => handleSend(inputText.trim() ? null : '👍', window.sendButtonFocused)}
            >
              {inputText.trim() ? (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21.72 11.27l-18-9c-.53-.26-1.16-.16-1.58.26-.42.42-.52 1.05-.26 1.58l3.62 7.24a1 1 0 0 0 .89.55h8.11c.55 0 1 .45 1 1s-.45 1-1 1H6.39a1 1 0 0 0-.89.55l-3.62 7.24c-.26.53-.16 1.16.26 1.58.29.29.69.45 1.09.45.17 0 .34-.03.5-.1l18-9c.67-.34.94-1.15.6-1.82-.14-.28-.38-.52-.66-.66z"/></svg>
              ) : (
                <span style={{ fontSize: '22px', lineHeight: '1', display: 'block', userSelect: 'none' }}>👍</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className={`chat-media-sidebar ${showMediaSidebar ? 'active' : ''}`}>
        <div className="media-sidebar-header">
          <h4>{t('admin.sharedMedia') || 'Ảnh & Tập tin'}</h4>
          <button onClick={() => setShowMediaSidebar(false)}>✕</button>
        </div>
        <div className="media-sidebar-tabs">
          <button 
            className={`media-tab-btn ${mediaTab === 'images' ? 'active' : ''}`}
            onClick={() => setMediaTab('images')}
          >
            {t('admin.mediaImages') || 'Hình ảnh'}
          </button>
          <button 
            className={`media-tab-btn ${mediaTab === 'files' ? 'active' : ''}`}
            onClick={() => setMediaTab('files')}
          >
            {t('admin.mediaFiles') || 'Tập tin'}
          </button>
        </div>
        <div className="media-sidebar-content">
          {mediaTab === 'images' ? (
            mediaList.filter(item => item.type === 'image').length === 0 ? (
              <div className="media-empty">{t('admin.noImages') || 'Chưa có hình ảnh chia sẻ.'}</div>
            ) : (
              <div className="media-grid">
                {mediaList.filter(item => item.type === 'image').map(item => (
                  <img 
                    key={item.id} 
                    src={item.url || item.data} 
                    alt={item.name} 
                    className="media-grid-item-image"
                    onClick={() => setActiveLightboxImage(item)}
                  />
                ))}
              </div>
            )
          ) : (
            mediaList.filter(item => item.type === 'file').length === 0 ? (
              <div className="media-empty">{t('admin.noFiles') || 'Chưa có tập tin chia sẻ.'}</div>
            ) : (
              <div className="media-files-list">
                {mediaList.filter(item => item.type === 'file').map(item => (
                  <a 
                    key={item.id} 
                    href={item.url || item.data} 
                    download={item.name}
                    className="media-grid-item-file"
                    target="_blank"
                    rel="noreferrer"
                  >
                    📄 {item.name}
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {activeLightboxImage && (
        <div 
          className="lightbox-overlay" 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', 
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setActiveLightboxImage(null)}
        >
          <img 
            src={activeLightboxImage.url || activeLightboxImage.data} 
            alt={activeLightboxImage.name} 
            style={{ maxWidth: '90%', maxHeight: '80%', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} 
            onClick={e => e.stopPropagation()}
          />
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => downloadFile(activeLightboxImage.url || activeLightboxImage.data, activeLightboxImage.name)} 
              className="btn-download"
              style={{
                background: 'var(--messenger-blue)', color: 'white', border: 'none', 
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px', 
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              {t('chat.download') || 'Tải xuống'}
            </button>
          </div>
        </div>
      )}

      {showEmailReminderModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            position: 'relative'
          }}>
            <button 
              onClick={() => {
                sessionStorage.setItem(`jobchat_email_reminder_dismissed_${applicantId}`, 'true');
                setShowEmailReminderModal(false);
              }}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px'
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✉️</div>
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {t('auth.emailRegisterTitle') || 'Cài đặt Email nhận thông báo & bảo mật'}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {t('auth.emailRegisterNote') || 'Vui lòng liên kết email của bạn để nhận thông báo tức thì từ nhà tuyển dụng và có thể tự khôi phục mật khẩu khi quên.'}
              </p>
            </div>

            {!reminderOtpStep ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '600' }}>
                    Email <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <div className="input-with-icon">
                    <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </span>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={reminderEmail}
                      onChange={e => setReminderEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      disabled={reminderOtpLoading}
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  onClick={handleSendReminderOtp}
                  disabled={reminderOtpLoading || !reminderEmail.trim()}
                  className="btn-primary"
                  style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                >
                  {reminderOtpLoading ? <div className="spinner" style={{ width: '18px', height: '18px' }}></div> : (t('auth.sendOtp') || 'Gửi mã xác thực (OTP)')}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ color: 'var(--messenger-blue)', fontWeight: '600' }}>
                    {t('auth.enterOtp') || 'Mã xác thực (OTP)'} <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="input-with-icon" style={{ flex: 1 }}>
                      <span className="input-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M12 6v6l4 2"></path></svg>
                      </span>
                      <input 
                        type="text" 
                        maxLength={6}
                        className={`form-input ${reminderOtpError ? 'error' : ''}`}
                        required 
                        value={reminderOtp}
                        onChange={e => setReminderOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder={t('auth.otpPlaceholder') || 'Nhập 6 chữ số'}
                        disabled={reminderOtpLoading}
                        style={{ letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReminderOtpStep(false);
                        setReminderOtp('');
                        setReminderOtpError('');
                      }}
                      className="btn-secondary"
                      style={{ padding: '0 16px', fontSize: '13px', borderRadius: '20px' }}
                    >
                      {t('common.back') || 'Quay lại'}
                    </button>
                  </div>
                  {reminderOtpError && <div className="form-error" style={{ marginTop: '6px' }}>{reminderOtpError}</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', fontSize: '13px' }}>
                  {reminderCountdown > 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t('register.resendCountdown') ? t('register.resendCountdown').replace('{seconds}', reminderCountdown) : `Gửi lại mã sau ${reminderCountdown}s`}
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleReminderResendOtp}
                      disabled={isReminderResending}
                      style={{
                        background: 'none', border: 'none', 
                        color: 'var(--messenger-blue)', fontSize: '13px', cursor: 'pointer',
                        textDecoration: 'underline', padding: 0
                      }}
                    >
                      {isReminderResending ? '...' : (t('register.resendOtp') || 'Gửi lại mã OTP')}
                    </button>
                  )}
                </div>

                <button 
                  type="button" 
                  onClick={handleVerifyReminderOtp}
                  disabled={reminderOtpLoading || reminderOtp.length < 6}
                  className="btn-primary"
                  style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                >
                  {reminderOtpLoading ? <div className="spinner" style={{ width: '18px', height: '18px' }}></div> : (t('auth.confirmAndRegister') || 'Xác thực & Hoàn thành')}
                </button>
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="button"
                onClick={() => {
                  sessionStorage.setItem(`jobchat_email_reminder_dismissed_${applicantId}`, 'true');
                  setShowEmailReminderModal(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {t('common.later') || 'Để sau'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
