'use client';
import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotification } from '../../../context/NotificationContext';
import { DB } from '../../../lib/supabase';
import { ChatBubble, SystemMessage, TypingIndicator } from '../../../components/ChatBubble';
import { autoResize, EmojiPicker } from '../../../lib/helpers';

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

export default function ChatPage({ params }) {
  const resolvedParams = use(params);
  const applicantId = resolvedParams.id;
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { showToast } = useNotification();

  const [messages, setMessages] = useState([]);
  const [applicantName, setApplicantName] = useState('');
  const [inputText, setInputText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
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

  const typingTimeoutRef = useRef(null);
  const typingChannelRef = useRef(null);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

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
    // Check auth
    const sessionStr = localStorage.getItem('jobchat_session');
    if (!sessionStr) {
      router.push('/register');
      return;
    }
    try {
      const session = JSON.parse(sessionStr);
      if (session.id !== applicantId) {
        router.push('/register');
        return;
      }
      setApplicantName(session.name);
      loadInitialMessages(applicantId);
      
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
      
      const sub = DB.subscribeToMessages(applicantId, (msg) => {
        const sessionStr = localStorage.getItem('jobchat_session');
        if (sessionStr) {
          try {
            const session = JSON.parse(sessionStr);
            if (msg.sender_type === 'applicant' && msg.sender_id === session.id) {
              return; // Prevent duplicate message from subscription
            }
          } catch(e) {}
        }
        handleNewMessage(msg);
      });
      setSubscription(sub);
      
      return () => {
        DB.unsubscribe(sub);
      };
    } catch(e) {
      router.push('/register');
    }
  }, [applicantId]);

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
    if (!applicantId) return;

    const interval = setInterval(async () => {
      try {
        const msgs = await DB.getMessages(applicantId, 0, 20);
        setMessages(prev => {
          const prevIds = prev.map(m => m.id).join(',');
          const newIds = msgs.map(m => m.id).join(',');
          if (prevIds !== newIds) {
            const sending = prev.filter(m => m.status === 'sending' || m.status === 'failed');
            const merged = [...msgs];
            sending.forEach(s => {
              if (!merged.find(m => m.id === s.id)) {
                merged.push(s);
              }
            });
            merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            
            const hasNewAdminMsg = msgs.length > 0 && 
              msgs[msgs.length - 1].sender_type === 'admin' && 
              !prev.find(m => m.id === msgs[msgs.length - 1].id);
              
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
            
            return merged;
          }
          return prev;
        });
      } catch (e) {
        console.error('Polling failed:', e);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [applicantId]);

  const loadInitialMessages = async (id) => {
    try {
      const msgs = await DB.getMessages(id, 0, 20);
      setMessages(msgs);
      setMessagesOffset(20);
      if (msgs.length < 20) setHasMoreMessages(false);
      
      // Scroll to bottom
      setTimeout(() => scrollToBottom('auto'), 100);
      DB.markMessagesAsSeen(id, 'admin');
    } catch (err) {
      console.error('Failed to load initial chat state:', err);
      localStorage.removeItem('jobchat_session');
      router.push('/register');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMessages || !hasMoreMessages) return;
    setIsLoadingMessages(true);
    
    // Save current scroll position
    const container = listRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;

    try {
      const msgs = await DB.getMessages(applicantId, messagesOffset, 20);
      if (msgs.length > 0) {
        setMessages(prev => [...msgs, ...prev]);
        setMessagesOffset(prev => prev + msgs.length);
        if (msgs.length < 20) setHasMoreMessages(false);
        
        // Restore scroll position
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          }
        }, 10);
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

  const handleScroll = () => {
    const container = listRef.current;
    if (!container) return;
    
    const isScrolledUp = container.scrollHeight - container.scrollTop - container.clientHeight > 150;
    setShowScrollBtn(isScrolledUp);
    
    if (!isScrolledUp) {
      setNewMessagesCount(0);
    }
  };

  const handleTextChange = (val) => {
    setInputText(val);
    
    // Broadcast typing state
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_type: 'applicant', isTyping: val.length > 0 }
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
            payload: { sender_type: 'applicant', isTyping: false }
          });
        }
      }, 3000);
    }
  };

  const handleSend = async (customContent = null) => {
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

    if (!contentVal) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    }
    setTimeout(scrollToBottom, 50);

    try {
      const actualMsg = await DB.sendMessage(applicantId, 'applicant', applicantName, applicantId, contentVal || text, payload);
      // Replace temp with actual
      setMessages(prev => prev.map(m => m.id === tempId ? actualMsg : m));
    } catch(err) {
      console.error('Send failed', err);
      if (err && (err.code === '23503' || (err.message && err.message.includes('foreign key')))) {
        showToast(t('register.invalidOtp') || 'Phiên làm việc đã hết hạn hoặc không tồn tại.', 'error');
        localStorage.removeItem('jobchat_session');
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
      
      handleSend(content);
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
        handleSend(content);
      },
      (err) => {
        showToast(t('chat.locationError') || 'Không thể lấy vị trí', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return <div className="chat-container"><div className="spinner"></div></div>;
  }

  return (
    <div className="chat-container">
      {connectionStatus !== 'online' && (
        <div className={`network-banner ${connectionStatus}`}>
          {connectionStatus === 'offline' && (t('chat.networkOffline') || '⚠️ Không có kết nối mạng. Vui lòng kiểm tra lại thiết bị.')}
          {connectionStatus === 'reconnecting' && (t('chat.networkReconnecting') || '🔄 Đang kết nối lại...')}
          {connectionStatus === 'connected' && (t('chat.networkConnected') || '🟢 Đã kết nối lại thành công!')}
        </div>
      )}

      <div className="chat-messages" id="chat-messages" ref={listRef} onScroll={handleScroll}>
        <div className="chat-messages-inner">
          {hasMoreMessages && (
            <div style={{textAlign: 'center', margin: '10px 0'}}>
              <button 
                onClick={loadMoreMessages} 
                className="btn-secondary" 
                disabled={isLoadingMessages}
                style={{fontSize: '12px', padding: '4px 12px', borderRadius: '12px'}}
              >
                {isLoadingMessages ? '...' : t('chat.loadMore') || 'Tải thêm tin nhắn cũ'}
              </button>
            </div>
          )}
          <div className="chat-welcome">
            <div className="chat-welcome-icon">💬</div>
            <h3>{t('chat.welcomeTitle')}</h3>
            <p>{t('chat.welcomeMsg')}</p>
          </div>
          
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
              <React.Fragment key={msg.id}>
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
            scrollToBottom();
            setNewMessagesCount(0);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
          <span>
            {newMessagesCount > 0 ? `${newMessagesCount} ${t('chat.newMessages') || 'tin nhắn mới'}` : (t('chat.scrollDown') || 'Cuộn xuống')}
          </span>
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
          <div className="chat-actions">
            <button className="chat-action-btn" title={t('chat.attachFile') || 'Đính kèm file'} onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button className="chat-action-btn" title={t('chat.sendImage') || 'Gửi ảnh'} onClick={() => imageInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            </button>
            <button className="chat-action-btn" title={t('chat.sendLocation') || 'Gửi vị trí'} onClick={handleLocationSend}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </button>
          </div>
          <div className="chat-input-wrapper" style={{flex:1, display:'flex', alignItems:'center', background:'var(--bg-input)', borderRadius:'20px', paddingRight:'4px'}}>
            <textarea 
              id="chat-input"
              ref={textareaRef}
              className="chat-input" 
              placeholder={t('chat.placeholder')}
              value={inputText}
              onChange={(e) => {
                handleTextChange(e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={handleKeyDown}
              rows="1"
              style={{background:'transparent', margin:0, flex:1, border:'none', outline:'none', resize:'none', overflow:'hidden'}}
            ></textarea>
            <button className="emoji-toggle-btn" onClick={(e) => EmojiPicker.toggle('chat-input', e.currentTarget)}>😊</button>
          </div>
          <button className="btn-send" onClick={() => handleSend()}>
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
