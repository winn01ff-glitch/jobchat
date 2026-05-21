'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { DB } from '../../../lib/supabase';
import ConversationList from '../../../components/ConversationList';
import AdminChat from '../../../components/AdminChat';
import JobManagement from '../../../components/JobManagement';
import JobPreviewPanel from '../../../components/JobPreviewPanel';

export default function AdminDashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();

  const [adminSession, setAdminSession] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);

  useEffect(() => {
    // Check auth
    let subs = [];
    const init = async () => {
      const session = await DB.getAdminSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      setAdminSession(session);

      await loadApplicants();

      // Subscribe to new applicants
      const sub1 = DB.subscribeToNewApplicants((applicant) => {
        setApplicants(prev => {
          if (prev.find(a => a.id === applicant.id)) return prev;
          return [applicant, ...prev];
        });
      });
      if (sub1) subs.push(sub1);

      // Subscribe to all messages
      const sub2 = DB.subscribeToAllMessages((msg) => {
        loadApplicants(); // Reload to get latest message and unread status
      });
      if (sub2) subs.push(sub2);
    };

    init();

    return () => {
      subs.forEach(sub => DB.unsubscribe(sub));
    };
  }, [router]);

  const loadApplicants = async () => {
    try {
      const data = await DB.getAllApplicants();
      
      // Deduplicate
      const seenIds = new Set();
      const unique = data.filter(a => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      // Fetch last messages
      const enhanced = await Promise.all(unique.map(async (a) => {
        const lastMsg = await DB.getLastMessage(a.id);
        const hasUnread = lastMsg && lastMsg.sender_type === 'applicant' && (lastMsg.status === 'sent' || lastMsg.status === 'delivered');
        return { ...a, lastMsg, _hasUnread: hasUnread };
      }));

      // Sort by last message time
      enhanced.sort((a, b) => {
        const tA = a.lastMsg ? new Date(a.lastMsg.created_at).getTime() : new Date(a.created_at).getTime();
        const tB = b.lastMsg ? new Date(b.lastMsg.created_at).getTime() : new Date(b.created_at).getTime();
        return tB - tA;
      });

      setApplicants(enhanced);
    } catch(err) {
      console.error(err);
    }
  };

  const handleSelectConversation = (id) => {
    setSelectedId(id);
    if (window.innerWidth <= 768) {
      setIsMobileChatActive(true);
    }
  };

  const handleBackToSidebar = () => {
    setIsMobileChatActive(false);
  };

  const [activeTab, setActiveTab] = useState('chats');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Hide global header on mobile when chat is active
  useEffect(() => {
    const header = document.getElementById('app-header');
    const pageContainer = document.getElementById('page-container');
    if (isMobileChatActive) {
      if (header) header.style.display = 'none';
      if (pageContainer) pageContainer.style.marginTop = '0';
      document.body.style.height = '100dvh';
      document.body.style.overflow = 'hidden';
    } else {
      if (header) header.style.display = 'flex';
      if (pageContainer) pageContainer.style.marginTop = 'var(--header-height)';
      document.body.style.height = '';
      document.body.style.overflow = '';
    }
    return () => {
      if (header) header.style.display = 'flex';
      if (pageContainer) pageContainer.style.marginTop = 'var(--header-height)';
      document.body.style.height = '';
      document.body.style.overflow = '';
    };
  }, [isMobileChatActive]);

  if (!adminSession) return null; // or loading

  return (
    <div className={`admin-container ${isMobileChatActive ? 'chat-active-mobile' : ''}`}>
      <div className={`admin-sidebar ${isMobileChatActive ? 'hidden-mobile' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`} id="admin-sidebar">

        
        {/* TABS */}
        <div style={{ display: 'flex', height: '60px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
          <button 
            style={{ flex: 1, height: '100%', padding: '0', background: 'none', border: 'none', borderBottom: activeTab === 'chats' ? '2px solid var(--messenger-blue)' : '2px solid transparent', color: activeTab === 'chats' ? 'var(--messenger-blue)' : 'var(--text-muted)', fontWeight: activeTab === 'chats' ? '600' : '400', cursor: 'pointer' }}
            onClick={() => setActiveTab('chats')}
          >
            {t('admin.chats') || 'Tin nhắn'}
          </button>
          <button 
            style={{ flex: 1, height: '100%', padding: '0', background: 'none', border: 'none', borderBottom: activeTab === 'jobs' ? '2px solid var(--messenger-blue)' : '2px solid transparent', color: activeTab === 'jobs' ? 'var(--messenger-blue)' : 'var(--text-muted)', fontWeight: activeTab === 'jobs' ? '600' : '400', cursor: 'pointer' }}
            onClick={() => setActiveTab('jobs')}
          >
            {t('admin.jobPosts') || 'Việc làm'}
          </button>
        </div>

        {activeTab === 'chats' ? (
          <ConversationList 
            applicants={applicants}
            selectedId={selectedId}
            onSelect={handleSelectConversation}
            filter={filter}
            setFilter={setFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : (
          <JobManagement 
            onSelectJob={(id) => { setSelectedId(id); if (window.innerWidth <= 768) setIsMobileChatActive(true); }}
            selectedJobId={selectedId}
          />
        )}
      </div>
      
      <div className={`admin-chat-area ${!isMobileChatActive ? 'hidden-mobile' : ''}`} id="admin-chat-area">
        {activeTab === 'chats' ? (
          selectedId ? (
            <AdminChat 
              applicantId={selectedId} 
              adminSession={adminSession}
              onBack={handleBackToSidebar}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          ) : (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">💬</div>
              <p>{t('admin.selectConversation') || 'Chọn cuộc trò chuyện'}</p>
            </div>
          )
        ) : (
          selectedId ? (
            <JobPreviewPanel jobId={selectedId} onBack={handleBackToSidebar} onDelete={() => setSelectedId(null)} />
          ) : (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">📋</div>
              <p>{t('admin.selectJobPreview') || 'Chọn bài đăng để xem'}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
