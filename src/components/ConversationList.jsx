import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getInitials, formatTime } from '../lib/helpers';

export default function ConversationList({ 
  applicants, 
  selectedId, 
  onSelect, 
  filter, 
  setFilter, 
  searchQuery, 
  setSearchQuery,
  typingStates
}) {
  const { t } = useLanguage();

  const parseMessagePreview = (content) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'image') return '📷 ' + (t('chat.image') || 'Ảnh');
      if (parsed.type === 'file') return '📎 ' + parsed.name;
      if (parsed.type === 'location') return '📍 ' + (t('chat.location') || 'Vị trí');
    } catch(e) {}
    return content.length > 40 ? content.substring(0, 40) + '...' : content;
  };

  const filtered = applicants.filter(a => {
    const term = searchQuery.toLowerCase();
    if (term && !a.name.toLowerCase().includes(term) && !(a.phone || '').includes(term)) {
      return false;
    }
    if (filter === 'unread') {
      return a._hasUnread;
    }
    return true;
  });

  return (
    <div className="admin-sidebar" id="admin-sidebar">
      <div className="sidebar-search">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            id="search-input" 
            placeholder={t('admin.search') || 'Tìm kiếm...'} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="sidebar-filters">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`} 
          onClick={() => setFilter('all')}
        >
          {t('admin.filterAll') || 'Tất cả'}
        </button>
        <button 
          className={`filter-tab ${filter === 'unread' ? 'active' : ''}`} 
          onClick={() => setFilter('unread')}
        >
          {t('admin.filterUnread') || 'Chưa đọc'}
        </button>
      </div>
      
      <div className="conversation-list" id="conversation-list">
        {filtered.length === 0 ? (
          <div style={{padding: '40px', textAlign: 'center', color: 'var(--text-muted)'}}>
            <p>📭 {t('admin.noConversations') || 'Chưa có cuộc trò chuyện nào'}</p>
          </div>
        ) : (
          filtered.map(applicant => {
            const timeStr = applicant.lastMsg ? formatTime(applicant.lastMsg.created_at, { t }) : formatTime(applicant.created_at, { t });
            const isTyping = typingStates && typingStates[applicant.id];
            const lastMsgText = isTyping 
              ? (t('chat.typing') || 'đang gõ...') 
              : (applicant.lastMsg ? parseMessagePreview(applicant.lastMsg.content) : (t('admin.newApplicant') || 'Ứng viên mới'));
            
            return (
              <div 
                key={applicant.id} 
                className={`conversation-item ${selectedId === applicant.id ? 'active' : ''} ${applicant._hasUnread ? 'unread' : ''}`}
                onClick={() => onSelect(applicant.id)}
              >
                <div className="conv-avatar">{getInitials(applicant.name)}</div>
                <div className="conv-info">
                  <div className="conv-name" style={{ fontWeight: applicant._hasUnread ? '800' : '600' }}>
                    {applicant.name}
                    <span className="conv-time" style={{ fontWeight: '400' }}>{timeStr}</span>
                  </div>
                  <div className="conv-last-msg" style={{ 
                    fontWeight: applicant._hasUnread ? '700' : '400', 
                    color: isTyping ? 'var(--messenger-blue)' : (applicant._hasUnread ? 'var(--text-primary)' : 'var(--text-muted)') 
                  }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, fontWeight: isTyping ? '600' : undefined }}>
                      {lastMsgText}
                    </span>
                    {applicant._hasUnread && <span className="unread-dot-badge"></span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
