'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { DB } from '../../../lib/supabase';
import ConversationList from '../../../components/ConversationList';
import AdminChat from '../../../components/AdminChat';
import JobManagement from '../../../components/JobManagement';
import JobPreviewPanel from '../../../components/JobPreviewPanel';

function DashboardContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [adminSession, setAdminSession] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [typingStates, setTypingStates] = useState({});

  // Sync tab and selected ID from URL search parameters
  useEffect(() => {
    const tabParam = searchParams ? searchParams.get('tab') : null;
    if (tabParam === 'jobs' || tabParam === 'chats') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('chats');
    }
    
    const idParam = searchParams ? searchParams.get('id') : null;
    if (idParam) {
      setSelectedId(idParam);
      if (window.innerWidth <= 768) {
        setIsMobileChatActive(true);
      }
    } else {
      setSelectedId(null);
      setIsMobileChatActive(false);
    }
  }, [searchParams]);

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

      // Subscribe to all changes in applicants (insert, update, delete)
      const sub1 = DB.subscribeToApplicants((payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        if (eventType === 'INSERT') {
          setApplicants(prev => {
            if (prev.find(a => a.id === newRecord.id)) return prev;
            return [newRecord, ...prev];
          });
        } else if (eventType === 'UPDATE') {
          setApplicants(prev => prev.map(a => a.id === newRecord.id ? { ...a, ...newRecord } : a));
        } else if (eventType === 'DELETE') {
          setApplicants(prev => prev.filter(a => a.id !== oldRecord.id));
          
          // Clear ID from URL if selected applicant is deleted
          const params = new URLSearchParams(window.location.search);
          if (params.get('id') === oldRecord.id) {
            params.delete('id');
            const newQuery = params.toString();
            router.replace(`${window.location.pathname}${newQuery ? '?' + newQuery : ''}`);
          }
        }
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

  useEffect(() => {
    const subChannels = [];
    applicants.forEach(a => {
      const channel = DB.subscribeToTyping(a.id, (payload) => {
        if (payload.sender_type === 'applicant') {
          setTypingStates(prev => ({
            ...prev,
            [a.id]: payload.isTyping
          }));
        }
      });
      if (channel) subChannels.push(channel);
    });
    return () => {
      subChannels.forEach(c => DB.unsubscribe(c));
    };
  }, [applicants]);

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
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, _hasUnread: false } : a));
    const params = new URLSearchParams(window.location.search);
    params.set('id', id);
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const handleBackToSidebar = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete('id');
    const newQuery = params.toString();
    router.replace(`${window.location.pathname}${newQuery ? '?' + newQuery : ''}`);
  };

  const handleApplicantUpdate = (updatedApplicant) => {
    setApplicants(prev => prev.map(a => a.id === updatedApplicant.id ? { ...a, ...updatedApplicant } : a));
  };

  const handleApplicantDelete = (id) => {
    setApplicants(prev => prev.filter(a => a.id !== id));
    const params = new URLSearchParams(window.location.search);
    params.delete('id');
    const newQuery = params.toString();
    router.replace(`${window.location.pathname}${newQuery ? '?' + newQuery : ''}`);
  };

  useEffect(() => {
    const header = document.getElementById('app-header');
    const pageContainer = document.getElementById('page-container');
    if (isMobileChatActive) {
      if (header) header.style.display = 'none';
      if (pageContainer) {
        pageContainer.style.marginTop = '0';
        pageContainer.classList.add('chat-active-mobile');
      }
      document.body.style.height = '100dvh';
      document.body.style.overflow = 'hidden';
      document.body.classList.add('chat-active-mobile');
    } else {
      if (header) header.style.display = 'flex';
      if (pageContainer) {
        pageContainer.style.marginTop = 'var(--header-height)';
        pageContainer.classList.remove('chat-active-mobile');
      }
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.body.classList.remove('chat-active-mobile');
    }
    return () => {
      if (header) header.style.display = 'flex';
      if (pageContainer) {
        pageContainer.style.marginTop = 'var(--header-height)';
        pageContainer.classList.remove('chat-active-mobile');
      }
      document.body.style.height = '';
      document.body.style.overflow = '';
      document.body.classList.remove('chat-active-mobile');
    };
  }, [isMobileChatActive]);

  if (!adminSession) return null;

  return (
    <div className={`admin-container ${isMobileChatActive ? 'chat-active-mobile' : ''}`}>
      <div className={`admin-sidebar ${isMobileChatActive ? 'hidden-mobile' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`} id="admin-sidebar">
        
        {/* TABS */}
        <div className="admin-tab-bar" style={{ height: '48px', background: 'var(--bg-primary)' }}>
          <button 
            className={`admin-tab ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'chats');
              params.delete('id');
              router.replace(`${window.location.pathname}?${params.toString()}`);
            }}
          >
            {t('admin.chats') || 'Tin nhắn'}
          </button>
          <button 
            className={`admin-tab ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set('tab', 'jobs');
              params.delete('id');
              router.replace(`${window.location.pathname}?${params.toString()}`);
            }}
          >
            {t('admin.jobPosts') || 'Việc làm'}
          </button>
        </div>

        {/* Sliding wrapper container for Tabs */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ 
            display: 'flex', 
            width: '200%', 
            height: '100%', 
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
            transform: activeTab === 'chats' ? 'translateX(0)' : 'translateX(-50%)' 
          }}>
            {/* Chats pane */}
            <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ConversationList 
                applicants={applicants}
                selectedId={selectedId}
                onSelect={handleSelectConversation}
                filter={filter}
                setFilter={setFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                typingStates={typingStates}
              />
            </div>
            {/* Jobs pane */}
            <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <JobManagement 
                onSelectJob={(id) => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('id', id);
                  router.replace(`${window.location.pathname}?${params.toString()}`);
                }}
                selectedJobId={selectedId}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className={`admin-chat-area ${!isMobileChatActive ? 'hidden-mobile' : ''}`} id="admin-chat-area">
        {activeTab === 'chats' ? (
          selectedId ? (
            <AdminChat 
              applicantId={selectedId} 
              adminSession={adminSession}
              onBack={handleBackToSidebar}
              onDelete={handleApplicantDelete}
              onApplicantUpdate={handleApplicantUpdate}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
          ) : (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <p>{t('admin.selectConversation') || 'Chọn cuộc trò chuyện'}</p>
            </div>
          )
        ) : (
          selectedId ? (
            <JobPreviewPanel jobId={selectedId} onBack={handleBackToSidebar} onDelete={handleBackToSidebar} />
          ) : (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              </div>
              <p>{t('admin.selectJobPreview') || 'Chọn bài đăng để xem'}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner"></div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
