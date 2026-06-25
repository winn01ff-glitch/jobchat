import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { DB } from '../lib/supabase';
import { ChatBubble, SystemMessage } from './ChatBubble';
import { autoResize, EmojiPicker, showConfirmModal } from '../lib/helpers';

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

        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          'image/webp',
          0.8
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function AdminChat({ applicantId, onBack, onDelete, adminSession, isSidebarCollapsed, onToggleSidebar }) {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  
  const [applicant, setApplicant] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [adminsMap, setAdminsMap] = useState({});
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

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

  useEffect(() => {
    let sub;
    const load = async () => {
      setIsLoading(true);
      try {
        const app = await DB.getApplicant(applicantId);
        setApplicant(app);
        
        const msgs = await DB.getMessages(applicantId, 0, 20);
        setMessages(msgs);
        setMessagesOffset(20);
        if (msgs.length < 20) setHasMoreMessages(false);
        else setHasMoreMessages(true);
        
        setTimeout(() => scrollToBottom(), 100);
        DB.markMessagesAsSeen(applicantId, 'applicant');
        
        sub = DB.subscribeToMessages(applicantId, (msg) => {
          if (msg.sender_type === 'admin' && msg.sender_id === adminSession.user.id) return;
          
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setMessagesOffset(prev => prev + 1);
          setTimeout(scrollToBottom, 50);
          
          if (msg.sender_type === 'applicant') {
            DB.markMessagesAsSeen(applicantId, 'applicant');
          }
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    load();
    return () => {
      if (sub) DB.unsubscribe(sub);
    };
  }, [applicantId, adminSession]);

  const loadMoreMessages = async () => {
    if (isLoadingMessages || !hasMoreMessages) return;
    setIsLoadingMessages(true);
    
    const container = listRef.current;
    const oldScrollHeight = container ? container.scrollHeight : 0;

    try {
      const msgs = await DB.getMessages(applicantId, messagesOffset, 20);
      if (msgs.length > 0) {
        setMessages(prev => [...msgs, ...prev]);
        setMessagesOffset(prev => prev + msgs.length);
        if (msgs.length < 20) setHasMoreMessages(false);
        
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
      setIsEditingProfile(false);
      showToast(t('admin.settingsSaved') || 'Đã lưu cài đặt ✓', 'success');
    } catch(err) {
      console.error(err);
      showToast(t('common.error'), 'error');
    } finally {
      setIsSavingProfile(false);
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
      sender_type: 'admin',
      sender_name: adminSession.profile.display_name,
      sender_id: adminSession.user.id,
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
      const actualMsg = await DB.sendMessage(applicantId, 'admin', adminSession.profile.display_name, adminSession.user.id, customContent || text);
      setMessages(prev => prev.map(m => m.id === tempId ? actualMsg : m));
    } catch(err) {
      console.error('Send failed', err);
      showToast(t('common.error'), 'error');
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
        // Compress image client-side to WebP
        const compressedBlob = await compressImage(file);
        const baseName = file.name.includes('.') ? file.name.substring(0, file.name.lastIndexOf('.')) : file.name;
        uploadName = `${baseName}.webp`;
        fileToUpload = new File([compressedBlob], uploadName, { type: 'image/webp' });
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

  const handleDeleteConversation = () => {
    if (!applicant) return;
    showConfirmModal(
      t('common.delete') || 'Xóa',
      t('admin.confirmDelete') || 'Bạn có chắc chắn muốn xóa?',
      async () => {
        try {
          await DB.deleteApplicant(applicant.id);
          onBack(); // Go back or deselect
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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, width: '100%' }}>
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
            {isSidebarCollapsed ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            )}
          </button>
          <div className="chat-avatar">{applicant.name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="chat-header-name">{applicant.name}</div>
            <div className="chat-header-status">
              {applicant.phone ? `📱 ${applicant.phone} · ` : ''}
              {applicant.position ? `🏢 ${t('register.positions.' + applicant.position) || applicant.position}` : ''}
            </div>
          </div>
        </div>
        <div style={{display:'flex', gap:'6px'}}>
          <button className="btn-icon" onClick={() => setIsEditingProfile(true)} title={t('admin.editJob') || 'Sửa'} style={{color:'var(--messenger-blue)'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button className="btn-icon" onClick={handleDeleteConversation} title={t('common.delete')} style={{color:'var(--error)'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>
      </div>
      
      <div className="chat-messages" ref={listRef}>
        {hasMoreMessages && (
          <div style={{textAlign: 'center', margin: '10px 0'}}>
            <button 
              onClick={loadMoreMessages} 
              className="btn-secondary" 
              disabled={isLoadingMessages}
              style={{fontSize: '12px', padding: '4px 12px', borderRadius: '12px'}}
            >
              {isLoadingMessages ? '...' : t('chat.loadMore') || 'Tải thêm tin nhắn'}
            </button>
          </div>
        )}
        <div className="chat-welcome">
          <div className="chat-welcome-icon">{applicant.name.charAt(0).toUpperCase()}</div>
          <h3>{applicant.name}</h3>
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

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="date-separator">
                  <span>{dateLabel}</span>
                </div>
              )}
              <ChatBubble 
                msg={msg} 
                isSent={msg.sender_type === 'admin'} 
                showSender={false} 
                showAvatar={isLastInGroup}
                adminInfo={adminsMap[msg.sender_id]}
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
        <input type="file" id="admin-chat-file-upload" style={{display:'none'}} ref={fileInputRef} onChange={e => handleFileSelect(e, 'file')} />
        <input type="file" id="admin-chat-image-upload" accept="image/*" style={{display:'none'}} ref={imageInputRef} onChange={e => handleFileSelect(e, 'image')} />
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
            id="admin-chat-input"
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
          <button className="emoji-toggle-btn" onClick={(e) => EmojiPicker.toggle('admin-chat-input', e.currentTarget)}>😊</button>
        </div>
        <button className="btn-send" onClick={handleSend}>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      {isEditingProfile && (
        <div className="confirm-modal-overlay" onClick={() => setIsEditingProfile(false)} style={{ zIndex: 1000 }}>
          <div className="job-form-card" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="job-form-header">
              <h3>📝 {t('admin.editJob') || 'Sửa thông tin ứng viên'}</h3>
              <button className="job-form-close" onClick={() => setIsEditingProfile(false)} style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'var(--text-muted)', padding:'4px 8px', lineHeight:1 }}>✕</button>
            </div>
            <div className="job-form-body">
              <div className="form-group">
                <label className="form-label">{t('register.name')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required 
                />
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">{t('register.phone')}</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">{t('register.position')}</label>
                <select 
                  className="form-input" 
                  value={editPosition}
                  onChange={e => setEditPosition(e.target.value)}
                  style={{ appearance: 'none', background: 'var(--bg-input)' }}
                >
                  <option value="">-- {t('register.positionPlaceholder') || 'Chọn vị trí'} --</option>
                  <option value="factory">{t('register.positions.factory')}</option>
                  <option value="restaurant">{t('register.positions.restaurant')}</option>
                  <option value="construction">{t('register.positions.construction')}</option>
                  <option value="office">{t('register.positions.office')}</option>
                  <option value="it">{t('register.positions.it')}</option>
                  <option value="other">{t('register.positions.other')}</option>
                </select>
              </div>
            </div>
            <div className="job-form-footer" style={{ marginTop: '20px' }}>
              <button className="btn-job-cancel" onClick={() => setIsEditingProfile(false)}>{t('admin.cancel') || 'Cancel'}</button>
              <button className="btn-job-publish" onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? <div className="spinner"></div> : t('admin.save') || 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
