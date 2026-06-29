import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { DB } from '../lib/supabase';
import { showConfirmModal, formatSalary, showToast } from '../lib/helpers';
import JobFormModal from './JobFormModal';

export default function JobPreviewPanel({ jobId, onBack, onDelete, isSidebarCollapsed, onToggleSidebar }) {
  const { t } = useLanguage();
  const [job, setJob] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isCopied, setIsCopied] = useState(false);


  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadJob = async () => {
    const jobs = await DB.getAllJobs();
    const found = jobs.find(j => j.id === jobId);
    setJob(found || null);
  };

  useEffect(() => {
    if (jobId) loadJob();
  }, [jobId]);

  const handleDelete = () => {
    showConfirmModal(
      t('admin.confirmDeleteJobTitle') || 'Xóa bài đăng',
      t('admin.confirmDeleteJobText') || 'Bạn có chắc chắn muốn xóa bài đăng này?',
      async () => {
        await DB.deleteJob(job.id);
        window.dispatchEvent(new Event('jobsUpdated'));
        if (onDelete) onDelete();
        if (isMobile) onBack();
      },
      t('admin.delete') || 'Xóa',
      { t }
    );
  };

  const handleCopyLink = async () => {
    if (!job) return;
    const publicUrl = `${window.location.origin}/jobs/${job.id}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      showToast(t('jobs.linkCopied') || 'Đã sao chép liên kết bài viết!', 'success');
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      showToast(t('common.error') || 'Có lỗi xảy ra khi sao chép liên kết.', 'error');
    }
  };

  if (!job) return <div className="admin-empty-state"><p>Loading...</p></div>;

  const posLabel = t('register.positions.' + job.position) || job.position || '';
  const statusBadge = job.status === 'published' 
    ? <span style={{padding:'4px 12px', background:'rgba(0, 132, 255, 0.12)', color:'#0084ff', borderRadius:'16px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'4px'}}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><polyline points="20 6 9 17 4 12"/></svg> {t('admin.statusPublished') || 'Published'}</span>
    : <span style={{padding:'4px 12px', background:'rgba(46, 204, 113, 0.12)', color:'#2e7d32', borderRadius:'16px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'4px'}}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {t('admin.statusDraft') || 'Draft'}</span>;

  const parseJobContent = (rawContent) => {
    try {
      const data = JSON.parse(rawContent);
      if (data && typeof data === 'object' && 'description' in data) {
        return {
          description: data.description || '',
          bonus: data.bonus || '',
          nenkin: data.nenkin || '',
          insurance: data.insurance || '',
          raise: data.raise || '',
          transport: data.transport || ''
        };
      }
    } catch (e) {}
    return {
      description: rawContent || '',
      bonus: '',
      nenkin: '',
      insurance: '',
      raise: '',
      transport: ''
    };
  };

  const parsed = parseJobContent(job.content || '');
  const hasWelfare = [parsed.bonus, parsed.nenkin, parsed.insurance, parsed.raise, parsed.transport].some(
    val => val && val !== 'none' && val !== ''
  );

  return (
    <div className="job-applicant-preview" style={{ height:'100%', background:'var(--bg-primary)', display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowY: 'hidden', position: 'relative' }}>
      
      {/* Admin Actions Toolbar (Fixed at top) */}
      <div className="job-ap-toolbar" style={{ 
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        {/* Left side: Back / Sidebar Toggle Button */}
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
          title={isSidebarCollapsed ? (t('admin.expand') || "Mở rộng") : (t('admin.collapse') || "Thu gọn")}
        >
          {isMobile ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          ) : isSidebarCollapsed ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          )}
        </button>

        {/* Right side: Status, Edit, Delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>{statusBadge}</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn-icon"
              style={{ color: 'var(--messenger-blue)' }}
              title={t('admin.editJob') || 'Sửa'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button 
              onClick={handleDelete} 
              className="btn-icon"
              style={{ color: 'var(--error)' }}
              title={t('admin.deleteJob') || 'Xóa'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Wrapper */}
      <div style={{ padding: '20px 20px 80px 20px', flex: 1, overflowY: 'auto' }}>
        {/* Candidate View Preview Container */}
        <div className="job-detail-page" style={{ padding: '0', minHeight: 'auto', height: 'auto', overflow: 'visible' }}>
          <div className="job-detail-content-wrapper" style={{ padding: '0', border: 'none', background: 'transparent', overflowY: 'visible' }}>
            <div className="job-detail-inner" style={{ padding: '0' }}>
              <h1 className="job-detail-title">{job.title}</h1>
              
              <div className="job-detail-meta">
                {job.position && (
                  <div className="job-detail-meta-item position">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    <span>{t('register.positions.' + job.position) || job.position}</span>
                  </div>
                )}
                {job.salary && (
                  <div className="job-detail-meta-item salary">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                    <span>{formatSalary(job.salary, t)}</span>
                  </div>
                )}
                {job.location && (
                  <div className="job-detail-meta-item location">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>{job.location}</span>
                  </div>
                )}
              </div>

              {hasWelfare && (
                <div className="job-detail-section">
                  <h4 className="section-title">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>{t('jobs.welfare') || 'Chế độ & Phúc lợi'}</span>
                  </h4>
                  <div className="welfare-grid">
                    {parsed.bonus && parsed.bonus !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box bonus">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 12 20 22 4 22 4 12"></polyline>
                            <rect x="2" y="7" width="20" height="5"></rect>
                            <line x1="12" y1="22" x2="12" y2="7"></line>
                            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.bonus')}</div>
                          <div className="welfare-value">
                            {['twice_a_year', 'once_a_year', 'performance'].includes(parsed.bonus) ? t(`jobs.jobFields.bonusOptions.${parsed.bonus}`) : parsed.bonus}
                          </div>
                        </div>
                      </div>
                    )}
                    {((parsed.insurance && parsed.insurance !== 'none') || (parsed.nenkin && parsed.nenkin !== 'none')) && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box insurance">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.insurance')}</div>
                          <div className="welfare-value">
                            {parsed.insurance && parsed.insurance !== 'none' ? (
                              ['full', 'partial'].includes(parsed.insurance) ? t(`jobs.jobFields.insuranceOptions.${parsed.insurance}`) : parsed.insurance
                            ) : (
                              ['full'].includes(parsed.nenkin) ? t(`jobs.jobFields.nenkinOptions.${parsed.nenkin}`) : parsed.nenkin
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {parsed.raise && parsed.raise !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box raise">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 18"></polyline>
                            <polyline points="17 6 23 6 23 12"></polyline>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.raise')}</div>
                          <div className="welfare-value">
                            {['once_a_year', 'performance'].includes(parsed.raise) ? t(`jobs.jobFields.raiseOptions.${parsed.raise}`) : parsed.raise}
                          </div>
                        </div>
                      </div>
                    )}
                    {parsed.transport && parsed.transport !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box transport">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#16a085" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="4" width="14" height="16" rx="2" ry="2"></rect>
                            <line x1="5" y1="9" x2="19" y2="9"></line>
                            <line x1="5" y1="14" x2="19" y2="14"></line>
                            <path d="M8 17h.01"></path>
                            <path d="M16 17h.01"></path>
                            <path d="M7 21v1"></path>
                            <path d="M17 21v1"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.transport')}</div>
                          <div className="welfare-value">
                            {['full', 'limited'].includes(parsed.transport) ? t(`jobs.jobFields.transportOptions.${parsed.transport}`) : parsed.transport}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="job-detail-section">
                <h4 className="section-title">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <span>{t('jobs.description') || 'Chi tiết công việc'}</span>
                </h4>
                <div className="job-detail-body">
                  {parsed.description}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleCopyLink} 
        className="btn-apply"
        style={{
          background: isCopied ? '#2ecc71' : 'var(--messenger-gradient)',
          boxShadow: isCopied ? '0 4px 12px rgba(46, 204, 113, 0.25)' : '0 4px 12px rgba(0, 132, 255, 0.25)',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '220px',
          height: '45px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '24px', overflow: 'hidden' }}>
          {/* Normal state */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: isCopied ? 0 : 1,
            transform: isCopied ? 'translateY(-24px)' : 'translateY(0)',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span>{t('jobs.copyLink') || 'Copy link bài viết'}</span>
          </div>

          {/* Copied state */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: isCopied ? 1 : 0,
            transform: isCopied ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{t('jobs.copied') || 'Đã sao chép!'}</span>
          </div>
        </div>
      </button>

      <JobFormModal 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
        job={job} 
        onSave={() => { 
          setIsEditing(false); 
          loadJob(); 
          window.dispatchEvent(new Event('jobsUpdated'));
        }} 
      />
    </div>
  );
}
