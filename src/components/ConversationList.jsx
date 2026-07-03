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
    <div className="conversation-list-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
                <div className="conv-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {applicant.avatar ? (
                    <img src={applicant.avatar} alt={applicant.name} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%'}} />
                  ) : (
                    getInitials(applicant.name)
                  )}
                </div>
                <div className="conv-info">
                  <div className="conv-name" style={{ fontWeight: applicant._hasUnread ? '800' : '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{applicant.name}</span>
                    <span className="conv-time" style={{ fontWeight: '400', flexShrink: 0 }}>{timeStr}</span>
                  </div>
                  {applicant.applied_job_title && (
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--messenger-blue)',
                      background: 'rgba(0, 132, 255, 0.08)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      width: 'fit-content',
                      marginTop: '2px',
                      marginBottom: '2px',
                      fontWeight: '600',
                      maxWidth: '100%',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}>
                      {t('admin.appliedFrom') || 'Ứng tuyển từ'}: {applicant.applied_job_title}
                    </div>
                  )}
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
