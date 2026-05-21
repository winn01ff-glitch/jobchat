'use client';
import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotification } from '../../../context/NotificationContext';
import { DB } from '../../../lib/supabase';
import { ChatBubble, SystemMessage } from '../../../components/ChatBubble';
import { autoResize, EmojiPicker } from '../../../lib/helpers';

export default function ChatPage({ params }) {
  const resolvedParams = use(params);
  const applicantId = resolvedParams.id;
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { showToast } = useNotification();

  const [messages, setMessages] = useState([]);
  const [applicantName, setApplicantName] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [adminInfo, setAdminInfo] = useState(null);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

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
      
      const fetchAdmin = async () => {
        try {
          const profile = await DB.getAdminProfile();
          setAdminInfo(profile);
        } catch(e) {}
      };
      fetchAdmin();
      
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

  const loadInitialMessages = async (id) => {
    try {
      const msgs = await DB.getMessages(id, 0, 20);
      setMessages(msgs);
      setMessagesOffset(20);
      if (msgs.length < 20) setHasMoreMessages(false);
      
      // Scroll to bottom
      setTimeout(() => scrollToBottom(), 100);
      DB.markMessagesAsSeen(id, 'admin');
    } catch (err) {
      console.error(err);
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
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (isAtBottom || msg.sender_type === 'applicant') {
        setTimeout(scrollToBottom, 50);
      }
    } else {
      setTimeout(scrollToBottom, 50);
    }
    
    if (msg.sender_type === 'admin') {
      DB.markMessagesAsSeen(applicantId, 'admin');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (customContent = null) => {
    const text = (textareaRef.current?.value || inputText).trim();
    if (!text && !customContent) return;
    
    const tempId = 'temp-' + Date.now();
    const newMsg = {
      id: tempId,
      content: customContent || text,
      sender_type: 'applicant',
      sender_name: applicantName,
      created_at: new Date().toISOString(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, newMsg]);
    
    if (!customContent) {
      setInputText('');
      if (textareaRef.current) {
        textareaRef.current.value = '';
        textareaRef.current.style.height = 'auto';
      }
    }
    setTimeout(scrollToBottom, 50);

    try {
      const actualMsg = await DB.sendMessage(applicantId, 'applicant', applicantName, applicantId, customContent || text);
      // Replace temp with actual
      setMessages(prev => prev.map(m => m.id === tempId ? actualMsg : m));
    } catch(err) {
      console.error('Send failed', err);
      showToast(t('common.error'), 'error');
      // Mark as failed
      setMessages(prev => prev.map(m => m.id === tempId ? {...m, status: 'failed'} : m));
    }
  };

  const handleFileSelect = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = JSON.stringify({
        type: type,
        data: ev.target.result,
        name: file.name,
        size: file.size,
        mimeType: file.type
      });
      handleSend(content);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
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
      <div className="chat-messages" id="chat-messages" ref={listRef}>
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
        
        {messages.map((msg, index) => {
          let showDateSeparator = false;
          let dateLabel = '';
          const d = new Date(msg.created_at);
          const today = new Date();
          
          if (index === 0) {
            showDateSeparator = true;
          } else {
            const prevD = new Date(messages[index - 1].created_at);
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
          const nextMsg = messages[index + 1];
          if (nextMsg) {
            const nextD = new Date(nextMsg.created_at);
            if (nextMsg.sender_type === msg.sender_type && nextD.toDateString() === d.toDateString()) {
              isLastInGroup = false;
            }
          }

          // AdminInfo is fetched from DB.getAdminProfile()
          const msgAdminInfo = msg.sender_type === 'admin' ? adminInfo : null;

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
                showSender={false} 
                showAvatar={isLastInGroup}
                adminInfo={msgAdminInfo}
                onDelete={async (msgId) => {
                  try {
                    await DB.deleteMessage(msgId);
                    setMessages(prev => prev.filter(m => m.id !== msgId));
                    showToast(t('chat.deleted') || 'Đã xóa', 'success');
                  } catch(e) {
                    showToast(t('common.error'), 'error');
                  }
                }}
              />
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-bar">
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
              setInputText(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
            rows="1"
            style={{background:'transparent', margin:0, flex:1}}
          ></textarea>
          <button className="emoji-toggle-btn" onClick={(e) => EmojiPicker.toggle('chat-input', e.currentTarget)}>😊</button>
        </div>
        <button className="btn-send" onClick={handleSend}>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  );
}
