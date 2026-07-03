import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { DB } from '../lib/supabase';
import { showConfirmModal, formatSalary, showToast } from '../lib/helpers';
import JobFormModal from './JobFormModal';

const langNames = {
  vi: 'Tiếng Việt',
  en: 'English',
  ja: '日本語',
  my: 'မြန်မာဘာသာ',
  pt: 'Português'
};

export default function JobPreviewPanel({ jobId, onBack, onDelete, isSidebarCollapsed, onToggleSidebar }) {
  const { lang, t } = useLanguage();
  const [job, setJob] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isContentCopied, setIsContentCopied] = useState(false);
  
  const [translatedJob, setTranslatedJob] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);


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
    if (jobId) {
      loadJob();
      setTranslatedJob(null);
      setIsTranslated(false);
      setIsContentCopied(false);
    }
  }, [jobId]);

  const translateText = async (text, targetLang) => {
    if (!text || !targetLang) return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json[0]) {
        return json[0].map(item => item[0]).join('');
      }
    } catch (e) {
      console.error('Translation error:', e);
    }
    return text;
  };

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }
    setIsTranslating(true);
    try {
      const tTitle = await translateText(job.title, lang);
      const tLocation = await translateText(job.location, lang);
      const tDesc = await translateText(parsed.description, lang);
      setTranslatedJob({
        title: tTitle,
        location: tLocation,
        description: tDesc
      });
      setIsTranslated(true);
    } catch (e) {
      console.error(e);
      showToast(t('common.error') || 'Có lỗi xảy ra khi dịch.', 'error');
    } finally {
      setIsTranslating(false);
    }
  };

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

  const handleCopyContent = async () => {
    if (!job) return;
    const textToCopy = isTranslated && translatedJob ? translatedJob.description : parsed.description;
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast(t('jobs.contentCopiedToast') || 'Đã sao chép chi tiết công việc đang hiển thị!', 'success');
      setIsContentCopied(true);
      setTimeout(() => {
        setIsContentCopied(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      showToast(t('common.error') || 'Có lỗi xảy ra khi sao chép nội dung.', 'error');
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
          transport: data.transport || '',
          dormitory: data.dormitory || '',
          visa: data.visa || '',
          meal: data.meal || '',
          other: data.other || ''
        };
      }
    } catch (e) {}
    return {
      description: rawContent || '',
      bonus: '',
      nenkin: '',
      insurance: '',
      raise: '',
      transport: '',
      dormitory: '',
      visa: '',
      meal: '',
      other: ''
    };
  };

  const parsed = parseJobContent(job.content || '');
  const hasWelfare = [
    parsed.bonus, parsed.nenkin, parsed.insurance, parsed.raise, parsed.transport,
    parsed.dormitory, parsed.visa, parsed.meal, parsed.other
  ].some(
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
              <h1 className="job-detail-title">{isTranslated ? translatedJob.title : job.title}</h1>
              
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
                    <span>{isTranslated ? translatedJob.location : job.location}</span>
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
                    {parsed.dormitory && parsed.dormitory !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box dormitory" style={{ background: 'rgba(142, 68, 173, 0.1)' }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#8e44ad" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9 22 9 12 15 12 15 22"></polyline>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.dormitory')}</div>
                          <div className="welfare-value">
                            {['full', 'partial', 'rent_support'].includes(parsed.dormitory) ? t(`jobs.jobFields.dormitoryOptions.${parsed.dormitory}`) : parsed.dormitory}
                          </div>
                        </div>
                      </div>
                    )}
                    {parsed.visa && parsed.visa !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box visa" style={{ background: 'rgba(211, 84, 0, 0.1)' }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#d35400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.visa')}</div>
                          <div className="welfare-value">
                            {['full', 'support'].includes(parsed.visa) ? t(`jobs.jobFields.visaOptions.${parsed.visa}`) : parsed.visa}
                          </div>
                        </div>
                      </div>
                    )}
                    {parsed.meal && parsed.meal !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box meal" style={{ background: 'rgba(41, 128, 185, 0.1)' }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#2980b9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                            <line x1="6" y1="1" x2="6" y2="4"></line>
                            <line x1="10" y1="1" x2="10" y2="4"></line>
                            <line x1="14" y1="1" x2="14" y2="4"></line>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.meal')}</div>
                          <div className="welfare-value">
                            {['free', 'allowance'].includes(parsed.meal) ? t(`jobs.jobFields.mealOptions.${parsed.meal}`) : parsed.meal}
                          </div>
                        </div>
                      </div>
                    )}
                    {parsed.other && parsed.other !== 'none' && (
                      <div className="welfare-item">
                        <div className="welfare-icon-box other" style={{ background: 'rgba(127, 135, 141, 0.1)' }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7f8c8d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                        </div>
                        <div>
                          <div className="welfare-label">{t('jobs.jobFields.other')}</div>
                          <div className="welfare-value">
                            {['cert', 'health'].includes(parsed.other) ? t(`jobs.jobFields.otherOptions.${parsed.other}`) : parsed.other}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="job-detail-section">
                <h4 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <span>{t('jobs.description') || 'Chi tiết công việc'}</span>
                  </div>
                  
                  <button 
                    onClick={handleTranslate} 
                    className={`btn-translate ${isTranslated ? 'active' : ''}`}
                    disabled={isTranslating}
                  >
                    {isTranslating ? (
                      <>
                        <svg style={{ animation: 'spin 1s linear infinite', width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('jobs.translating') || 'Đang dịch...'}</span>
                      </>
                    ) : isTranslated ? (
                      <>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block', transform: lang === 'ja' ? 'translateY(1.5px)' : 'none'}}><path d="M2.5 12a9.5 9.5 0 0 1 19 0 9.5 9.5 0 0 1-19 0z"></path><path d="M12 2.5a15.3 15.3 0 0 1 4 9.5 15.3 15.3 0 0 1-4 9.5 15.3 15.3 0 0 1-4-9.5 15.3 15.3 0 0 1 4-9.5z"></path><path d="M2.5 12h19"></path></svg>
                        <span>{t('jobs.viewOriginal') || 'Xem bản gốc'}</span>
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block', transform: lang === 'ja' ? 'translateY(1.5px)' : 'none'}}><path d="M2.5 12a9.5 9.5 0 0 1 19 0 9.5 9.5 0 0 1-19 0z"></path><path d="M12 2.5a15.3 15.3 0 0 1 4 9.5 15.3 15.3 0 0 1-4 9.5 15.3 15.3 0 0 1-4-9.5 15.3 15.3 0 0 1 4-9.5z"></path><path d="M2.5 12h19"></path></svg>
                        <span>{t('jobs.translateTo') || 'Dịch bài viết'}</span>
                      </>
                    )}
                  </button>
                </h4>
                <div className="job-detail-body">
                  {isTranslated ? translatedJob.description : parsed.description}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        zIndex: 100,
        width: 'max-content',
        maxWidth: 'calc(100% - 40px)'
      }}>
        {/* Copy Link Button */}
        <button 
          onClick={handleCopyLink} 
          className={`btn-copy-pill link ${isCopied ? 'copied' : ''}`}
        >
          <div style={{ position: 'relative', width: '100%', height: '20px', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isCopied ? 0 : 1,
              transform: isCopied ? 'translateY(-20px)' : 'translateY(0)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              <span>{t('jobs.copyLink') || 'Copy link'}</span>
            </div>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isCopied ? 1 : 0,
              transform: isCopied ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{t('jobs.copied') || 'Đã sao chép!'}</span>
            </div>
          </div>
        </button>

        {/* Copy Content Button */}
        <button 
          onClick={handleCopyContent} 
          className={`btn-copy-pill content ${isContentCopied ? 'copied' : ''}`}
        >
          <div style={{ position: 'relative', width: '100%', height: '20px', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isContentCopied ? 0 : 1,
              transform: isContentCopied ? 'translateY(-20px)' : 'translateY(0)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>{t('jobs.copyContent') || 'Copy nội dung'}</span>
            </div>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isContentCopied ? 1 : 0,
              transform: isContentCopied ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{t('jobs.copied') || 'Đã sao chép!'}</span>
            </div>
          </div>
        </button>
      </div>

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
