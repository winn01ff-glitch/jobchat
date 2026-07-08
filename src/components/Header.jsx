'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRouter, usePathname } from 'next/navigation';
import { DB } from '../lib/supabase';
import { showConfirmModal } from '../lib/helpers';
import AdminSettingsModal from './AdminSettingsModal';
import ApplicantSettingsModal from './ApplicantSettingsModal';
import { useNotification } from '../context/NotificationContext';

const getLangName = (l) => {
  switch (l) {
    case 'vi': return 'Tiếng Việt';
    case 'ja': return '日本語';
    case 'en': return 'English';
    case 'my': return 'မြန်မာဘာသာ';
    case 'pt': return 'Português';
    default: return 'Tiếng Việt';
  }
};

export default function Header() {
  const { lang, changeLanguage, t } = useLanguage();
  const { showToast } = useNotification();
  const router = useRouter();
  const pathname = usePathname();
  const isChatPage = pathname && pathname.startsWith('/chat/');
  const applicantId = isChatPage ? pathname.split('/chat/')[1] : null;
  const menuRef = useRef(null);
  
  const [adminName, setAdminName] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isApplicantLoggedIn, setIsApplicantLoggedIn] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showApplicantSettings, setShowApplicantSettings] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLangOptions, setShowLangOptions] = useState(false);

  useEffect(() => {
    const updateVisualViewport = () => {
      if (window.visualViewport) {
        document.documentElement.style.setProperty(
          '--visual-viewport-height',
          `${window.visualViewport.height}px`
        );
        // Force scroll reset to keep fixed elements in place when typing
        const isChatActive = document.body.classList.contains('chat-page-active') || 
                             document.body.classList.contains('chat-active-mobile');
        if (isChatActive && (window.scrollX !== 0 || window.scrollY !== 0)) {
          window.scrollTo(0, 0);
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateVisualViewport);
      window.visualViewport.addEventListener('scroll', updateVisualViewport);
      // Run immediately and also delayed to account for loading/rendering delays
      updateVisualViewport();
      setTimeout(updateVisualViewport, 300);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateVisualViewport);
        window.visualViewport.removeEventListener('scroll', updateVisualViewport);
      }
    };
  }, []);

  useEffect(() => {
    // Check login states
    const checkAuth = async () => {
      const adminSession = await DB.getAdminSession();
      if (adminSession) {
        setIsAdminLoggedIn(true);
        setAdminName(adminSession.profile.display_name);
      } else {
        setIsAdminLoggedIn(false);
      }

      const applicantToken = localStorage.getItem('jobchat_session');
      if (applicantToken) {
        setIsApplicantLoggedIn(true);
      } else {
        setIsApplicantLoggedIn(false);
      }
    };

    checkAuth();
    
    // Custom event listener for auth changes to trigger header re-render
    const handleAuthChange = () => checkAuth();
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
        setShowLangOptions(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMoreMenu]);

  const goBack = () => {
    if (pathname === '/admin/login') {
      router.push('/');
    } else if (pathname.startsWith('/admin')) {
      router.push('/admin/dashboard');
    } else if (pathname.startsWith('/jobs/')) {
      router.push('/jobs');
    } else if (pathname === '/jobs') {
      router.push('/');
    } else {
      router.push('/');
    }
  };

  const handleCallClick = () => {
    showConfirmModal(
      t('chat.confirmCallTitle') || 'Xác nhận cuộc gọi',
      t('chat.confirmCallManagerMessage') || 'Bạn có chắc chắn muốn thực hiện cuộc gọi tới bộ phận quản lý (07015528761)?',
      () => {
        window.open('tel:07015528761', '_self');
      },
      t('chat.call') || 'Gọi',
      { t }
    );
  };

  const handleClearHistoryClick = () => {
    setShowMoreMenu(false);
    showConfirmModal(
      t('chat.clearHistoryTitle') || 'Xóa lịch sử trò chuyện',
      t('chat.confirmClearHistory') || 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện cục bộ không? Hành động này không thể hoàn tác.',
      () => {
        window.dispatchEvent(new CustomEvent('chat-clear-history'));
      },
      t('common.delete') || 'Xóa',
      { t }
    );
  };

  const handleAdminLogout = () => {
    showConfirmModal(
      t('admin.confirmLogoutTitle') || 'Xác nhận đăng xuất',
      t('admin.confirmLogoutText') || 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống quản trị?',
      async () => {
        await DB.adminLogout();
        window.dispatchEvent(new Event('authChange'));
        router.push('/admin/login');
      },
      t('admin.logout') || 'Đăng xuất',
      { t }
    );
  };

  const handleApplicantLogout = () => {
    showConfirmModal(
      t('chat.confirmLogoutTitle') || 'Xác nhận đăng xuất',
      t('chat.confirmLogoutText') || 'Bạn có chắc chắn muốn đăng xuất khỏi phiên chat hiện tại không?',
      () => {
        localStorage.removeItem('jobchat_session');
        window.dispatchEvent(new Event('authChange'));
        router.push('/');
      },
      t('chat.logout') || 'Thoát',
      { t }
    );
  };



  // Determine visibility
  const showBackButton = pathname !== '/' && pathname !== '/admin/dashboard' && !pathname.startsWith('/chat');
  const showAdminLogin = pathname === '/';
  const showAdminControls = isAdminLoggedIn && pathname.startsWith('/admin');
  const showApplicantLogout = isApplicantLoggedIn && pathname.startsWith('/chat');
  const isLogoClickable = !pathname.startsWith('/chat') && (!pathname.startsWith('/admin') || pathname === '/admin/login');

  return (
    <header id="app-header" className="glass-header">
      <div className="header-left">
        {showBackButton && (
          <button id="btn-back" className="btn-icon" onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
        )}
        <h1 className="logo" onClick={() => { if (isLogoClickable) router.push('/'); }} style={{cursor: isLogoClickable ? 'pointer' : 'default'}}>
          Up<span className="logo-accent">hill</span>
        </h1>
      </div>
      <div className="header-right">
        {isChatPage && (
          <div style={{display:'flex', gap:'8px', position: 'relative', alignItems: 'center', marginRight: '4px'}}>
            <button className="btn-icon" onClick={handleCallClick} title={t('chat.callManager') || 'Gọi cho quản lý'} style={{color:'var(--messenger-blue)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </button>
            <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }} title="Thêm tùy chọn" style={{color: showMoreMenu ? 'var(--messenger-blue)' : 'var(--text-muted)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
            </button>
            {showMoreMenu && (
              <div ref={menuRef} className="header-more-menu" onClick={(e) => e.stopPropagation()} style={{marginTop: '11.5px'}}>
                <div 
                  className="header-dropdown-item" 
                  style={{display: 'flex', alignItems: 'center', gap: '8px', width: '100%', position: 'relative', padding: '10px 12px'}}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-secondary)'}}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
                  <span>
                    {t('common.language') || 'Ngôn ngữ'}
                  </span>
                  <select 
                    value={lang} 
                    onChange={(e) => { changeLanguage(e.target.value); setShowMoreMenu(false); }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      WebkitAppearance: 'menulist-button',
                      zIndex: 2
                    }}
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                    <option value="my">မြန်မာဘာသာ</option>
                    <option value="pt">Português</option>
                  </select>
                  <span style={{ marginLeft: 'auto', color: 'var(--messenger-blue)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                    {getLangName(lang)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-secondary)'}}><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </span>
                </div>
                <button className="header-dropdown-item" onClick={handleClearHistoryClick}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  <span>{t('chat.clearHistory') || 'Xóa lịch sử trò chuyện'}</span>
                </button>
                <button className="header-dropdown-item" onClick={() => { setShowMoreMenu(false); setShowApplicantSettings(true); }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-primary)'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  <span>{t('admin.settings') || 'Cài đặt tài khoản'}</span>
                </button>
                <div style={{height: '1px', background: 'var(--border-light)', margin: '4px 8px'}}></div>
                <button className="header-dropdown-item danger" onClick={() => { setShowMoreMenu(false); handleApplicantLogout(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span>{t('chat.logout') || 'Đăng xuất'}</span>
                </button>
              </div>
            )}
          </div>
        )}
        {!isChatPage && (
          <div id="lang-switcher" className="lang-dropdown-wrapper">
            <select 
              id="lang-select" 
              className="lang-select" 
              value={lang} 
              onChange={(e) => changeLanguage(e.target.value)}
            >
              <option value="ja">🇯🇵 JP</option>
              <option value="vi">🇻🇳 VN</option>
              <option value="en">🇬🇧 EN</option>
              <option value="my">🇲🇲 MM</option>
              <option value="pt">🇧🇷 BR</option>
            </select>
          </div>
        )}
        
        {showAdminLogin && (
          <button id="btn-admin-login" className="btn-admin-login" onClick={() => router.push('/admin/login')}>
            {t('landing.adminLink') || 'Đăng nhập Quản lý'}
          </button>
        )}

        {showAdminControls && (
          <>
            <span className="admin-header-divider" style={{ margin: '0 8px 0 6px' }}></span>
            <div id="admin-header-controls" className="admin-header-controls">
              <span id="admin-header-name" className="admin-header-name">{adminName}</span>
              <button className="btn-settings" onClick={() => setShowSettings(true)} title="Settings">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <span className="admin-header-divider"></span>
              <button className="btn-admin-logout" onClick={handleAdminLogout} title={t('admin.logout') || 'Đăng xuất'}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              </button>
            </div>
          </>
        )}

        {showApplicantLogout && !isChatPage && (
          <button id="btn-chat-logout" className="btn-chat-logout" onClick={handleApplicantLogout}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>{t('chat.logout')}</span>
          </button>
        )}
      </div>

      <AdminSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <ApplicantSettingsModal 
        isOpen={showApplicantSettings} 
        onClose={() => setShowApplicantSettings(false)} 
        applicantId={applicantId} 
      />
    </header>
  );
}
