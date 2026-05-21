import React from 'react';
import { formatTime, getInitials, showConfirmModal } from '../lib/helpers';
import { useLanguage } from '../context/LanguageContext';

export function ChatBubble({ msg, isSent, showSender = true, onDelete, adminInfo = null, showAvatar = true }) {
  const { t } = useLanguage();
  const [showTime, setShowTime] = React.useState(false);
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
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchTimer.current = setTimeout(() => {
      setContextMenu({
        x: touch.clientX,
        y: touch.clientY
      });
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

  const renderContent = () => {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.type === 'image') {
        return (
          <>
            <img 
              className="message-image" 
              src={parsed.data} 
              alt={parsed.name} 
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              style={{cursor: 'pointer'}}
            />
            {lightboxOpen && (
              <div 
                className="lightbox-overlay" 
                style={{
                  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                  background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(false);
                }}
              >
                <img src={parsed.data} alt={parsed.name} style={{maxWidth: '90%', maxHeight: '90%', borderRadius: '8px'}} />
                <button 
                  style={{position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'white', fontSize: '30px', cursor: 'pointer'}}
                  onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
                >✕</button>
              </div>
            )}
          </>
        );
      }
      if (parsed.type === 'file') {
        const sizeStr = parsed.size < 1024 * 1024 
          ? (parsed.size / 1024).toFixed(1) + ' KB' 
          : (parsed.size / (1024 * 1024)).toFixed(1) + ' MB';
        return (
          <a href={parsed.data} download={parsed.name} className="message-file" style={{textDecoration:'none', color:'inherit', display:'block'}}>
            <span className="message-file-icon">📄</span>
            <div>
              <div className="message-file-name">{parsed.name}</div>
              <div className="message-file-size">{sizeStr}</div>
            </div>
          </a>
        );
      }
      if (parsed.type === 'location') {
        const mapUrl = `https://www.google.com/maps?q=${parsed.lat},${parsed.lng}`;
        return (
          <a href={mapUrl} target="_blank" rel="noreferrer" className="message-location" style={{textDecoration:'none', color:'inherit'}}>
            <div className="message-location-map">📍</div>
            <div className="message-location-text">
              {t('chat.locationShared') || 'Đã chia sẻ vị trí'}<br/>
              <small>{parsed.lat.toFixed(4)}, {parsed.lng.toFixed(4)}</small>
            </div>
          </a>
        );
      }
    } catch(e) {}
    return <div className="message-bubble">{msg.content}</div>;
  };

  const handleClick = (e) => {
    if (e.target.closest('.message-file') || e.target.closest('.message-image') || e.target.closest('.message-location')) return;
    setShowTime(!showTime);
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
    >
      {!isSent && (
        <div className="message-avatar" style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
          {displayAvatar ? (
            <img src={displayAvatar} alt={displaySenderName} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%'}} />
          ) : (
            getInitials(displaySenderName)
          )}
        </div>
      )}
      {/* column-reverse: DOM first item = visual bottom, DOM second = visual top */}
      {/* So: time+delete renders at BOTTOM, bubble renders ABOVE it */}
      {/* When time shows, bubble shifts UP — avatar stays fixed */}
      <div className="message-content" style={{display:'flex', flexDirection:'column-reverse'}}>
        {/* === BOTTOM: timestamp + delete button === */}
        {showTime && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '2px 4px',
            justifyContent: isSent ? 'flex-end' : 'flex-start'
          }}>
            <span className="message-time" style={{fontSize:'11px', color:'var(--text-muted)'}}>{formatTime(msg.created_at, { t })}</span>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                style={{background:'none', border:'none', cursor:'pointer', color:'var(--error)', fontSize:'13px', padding:'0 2px', lineHeight:1, opacity:0.7}}
                title={t('chat.deleteMsg') || 'Xóa'}
              >🗑️</button>
            )}
          </div>
        )}
        {/* === TOP: sender name + bubble + seen status === */}
        <div>
          {!isSent && msg.sender_name && showSender && (
            <div className="message-sender">{displaySenderName}</div>
          )}
          {renderContent()}
          {isSent && msg.status === 'seen' && (
            <div style={{textAlign:'right', padding:'0 12px', fontSize:'11px', color:'var(--text-muted)'}}>{t('chat.seen') || 'Đã xem'}</div>
          )}
        </div>
      </div>

      {contextMenu && (
        <div 
          className="context-menu" 
          style={{
            position: 'fixed', 
            top: Math.min(contextMenu.y, window.innerHeight - 100), 
            left: Math.min(contextMenu.x, window.innerWidth - 160), 
            background: 'var(--bg-primary)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            padding: '8px 0',
            zIndex: 1000,
            minWidth: '120px'
          }}
        >
          <button 
            onClick={handleCopy}
            style={{display:'block', width:'100%', padding:'8px 16px', border:'none', background:'none', textAlign:'left', cursor:'pointer'}}
          >📋 {t('chat.copy') || 'Copy'}</button>
          {isSent && (
            <button 
              onClick={handleDelete}
              style={{display:'block', width:'100%', padding:'8px 16px', border:'none', background:'none', textAlign:'left', cursor:'pointer', color:'var(--error)'}}
            >🗑 {t('chat.deleteMsg') || 'Xóa'}</button>
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

export function TypingIndicator({ name }) {
  const { t } = useLanguage();
  return (
    <div className="typing-indicator" id="typing-indicator">
      <div className="typing-dots">
        <span></span><span></span><span></span>
      </div>
      <span>{name} {t('chat.typing') || 'đang gõ...'}</span>
    </div>
  );
}
