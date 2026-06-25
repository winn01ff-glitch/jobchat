import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { DB } from '../lib/supabase';
import { showConfirmModal } from '../lib/helpers';
import JobFormModal from './JobFormModal';

export default function JobPreviewPanel({ jobId, onBack, onDelete }) {
  const { t } = useLanguage();
  const [job, setJob] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

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

  if (!job) return <div className="admin-empty-state"><p>Loading...</p></div>;

  const posLabel = t('register.positions.' + job.position) || job.position || '';
  const statusBadge = job.status === 'published' 
    ? <span style={{padding:'4px 12px', background:'#e6f4ea', color:'#1e8e3e', borderRadius:'16px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'4px'}}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><polyline points="20 6 9 17 4 12"/></svg> {t('admin.statusPublished') || 'Published'}</span>
    : <span style={{padding:'4px 12px', background:'#f1f3f4', color:'#5f6368', borderRadius:'16px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'4px'}}><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {t('admin.statusDraft') || 'Draft'}</span>;

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

  return (
    <div className="job-applicant-preview" style={{padding:'20px', height:'100%', overflowY:'auto', background:'var(--bg-secondary)'}}>
      
      {/* Admin Actions Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px', 
        gap: '12px',
        background: 'var(--bg-primary)',
        padding: '12px 20px',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && (
            <button onClick={onBack} className="job-back-btn" style={{ marginRight: '8px' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>{t('admin.jobPosts') || 'Trở lại'}</span>
            </button>
          )}
          <div className="job-ap-status" style={{ margin: 0 }}>{statusBadge}</div>
        </div>
        <div style={{display:'flex', gap:'8px', alignItems: 'center'}}>
          <button onClick={() => setIsEditing(true)} className="job-ap-edit" style={{background:'var(--bg-input)', color:'var(--text-secondary)', border:'none', padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px'}}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> {t('admin.editJob') || 'Sửa'}
          </button>
          <button onClick={handleDelete} className="job-ap-delete" style={{background:'#fff0f5', color:'var(--error)', border:'none', padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px'}}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> {t('admin.deleteJob') || 'Xóa'}
          </button>
        </div>
      </div>

      {/* Candidate View Preview Container */}
      <div className="candidate-job-detail-container" style={{ padding: '0', minHeight: 'auto', gap: '16px' }}>
        
        {/* Sticky Job Header Bar (Bọc trong Wrapper chống đè chữ khi cuộn) */}
        <div style={{ 
          position: 'sticky', 
          top: '0', 
          zIndex: 100, 
          background: 'var(--bg-secondary)', 
          padding: '6px 0 12px 0',
          margin: '-8px 0 -12px 0' 
        }}>
          <div className="candidate-job-sticky-header" style={{ margin: 0 }}>
            <div style={{ flex: 1 }}>
              <h1 className="job-detail-title">{job.title}</h1>
              
              <div className="job-detail-meta">
                {job.position && (
                  <div className="job-detail-meta-item">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    <span>{t('register.positions.' + job.position) || job.position}</span>
                  </div>
                )}
                {job.salary && (
                  <div className="job-detail-meta-item">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                    <span>{job.salary}</span>
                  </div>
                )}
                {job.location && (
                  <div className="job-detail-meta-item">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    <span>{job.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card chi tiết (Nội dung & Phúc lợi) */}
        <div className="candidate-job-detail-card">
          
          {/* Khung phúc lợi đãi ngộ (Nằm trên đầu) */}
          {(parsed.bonus || parsed.nenkin || parsed.insurance || parsed.raise || parsed.transport) && (
            <div style={{
              marginBottom: '24px',
              padding: '20px',
              background: 'var(--bg-secondary)',
              borderRadius: '12px',
              border: '1px solid var(--border-light)'
            }}>
              <h4 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--messenger-blue)'}}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>{t('jobs.welfare') || 'Chế độ & Phúc lợi'}</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                {parsed.bonus && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(230,126,34,0.1)', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#e67e22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12"></polyline>
                        <rect x="2" y="7" width="20" height="5"></rect>
                        <line x1="12" y1="22" x2="12" y2="7"></line>
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.bonus')}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {['twice_a_year', 'once_a_year', 'performance', 'none'].includes(parsed.bonus) ? t(`jobs.jobFields.bonusOptions.${parsed.bonus}`) : parsed.bonus}
                      </div>
                    </div>
                  </div>
                )}
                {(parsed.insurance || parsed.nenkin) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(39,174,96,0.1)', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#27ae60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.insurance')}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {parsed.insurance ? (
                          ['full', 'partial', 'none'].includes(parsed.insurance) ? t(`jobs.jobFields.insuranceOptions.${parsed.insurance}`) : parsed.insurance
                        ) : (
                          ['full', 'none'].includes(parsed.nenkin) ? t(`jobs.jobFields.nenkinOptions.${parsed.nenkin}`) : parsed.nenkin
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {parsed.raise && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(192,57,43,0.1)', flexShrink: 0 }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.raise')}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {['once_a_year', 'performance', 'none'].includes(parsed.raise) ? t(`jobs.jobFields.raiseOptions.${parsed.raise}`) : parsed.raise}
                      </div>
                    </div>
                  </div>
                )}
                {parsed.transport && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(22,160,133,0.1)', flexShrink: 0 }}>
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
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('jobs.jobFields.transport')}</div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {['full', 'limited', 'none'].includes(parsed.transport) ? t(`jobs.jobFields.transportOptions.${parsed.transport}`) : parsed.transport}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />

          {/* Nội dung chi tiết công việc */}
          <div className="job-detail-content" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text-primary)', fontSize: '16px' }}>
            {parsed.description}
          </div>
          
          {/* Thanh ứng tuyển ghim cố định ở dưới cùng (PC & Mobile - Admin Preview) */}
          <div className="candidate-job-apply-bar-wrapper">
            <div className="candidate-job-apply-bar">
              <button disabled>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>{t('jobs.applyNow') || 'Ứng tuyển ngay'}</span>
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('jobs.applicantViewPreview') || 'Bản xem trước giao diện ứng viên (Applicant View Preview)'}
              </span>
            </div>
          </div>
        </div>
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
