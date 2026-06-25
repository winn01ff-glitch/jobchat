import React from 'react';
import { formatTime, getInitials, showConfirmModal, downloadFile } from '../lib/helpers';
import { useLanguage } from '../context/LanguageContext';

export function ChatBubble({ msg, isSent, showSender = true, onDelete, onReply, adminInfo = null, showAvatar = true, activeMessageId = null, setActiveMessageId = null }) {
  const { t } = useLanguage();
  const [localShowTime, setLocalShowTime] = React.useState(false);
  const showTime = setActiveMessageId ? (activeMessageId === msg.id) : localShowTime;
  const [contextMenu, setContextMenu] = React.useState(null);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const touchTimer = React.useRef(null);

  // Dynamic override for admin messages
  const isAdminMessage = isSent ? msg.sender_type === 'admin' : msg.sender_type === 'admin';
  const displaySenderName = (isAdminMessage && adminInfo?.display_name) ? adminInfo.display_name : (msg.sender_name || 'A');
  const displayAvatar = (isAdminMessage && adminInfo?.avatar) ? adminInfo.avatar : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      if (typeof window !== 'undefined') {
        // Attempt to show a simple toast or fallback to alert
        try {
          const container = document.querySelector('.toast-container');
          if (container) {
            const toast = document.createElement('div');
            toast.className = 'toast success';
            toast.textContent = t('chat.copied') || 'Đã sao chép!';
            container.appendChild(toast);
            setTimeout(() => {
              toast.style.opacity = '0';
              toast.style.transform = 'translateX(100px)';
              toast.style.transition = 'all 0.3s ease';
              setTimeout(() => toast.remove(), 300);
            }, 3000);
          } else {
            alert(t('chat.copied') || 'Đã sao chép!');
          }
        } catch(e) {}
      }
    });
    setContextMenu(null);
  };

  const handleDelete = () => {
    setContextMenu(null);
    showConfirmModal(
      t('chat.deleteMsg') || 'Xóa tin nhắn',
      t('chat.confirmDelete') || 'Bạn có chắc muốn xóa?',
      () => {
        if (onDelete) onDelete(msg.id);
      },
      t('common.delete') || 'Xóa',
      { t }
    );
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const coords = { x: e.clientX, y: e.clientY };
    setContextMenu(coords);
    window.dispatchEvent(new CustomEvent('close-all-context-menus', { detail: { msgId: msg.id } }));
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchTimer.current = setTimeout(() => {
      const coords = { x: touch.clientX, y: touch.clientY };
      setContextMenu(coords);
      window.dispatchEvent(new CustomEvent('close-all-context-menus', { detail: { msgId: msg.id } }));
    }, 600);
  };

  const handleTouchEnd = () => {
    clearTimeout(touchTimer.current);
  };

  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu]);

  React.useEffect(() => {
    const handleCloseAll = (e) => {
      if (e.detail?.msgId !== msg.id) {
        setContextMenu(null);
      }
    };
    window.addEventListener('close-all-context-menus', handleCloseAll);
    return () => window.removeEventListener('close-all-context-menus', handleCloseAll);
  }, [msg.id]);

  const renderReplyPreview = () => {
    const replyTo = msg.payload?.reply_to;
    if (!replyTo) return null;

    let contentPreview = replyTo.content;
    try {
      const parsed = JSON.parse(replyTo.content);
      if (parsed.type === 'image') contentPreview = '📷 ' + (t('chat.image') || 'Ảnh');
      if (parsed.type === 'file') contentPreview = '📎 ' + parsed.name;
      if (parsed.type === 'location') contentPreview = '📍 ' + (t('chat.location') || 'Vị trí');
    } catch(e) {}

    // Shorten preview text if too long
    if (contentPreview.length > 50) {
      contentPreview = contentPreview.substring(0, 50) + '...';
    }

    const isOwnReply = replyTo.sender_id === msg.sender_id;
    const displayName = isOwnReply 
      ? (t('chat.replyToSelf') || 'chính mình') 
      : replyTo.sender_name;

    return (
      <div 
        className="reply-preview-bubble" 
        onClick={(e) => {
          e.stopPropagation();
          const element = document.querySelector(`[data-message-id="${replyTo.id}"]`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight-flash');
            setTimeout(() => element.classList.remove('highlight-flash'), 1500);
          }
        }}
      >
        <div className="reply-sender-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v2.5"/></svg>
          <span>{(t('chat.replyingTo') || 'Đang trả lời') + ' ' + displayName}</span>
        </div>
        <div className="reply-content-text">{contentPreview}</div>
      </div>
    );
  };

  const renderContent = () => {
    let mainContent = null;
    let isMedia = false;
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === 'image') {
        isMedia = true;
        const imageUrl = parsed.url || parsed.data;
        mainContent = (
          <>
            <img 
              className="message-image" 
              src={imageUrl} 
              alt={parsed.name} 
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              style={{cursor: 'pointer'}}
            />
             {lightboxOpen && (
              <div 
                className="lightbox-overlay" 
                style={{
                  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                  background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', 
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(false);
                }}
              >
                <img 
                  src={imageUrl} 
                  alt={parsed.name} 
                  style={{ maxWidth: '90%', maxHeight: '80%', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} 
                  onClick={e => e.stopPropagation()}
                />
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }} onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadFile(imageUrl, parsed.name || 'image'); }}
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
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
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
          </>
        );
      } else if (parsed.type === 'file') {
        isMedia = true;
        const fileUrl = parsed.url || parsed.data;
        const sizeStr = parsed.size < 1024 * 1024 
          ? (parsed.size / 1024).toFixed(1) + ' KB' 
          : (parsed.size / (1024 * 1024)).toFixed(1) + ' MB';
        mainContent = (
          <a 
            href={fileUrl} 
            onClick={(e) => { e.preventDefault(); downloadFile(fileUrl, parsed.name); }}
            className="message-file" 
            style={{textDecoration:'none', color:'inherit', display:'block'}}
          >
            <span className="message-file-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--messenger-blue)', display:'block'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </span>
            <div>
              <div className="message-file-name">{parsed.name}</div>
              <div className="message-file-size">{sizeStr}</div>
            </div>
          </a>
        );
      } else if (parsed.type === 'location') {
        isMedia = true;
        const mapUrl = `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`;
        mainContent = (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="message-location" style={{textDecoration:'none', color:'inherit'}}>
            <div className="message-location-map" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--error)', display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
            <div className="message-location-text">
              {t('chat.locationShared') || 'Đã chia sẻ vị trí'}<br/>
              <small>{parsed.lat.toFixed(4)}, {parsed.lng.toFixed(4)}</small>
            </div>
          </a>
        );
      }
    } catch(e) {}

    if (!mainContent) {
      mainContent = msg.content;
    }

    if (msg.payload?.reply_to) {
      return (
        <div className="message-bubble reply-wrapper" style={{ padding: isMedia ? '6px 8px 6px' : '8px 12px' }}>
          {renderReplyPreview()}
          {mainContent}
        </div>
      );
    }

    if (isMedia) return mainContent;
    return <div className="message-bubble">{mainContent}</div>;
  };

  const handleClick = (e) => {
    if (e.target.closest('.message-file') || e.target.closest('.message-image') || e.target.closest('.message-location')) return;
    if (setActiveMessageId) {
      setActiveMessageId(activeMessageId === msg.id ? null : msg.id);
    } else {
      setLocalShowTime(!localShowTime);
    }
  };

  return (
    <div 
      className={`message-row ${isSent ? 'sent' : 'received'}`} 
      data-message-id={msg.id} 
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      style={{ marginTop: (!isSent && showSender) ? '12px' : undefined }}
    >
      <div className="message-row-core" style={{ display: 'flex', gap: '6px', flexDirection: isSent ? 'row-reverse' : 'row', alignItems: 'flex-end', width: '100%' }}>
        {!isSent && (
          <div className="message-avatar" style={{ visibility: showAvatar ? 'visible' : 'hidden', margin: 0 }}>
            {displayAvatar ? (
              <img src={displayAvatar} alt={displaySenderName} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%'}} />
            ) : (
              getInitials(displaySenderName)
            )}
          </div>
        )}
        
        <div className="message-content" style={{ display: 'flex', flexDirection: 'column', alignItems: isSent ? 'flex-end' : 'flex-start', minWidth: 0, flex: 1 }}>
          {!isSent && msg.sender_name && showSender && (
            <div className="message-sender">{displaySenderName}</div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexDirection: isSent ? 'row-reverse' : 'row', maxWidth: '100%' }}>
            {renderContent()}
            <div className="msg-actions" style={{ display: 'flex', gap: '2px', flexDirection: isSent ? 'row' : 'row-reverse' }}>
              {onDelete && (
                <button 
                  className={`msg-action-btn delete-btn ${showTime ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  title={t('chat.deleteMsg') || 'Xóa'}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
              {onReply && (
                <button 
                  className={`msg-action-btn reply-btn ${showTime ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onReply(msg); }}
                  title={t('chat.reply') || 'Trả lời'}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v2.5"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showTime && (
        <div className="message-time-row" style={{ 
          margin: '2px 0 0', 
          paddingLeft: isSent ? '0' : '34px', /* 28px avatar + 6px gap */
          width: '100%',
          textAlign: isSent ? 'right' : 'left'
        }}>
          <span className="message-time" style={{fontSize:'11px', color:'var(--text-muted)'}}>
            {formatTime(msg.created_at, { t })}
            {isSent && (
              <>
                {' • '}
                {msg.status === 'seen' ? (t('chat.seen') || 'Đã xem') : 
                 msg.status === 'sending' ? (t('chat.sending') || 'Đang gửi...') :
                 msg.status === 'failed' ? (t('chat.failed') || 'Gửi lỗi') : 
                 (t('chat.sentStatus') || 'Đã gửi')}
              </>
            )}
          </span>
        </div>
      )}

      {contextMenu && (
        <div 
          className="context-menu" 
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 100), 
            left: Math.min(contextMenu.x, window.innerWidth - 160)
          }}
        >
          <button 
            onClick={handleCopy}
            className="context-menu-item"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-primary)'}}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>{t('chat.copy') || 'Copy'}</span>
          </button>
          {isSent && (
            <button 
              onClick={handleDelete}
              className="context-menu-item delete"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              <span>{t('chat.deleteMsg') || 'Xóa'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SystemMessage({ text }) {
  return (
    <div className="system-message">
      <span className="time-divider">{text}</span>
    </div>
  );
}

export function TypingIndicator({ name, avatar }) {
  const { t } = useLanguage();
  return (
    <div className="message-row received typing-indicator-row" style={{ animation: 'none', marginBottom: '12px', marginTop: '18px', alignSelf: 'center', width: '100%', maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>
      <div className="message-row-core" style={{ display: 'flex', gap: '6px', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        {avatar && (
          <div className="message-avatar" style={{ margin: 0 }}>
            <img src={avatar} alt={name} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%'}} />
          </div>
        )}
        <div className="message-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: 'row', maxWidth: '100%', justifyContent: 'center' }}>
            <div className="typing-dots" style={{ display: 'flex', alignItems: 'center' }}>
              <span></span><span></span><span></span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', position: 'relative', top: '1.5px' }}>
              {name} {t('chat.typing') || 'đang gõ...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
