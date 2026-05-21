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
    ? <span style={{padding:'4px 12px', background:'#e6f4ea', color:'#1e8e3e', borderRadius:'16px', fontSize:'12px', fontWeight:'600'}}>✅ Published</span>
    : <span style={{padding:'4px 12px', background:'#f1f3f4', color:'#5f6368', borderRadius:'16px', fontSize:'12px', fontWeight:'600'}}>📝 Draft</span>;

  return (
    <div className="job-applicant-preview" style={{padding:'20px', height:'100%', overflowY:'auto', background:'var(--bg-secondary)'}}>
      <div className="job-ap-card" style={{background:'var(--bg-primary)', borderRadius:'var(--radius-lg)', padding:'24px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            {isMobile ? (
              <button onClick={onBack} style={{background:'none', border:'none', color:'var(--messenger-blue)', fontWeight:'600', cursor:'pointer', padding:'0', display:'flex', alignItems:'center', gap:'4px', fontSize:'14px'}}>
                ← {t('admin.jobPosts') || 'Trở lại'}
              </button>
            ) : (
              <div className="job-ap-status">{statusBadge}</div>
            )}
          </div>
          <div style={{display:'flex', gap:'8px'}}>
            <button onClick={() => setIsEditing(true)} className="job-ap-edit" style={{background:'var(--bg-input)', color:'var(--text-secondary)', border:'none', padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px'}}>
              ✏️ {t('admin.editJob') || 'Sửa'}
            </button>
            <button onClick={handleDelete} className="job-ap-delete" style={{background:'#fff0f5', color:'var(--error)', border:'none', padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px'}}>
              🗑️ {t('admin.deleteJob') || 'Xóa'}
            </button>
          </div>
        </div>

        {isMobile && <div className="job-ap-status" style={{marginBottom:'12px'}}>{statusBadge}</div>}
        <h2 className="job-ap-title" style={{margin:'0 0 16px', fontSize:'24px'}}>{job.title}</h2>
        
        <div className="job-ap-meta" style={{display:'flex', flexWrap:'wrap', gap:'16px', marginBottom:'20px'}}>
          {posLabel && <div className="job-ap-meta-item" style={{display:'flex', alignItems:'center', gap:'6px', color:'var(--text-secondary)'}}>🏢 <span>{posLabel}</span></div>}
          {job.salary && <div className="job-ap-meta-item" style={{display:'flex', alignItems:'center', gap:'6px', color:'var(--text-secondary)'}}>💰 <span>{job.salary}</span></div>}
          {job.location && <div className="job-ap-meta-item" style={{display:'flex', alignItems:'center', gap:'6px', color:'var(--text-secondary)'}}>📍 <span>{job.location}</span></div>}
        </div>
        
        <hr style={{border:'none', borderTop:'1px solid var(--border-light)', margin:'16px 0'}} />
        
        <div className="job-ap-content" style={{lineHeight:'1.6', color:'var(--text-primary)', whiteSpace:'pre-wrap'}}>{job.content}</div>
        
        <hr style={{border:'none', borderTop:'1px solid var(--border-light)', margin:'16px 0'}} />
        
        <button className="job-ap-apply-btn" disabled style={{width:'100%', padding:'14px', background:'var(--messenger-blue)', color:'white', border:'none', borderRadius:'12px', fontSize:'16px', fontWeight:'600', opacity:0.6, cursor:'not-allowed'}}>
          💬 {t('jobs.applyNow') || 'Ứng tuyển ngay'}
        </button>
        <p style={{textAlign:'center', fontSize:'11px', color:'var(--text-muted)', marginTop:'8px'}}>
          👆 {t('jobs.viewDetail') || 'Bản xem trước'} — Applicant View Preview
        </p>
      </div>

      <JobFormModal 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
        job={job} 
        onSave={() => { setIsEditing(false); loadJob(); }} 
      />
    </div>
  );
}
