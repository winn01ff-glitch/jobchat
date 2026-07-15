import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { DB } from '../lib/supabase';
import { ChatBubble, SystemMessage, TypingIndicator } from './ChatBubble';
import { autoResize, EmojiPicker, showConfirmModal, downloadFile } from '../lib/helpers';

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

export default function AdminChat({ applicantId, onBack, onDelete, adminSession, isSidebarCollapsed, onToggleSidebar, onApplicantUpdate, isPartnerTyping }) {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  
  const [applicant, setApplicant] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [isScrollDone, setIsScrollDone] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.message-row') && !e.target.closest('.msg-action-btn')) {
        setActiveMessageId(null);
      }
      
      // Close canned responses popup when clicking outside
      if (!e.target.closest('.canned-popup') && !e.target.closest('.canned-toggle-btn')) {
        setShowCannedPopup(false);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('touchstart', handleGlobalClick, { passive: true });
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('touchstart', handleGlobalClick);
    };
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showMediaSidebar, setShowMediaSidebar] = useState(false);
  const [mediaTab, setMediaTab] = useState('images'); // 'images' or 'files'
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);
  const [showCannedPopup, setShowCannedPopup] = useState(false);
  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);
  const autoCollapsedRef = useRef(false);

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
  const [adminsMap, setAdminsMap] = useState({});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [areActionsCollapsed, setAreActionsCollapsed] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const isInitialScrollDone = useRef(false);
  const isProgrammaticScrolling = useRef(false);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const list = await DB.getAllAdmins();
        const map = {};
        list.forEach(adm => {
          map[adm.id] = adm;
        });
        setAdminsMap(map);
      } catch(e) {}
    };
    fetchAdmins();
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowMoreMenu(false);
    if (showMoreMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreMenu]);

  useEffect(() => {
    if (showMediaSidebar) {
      if (typeof window !== 'undefined' && window.innerWidth <= 1024 && !isSidebarCollapsed) {
        autoCollapsedRef.current = true;
        if (onToggleSidebar) onToggleSidebar();
      }
    } else {
      if (autoCollapsedRef.current && isSidebarCollapsed) {
        if (onToggleSidebar) onToggleSidebar();
      }
      autoCollapsedRef.current = false;
    }
  }, [showMediaSidebar]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const sidebar = document.querySelector('.chat-media-sidebar');
      if (
        sidebar && 
        !sidebar.contains(e.target) && 
        !e.target.closest('.header-dropdown-item') && 
        !e.target.closest('.confirm-modal-overlay') && 
        !e.target.closest('.lightbox-overlay')
      ) {
        setShowMediaSidebar(false);
      }
    };
    if (showMediaSidebar) {
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMediaSidebar]);

  useEffect(() => {
    let active = true;
    let sub;
    const load = async () => {
      setIsLoading(true);

      // 1. Try loading from cache first
      const cached = localStorage.getItem(`jobchat_cache_msgs_${applicantId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setMessages(parsed);
            setMessagesOffset(parsed.length);
            setIsLoading(false);
          }
        } catch(e) {}
      } else {
        setMessages([]);
        setMessagesOffset(0);
      }

      try {
        const app = await DB.getApplicant(applicantId);
        if (!active) return;
        setApplicant(app);
        
        isInitialScrollDone.current = false;
        setIsScrollDone(false);
        const msgs = await DB.getMessages(applicantId, 0, 50, 'admin');
        if (!active) return;
        setMessages(msgs);
        setMessagesOffset(50);
        if (msgs.length < 50) setHasMoreMessages(false);
        else setHasMoreMessages(true);

        // Save to cache
        localStorage.setItem(`jobchat_cache_msgs_${applicantId}`, JSON.stringify(msgs));
        
        setTimeout(() => {
          if (!active) return;
          scrollToBottom('auto');
          setIsScrollDone(true);
          setTimeout(() => {
            if (!active) return;
            isInitialScrollDone.current = true;
          }, 100);
        }, 50);
        DB.markMessagesAsSeen(applicantId, 'applicant');
        
        if (!active) return;
        sub = DB.subscribeToMessages(applicantId, (msg) => {
          if (!active) return;
          if (msg.sender_type === 'admin' && msg.sender_id === adminSession.user.id) return;
          
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setMessagesOffset(prev => prev + 1);
          
          const container = listRef.current;
          if (container) {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
            if (isAtBottom) {
              setTimeout(scrollToBottom, 50);
            } else {
              setNewMessagesCount(prev => prev + 1);
            }
          } else {
            setTimeout(scrollToBottom, 50);
          }
          
          if (msg.sender_type === 'applicant') {
            DB.markMessagesAsSeen(applicantId, 'applicant');
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    
    load();
    return () => {
      active = false;
      if (sub) DB.unsubscribe(sub);
    };
  }, [applicantId, adminSession]);

  useEffect(() => {
    if (messages.length > 0 && applicantId) {
      const firstMsg = messages[0];
      if (firstMsg && firstMsg.conversation_id === applicantId) {
        localStorage.setItem(`jobchat_cache_msgs_${applicantId}`, JSON.stringify(messages.slice(-100)));
      }
    }
  }, [messages, applicantId]);

  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      setTimeout(() => {
        setConnectionStatus('connected');
        setTimeout(() => {
          setConnectionStatus('online');
        }, 1500);
      }, 1500);
    };
    const handleOffline = () => {
      setConnectionStatus('offline');
    };
    
    setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleScroll = () => {
    const container = listRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
    
    if (isProgrammaticScrolling.current) {
      if (isAtBottom) {
        isProgrammaticScrolling.current = false;
      }
      setShowScrollBtn(false);
      return;
    }

    setShowScrollBtn(!isAtBottom);
    if (isAtBottom) {
      setNewMessagesCount(0);
    }
  };

  useEffect(() => {
    if (!applicantId) return;
    const channelName = `typing:${applicantId}`;
    const channel = DB.supabaseClient.channel(channelName);
    channel.subscribe();
    typingChannelRef.current = channel;
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

  const loadMoreMessages = async () => {
    if (isLoadingMessages || !hasMoreMessages) return;
    const container = listRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setIsLoadingMessages(true);
    
    try {
      const msgs = await DB.getMessages(applicantId, messagesOffset, 50, 'admin');
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

  useEffect(() => {
    if (applicant) {
      setEditName(applicant.name);
      setEditPhone(applicant.phone || '');
      setEditPosition(applicant.position || '');
    }
  }, [applicant, isEditingProfile]);

  const handleSaveProfile = async () => {
    const nameToSave = editName.trim();
    if (!nameToSave) {
      showToast(t('admin.nameRequired') || 'Tên không được để trống', 'error');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await DB.updateApplicant(applicant.id, {
        name: nameToSave,
        phone: editPhone.trim(),
        position: editPosition
      });
      setApplicant(updated);
      if (onApplicantUpdate) {
        onApplicantUpdate(updated);
      }
      setIsEditingProfile(false);
      showToast(t('admin.settingsSaved') || 'Đã lưu cài đặt ✓', 'success');
    } catch(err) {
      console.error(err);
      showToast(t('common.error'), 'error');
    } finally {
      setIsSavingProfile(false);
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
          sender_name: replyToMessage.sender_name || (replyToMessage.sender_type === 'applicant' ? (applicant?.name || 'Applicant') : t('chat.adminName')),
          sender_id: replyToMessage.sender_id || (replyToMessage.sender_type === 'applicant' ? applicantId : 'admin')
        }
      };
      setReplyToMessage(null);
    }

    const tempId = 'temp-' + Date.now();
    const newMsg = {
      id: tempId,
      content: contentVal || text,
      sender_type: 'admin',
      sender_name: adminSession.profile.display_name,
      sender_id: adminSession.user.id,
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
        payload: { 
          sender_type: 'admin', 
          sender_id: adminSession.user.id,
          isTyping: false,
          sender_name: adminSession.profile.display_name,
          avatar: adminSession.profile.avatar
        }
      });
    }

    setInputText('');
    setAreActionsCollapsed(false);
    if (textareaRef.current) {
      textareaRef.current.value = '';
      textareaRef.current.style.height = 'auto';
      if (keepFocus) {
        textareaRef.current.focus({ preventScroll: true });
      }
    }
    setTimeout(scrollToBottom, 50);

    try {
      const actualMsg = await DB.sendMessage(applicantId, 'admin', adminSession.profile.display_name, adminSession.user.id, contentVal || text, payload);
      // Replace temp with actual, carrying over tempId to keep React key stable
      setMessages(prev => prev.map(m => m.id === tempId ? { ...actualMsg, tempId: tempId } : m));
    } catch(err) {
      console.error('Send failed', err);
      showToast(t('common.error'), 'error');
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
      e.target.value = '';
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

  const handleCallClick = () => {
    if (!applicant || !applicant.phone) {
      showConfirmModal(
        t('chat.noPhoneTitle') || 'Không tìm thấy số điện thoại',
        t('chat.noPhoneMessage') || 'Ứng viên này chưa cung cấp hoặc cập nhật số điện thoại trên hệ thống!',
        null,
        t('common.close') || 'Đóng',
        { t }
      );
      return;
    }

    showConfirmModal(
      t('chat.confirmCallTitle') || 'Xác nhận cuộc gọi',
      `${t('chat.confirmCallMessage') || 'Bạn có chắc chắn muốn thực hiện cuộc gọi tới số'} ${applicant.phone}?`,
      () => {
        window.open(`tel:${applicant.phone}`, '_self');
      },
      t('chat.call') || 'Gọi',
      { t }
    );
  };

  const handleDeleteConversation = () => {
    if (!applicant) return;
    showConfirmModal(
      t('common.delete') || 'Xóa',
      t('admin.confirmDelete') || 'Bạn có chắc chắn muốn xóa?',
      async () => {
        try {
          await DB.deleteConversation(applicant.id);
          if (onDelete) {
            onDelete(applicant.id);
          } else {
            onBack();
          }
        } catch(err) {
          showToast(t('common.error'), 'error');
        }
      },
      t('common.delete') || 'Xóa',
      { t }
    );
  };

  if (isLoading) return <div className="admin-empty-state"><div className="spinner"></div></div>;
  if (!applicant) return <div className="admin-empty-state"><p>{t('common.error')}</p></div>;

  const handleTextChange = (val) => {
    setInputText(val);
    if (val.length > 0) {
      setAreActionsCollapsed(true);
    }
    
    // Broadcast typing state
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
          sender_type: 'admin', 
          sender_id: adminSession.user.id,
          isTyping: val.length > 0,
          sender_name: adminSession.profile.display_name,
          avatar: adminSession.profile.avatar
        }
      });
    }
    
    // Auto-clear typing status after 3s of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (val.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        if (typingChannelRef.current) {
          typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { 
              sender_type: 'admin', 
              sender_id: adminSession.user.id,
              isTyping: false,
              sender_name: adminSession.profile.display_name,
              avatar: adminSession.profile.avatar
            }
          });
        }
      }, 3000);
    }
  };

  const cannedResponses = [
    { key: 'greet', text: t('chat.cannedResponses.greet') || 'Chào bạn, Uphill đã nhận được thông tin đăng ký ứng tuyển của bạn. Chúng tôi sẽ sớm liên hệ lại!' },
    { key: 'cv', text: t('chat.cannedResponses.cv') || 'Bạn vui lòng gửi bản mềm CV (PDF) trực tiếp qua đây để chúng tôi tiến hành xét duyệt hồ sơ nhé.' },
    { key: 'interview', text: t('chat.cannedResponses.interview') || 'Uphill trân trọng mời bạn tham gia buổi phỏng vấn trực tiếp tại văn phòng công ty.' },
    { key: 'askPhone', text: t('chat.cannedResponses.askPhone') || 'Bạn vui lòng cung cấp số điện thoại chính xác để bộ phận nhân sự tiện liên hệ trao đổi công việc nhé.' },
    { key: 'askTime', text: t('chat.cannedResponses.askTime') || 'Thời gian sớm nhất bạn có thể bắt đầu nhận việc là khi nào?' },
    { key: 'interviewOnline', text: t('chat.cannedResponses.interviewOnline') || 'Uphill trân trọng mời bạn tham gia buổi phỏng vấn trực tuyến qua Google Meet. Chúng tôi sẽ gửi link họp sau.' },
    { key: 'askExperience', text: t('chat.cannedResponses.askExperience') || 'Bạn có thể chia sẻ thêm về kinh nghiệm làm việc hoặc các dự án nổi bật đã thực hiện ở vị trí tương đương không?' },
    { key: 'thankReject', text: t('chat.cannedResponses.thankReject') || 'Cảm ơn bạn đã quan tâm đến cơ hội nghề nghiệp tại Uphill. Sau khi xem xét hồ sơ, chúng tôi nhận thấy kinh nghiệm của bạn chưa thực sự phù hợp với vị trí này tại thời điểm hiện tại. Hy vọng có dịp hợp tác cùng bạn trong tương lai.' }
  ];

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

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, width: '100%', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, position: 'relative' }}>
        <div className="chat-header-bar">
          <div className="chat-header-info">
            <button 
              className="btn-icon" 
              onClick={() => {
                if (window.innerWidth <= 768) {
                  if (onBack) onBack();
                } else {
                  if (onToggleSidebar) onToggleSidebar();
                }
              }} 
              style={{marginRight:'-4px', marginLeft:'-8px', color:'var(--messenger-blue)', padding:0}}
              title={isSidebarCollapsed ? "Mở rộng" : "Thu gọn"}
            >
              {isMobile ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              ) : isSidebarCollapsed ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              )}
            </button>
            <div className="chat-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {applicant.avatar ? (
                <img src={applicant.avatar} alt={applicant.name} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%'}} />
              ) : (
                applicant.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="chat-header-name">{applicant.name}</div>
              <div className="chat-header-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {applicant.phone && <span>📞 {applicant.phone}</span>}
                {applicant.email ? (
                  <span style={{ color: 'var(--text-muted)' }} className="header-email-detail">✉️ {applicant.email}</span>
                ) : (
                  <span style={{ color: '#ff9800', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: '500' }} className="header-email-detail" title="Ứng viên chưa cập nhật email nên sẽ không nhận được thông báo qua mail">
                    ⚠️ Chưa có Email (Không nhận được thông báo mail)
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{display:'flex', gap:'6px', position: 'relative'}}>
            <button className="btn-icon" onClick={handleCallClick} title={t('chat.call') || 'Gọi cho ứng viên'} style={{color:'var(--messenger-blue)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </button>
            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }} title="Thêm tùy chọn" style={{color: showMoreMenu ? 'var(--messenger-blue)' : 'var(--text-muted)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
            </button>
            {showMoreMenu && (
              <div className="header-more-menu" onClick={(e) => e.stopPropagation()}>
                <button className="header-dropdown-item" onClick={() => { setShowMediaSidebar(!showMediaSidebar); setShowMoreMenu(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>
                  <span>{t('admin.mediaGallery') || 'Tệp đã chia sẻ'}</span>
                </button>
                <button className="header-dropdown-item" onClick={() => { setIsEditingProfile(true); setShowMoreMenu(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span>{t('admin.applicantInfo') || 'Thông tin ứng viên'}</span>
                </button>
                <button className="header-dropdown-item danger" onClick={() => { handleDeleteConversation(); setShowMoreMenu(false); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  <span>{t('common.delete') || 'Xóa cuộc trò chuyện'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {connectionStatus !== 'online' && (
          <div className={`network-banner ${connectionStatus}`}>
            {connectionStatus === 'offline' && (t('chat.networkOffline') || '⚠️ Không có kết nối mạng. Vui lòng kiểm tra lại thiết bị.')}
            {connectionStatus === 'reconnecting' && (t('chat.networkReconnecting') || '🔄 Đang kết nối lại...')}
            {connectionStatus === 'connected' && (t('chat.networkConnected') || '🟢 Đã kết nối lại thành công!')}
          </div>
        )}
        
        <div 
          className="chat-messages" 
          ref={listRef} 
          onScroll={handleScroll}
          onClick={() => textareaRef.current?.blur()}
          onTouchStart={() => textareaRef.current?.blur()}
          style={{ opacity: isScrollDone ? 1 : 0, transition: 'none' }}
        >
          <div className="chat-messages-inner">
            <div className="chat-welcome">
              <div className="chat-welcome-icon">{applicant.name.charAt(0).toUpperCase()}</div>
              <h3>{applicant.name}</h3>
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
            
            {messages.filter(msg => !msg.deleted_by_admin).map((msg, index, filteredMsgs) => {
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

              const isCurrentAdminMsg = msg.sender_type === 'admin' && msg.sender_id === adminSession?.user?.id;

              return (
                <React.Fragment key={msg.tempId || msg.id}>
                  {showDateSeparator && (
                    <div className="date-separator">
                      <span>{dateLabel}</span>
                    </div>
                  )}
                  <ChatBubble 
                    msg={msg} 
                    isSent={isCurrentAdminMsg} 
                    showSender={isFirstInGroup} 
                    showAvatar={isLastInGroup}
                    adminInfo={adminsMap[msg.sender_id]}
                    applicantAvatar={applicant?.avatar || null}
                    onDelete={async (msgId) => {
                      try {
                        await DB.deleteMessageLocally(msgId, 'admin');
                        setMessages(prev => prev.filter(m => m.id !== msgId));
                        showToast(t('chat.deleted') || 'Đã xóa', 'success');
                      } catch(e) {
                        showToast(t('common.error'), 'error');
                      }
                    }}
                    onReply={(replyMsg) => setReplyToMessage(replyMsg)}
                    activeMessageId={activeMessageId}
                    setActiveMessageId={setActiveMessageId}
                  />
                </React.Fragment>
              );
            })}
            {isPartnerTyping && (
              <TypingIndicator name={applicant.name || 'Ứng viên'} avatar={applicant.avatar || null} />
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
                    {replyToMessage.sender_type === 'admin' 
                      ? (t('chat.replyToSelf') || 'chính mình') 
                      : (replyToMessage.sender_name || (applicant?.name || 'Applicant'))}
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
            <input type="file" id="admin-chat-file-upload" style={{display:'none'}} ref={fileInputRef} onChange={e => handleFileSelect(e, 'file')} />
            <input type="file" id="admin-chat-image-upload" accept="image/*" style={{display:'none'}} ref={imageInputRef} onChange={e => handleFileSelect(e, 'image')} />
            <button 
              className={`chat-action-btn expand-btn ${areActionsCollapsed ? 'active' : ''}`}
              title="Mở rộng" 
              onMouseDown={(e) => {
                e.preventDefault();
                window.expandBtnFocused = (document.activeElement === textareaRef.current);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                window.expandBtnFocused = (document.activeElement === textareaRef.current);
              }}
              onClick={() => {
                setAreActionsCollapsed(false);
                if (window.expandBtnFocused) {
                  textareaRef.current?.focus({ preventScroll: true });
                } else {
                  textareaRef.current?.blur();
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
              <button 
                className={`emoji-toggle-btn canned-toggle-btn ${areActionsCollapsed ? 'collapsed-mobile' : ''}`} 
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => setShowCannedPopup(!showCannedPopup)} 
                title="Trả lời nhanh"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', color: '#ffb020' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </button>
              <textarea 
                id="admin-chat-input"
                ref={textareaRef}
                className="chat-input" 
                placeholder={t('chat.placeholder')}
                value={inputText}
                onFocus={() => setAreActionsCollapsed(true)}
                onBlur={() => {
                  if (!inputText.trim()) {
                    setAreActionsCollapsed(false);
                  }
                }}
                onChange={(e) => {
                  handleTextChange(e.target.value);
                  autoResize(e.target);
                  if (e.target.value.trim()) {
                    setAreActionsCollapsed(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                rows="1"
                style={{background:'transparent', margin:0, flex:1, border:'none', outline:'none', resize:'none', overflowY:'auto', maxHeight:'120px'}}
              ></textarea>
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
                onClick={(e) => EmojiPicker.toggle('admin-chat-input', e.currentTarget, window.emojiToggleFocused)}
              >
                😊
              </button>

              {showCannedPopup && (
                <div className="canned-popup">
                  <div className="canned-popup-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ffb020' }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      {t('chat.cannedTitle') || 'Mẫu trả lời nhanh'}
                    </span>
                    <button onClick={() => setShowCannedPopup(false)}>✕</button>
                  </div>
                  <div className="canned-popup-list">
                    {cannedResponses.map(res => (
                      <button 
                        key={res.key} 
                        onClick={() => {
                          handleTextChange(res.text);
                          if (textareaRef.current) {
                            textareaRef.current.value = res.text;
                            textareaRef.current.focus({ preventScroll: true });
                            autoResize(textareaRef.current);
                          }
                          setShowCannedPopup(false);
                        }}
                      >
                        {res.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

      {isEditingProfile && (
        <div className="confirm-modal-overlay" onClick={() => setIsEditingProfile(false)} style={{ zIndex: 1000 }}>
          <div className="job-form-card" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="job-form-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--messenger-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {t('admin.applicantInfo') || 'Thông tin ứng viên'}
              </h3>
              <button className="job-form-close-flat" onClick={() => setIsEditingProfile(false)}>✕</button>
            </div>
            <div className="job-form-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('register.name') || 'Tên hiển thị'}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ 
                      flexGrow: 1, 
                      padding: '10px 14px', 
                      background: 'var(--bg-primary)', 
                      borderRadius: '12px', 
                      fontSize: '15px', 
                      color: 'var(--text-primary)', 
                      border: '1px solid var(--border-light)', 
                      fontWeight: '500',
                      outline: 'none'
                    }} 
                  />
                  {editName !== applicant?.name && (
                    <button 
                      onClick={() => setEditName(applicant?.name || '')}
                      style={{
                        padding: '10px 14px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {t('admin.reset') || 'Đặt lại'}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('register.phone') || 'Số điện thoại'}</span>
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '15px', color: 'var(--text-primary)', border: '1px solid var(--border-light)', fontWeight: '500' }}>
                  {applicant?.phone || (t('chat.noPhoneMessage') || 'Chưa cung cấp số điện thoại')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Email</span>
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '15px', color: 'var(--text-primary)', border: '1px solid var(--border-light)', fontWeight: '500' }}>
                  {applicant?.email || (t('auth.noEmailLinked') || 'Chưa liên kết Email')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {applicant?.applied_job_title ? ((t('chat.appliedJob') || 'Vị trí ứng tuyển').replace(/:$/, '').trim()) : (t('register.position') || 'Vị trí mong muốn')}
                </span>
                <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '15px', color: 'var(--text-primary)', border: '1px solid var(--border-light)', fontWeight: '500' }}>
                  {applicant?.applied_job_title || (applicant?.position ? (t('register.positions.' + applicant.position) || applicant.position) : '--')}
                </div>
              </div>
            </div>
            <div className="job-form-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="btn-job-cancel" 
                onClick={() => setIsEditingProfile(false)} 
                style={{ 
                  background: 'white', 
                  color: 'var(--text-primary)', 
                  border: '1px solid var(--border-light)', 
                  padding: '10px 24px', 
                  borderRadius: '12px', 
                  fontWeight: '600', 
                  cursor: 'pointer' 
                }}
              >
                {t('admin.cancel') || 'Hủy'}
              </button>
              <button 
                className="btn-job-save" 
                onClick={handleSaveProfile} 
                disabled={isSavingProfile}
                style={{ 
                  background: 'var(--messenger-blue)', 
                  color: 'white', 
                  border: 'none', 
                  padding: '10px 24px', 
                  borderRadius: '12px', 
                  fontWeight: '600', 
                  cursor: 'pointer',
                  opacity: isSavingProfile ? 0.7 : 1
                }}
              >
                {isSavingProfile ? (t('admin.saving') || 'Đang lưu...') : (t('admin.save') || 'Lưu')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '8px 16px', background: 'var(--messenger-blue)', color: 'white',
                border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>{t('chat.download') || 'Tải xuống'}</span>
            </button>
            <button 
              onClick={() => setActiveLightboxImage(null)}
              style={{
                padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: 'white',
                border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              ✕ {t('admin.cancel') || 'Đóng'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
