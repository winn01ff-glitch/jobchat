import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { DB } from '../lib/supabase';
import { showConfirmModal } from '../lib/helpers';
import JobFormModal from './JobFormModal';

export default function JobManagement({ onSelectJob, selectedJobId }) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const loadJobs = async () => {
    const data = await DB.getAllJobs();
    setJobs(data);
  };

  useEffect(() => {
    loadJobs();
    const handleUpdate = () => loadJobs();
    window.addEventListener('jobsUpdated', handleUpdate);
    return () => window.removeEventListener('jobsUpdated', handleUpdate);
  }, []);


  const handleCreate = () => {
    setEditingJob(null);
    setIsFormOpen(true);
  };

  const handleFormSave = () => {
    setIsFormOpen(false);
    loadJobs();
  };

  return (
    <div className="job-management" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
        <button 
          onClick={handleCreate}
          style={{ width: '100%', padding: '12px', background: 'var(--messenger-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          + {t('admin.createJob') || 'Thêm bài đăng mới'}
        </button>
      </div>

      <div id="job-post-list" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {jobs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--text-muted)'}}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              <p style={{ margin: 0 }}>{t('admin.noJobPosts') || 'Chưa có bài đăng nào'}</p>
            </div>
          </div>
        ) : (
          jobs.map(job => {
            const posLabel = t('register.positions.' + job.position) || job.position || '';
            const statusClass = job.status === 'published' ? 'published' : 'draft';
            const isPublished = job.status === 'published';
            const statusText = isPublished ? t('admin.statusPublished') || 'Published' : t('admin.statusDraft') || 'Draft';

            return (
              <div 
                key={job.id}
                className={`job-post-item ${selectedJobId === job.id ? 'selected' : ''}`}
                onClick={() => onSelectJob(job.id)}
                style={{
                  padding: '16px', borderRadius: '8px', marginBottom: '12px', cursor: 'pointer',
                  background: selectedJobId === job.id ? 'rgba(0, 132, 255, 0.06)' : 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  borderLeft: selectedJobId === job.id ? '4px solid var(--messenger-blue)' : '1px solid var(--border-light)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <div className="job-post-item-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="job-post-item-title" style={{ fontWeight: '600' }}>{job.title}</span>
                  <span className={`job-post-item-status ${statusClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px', borderRadius: '12px', background: isPublished ? '#e6f4ea' : '#f1f3f4', color: isPublished ? '#1e8e3e' : '#5f6368' }}>
                    {isPublished ? (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    )}
                    <span>{statusText}</span>
                  </span>
                </div>
                <div className="job-post-item-meta" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {posLabel && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                      <span>{posLabel}</span>
                    </span>
                  )}
                  {posLabel && (job.salary || job.location) && <span>·</span>}
                  {job.salary && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:'block'}}><path d="M6 3l6 8 6-8M12 11v10M9 13h6M9 17h6"/></svg>
                      <span>{job.salary}</span>
                    </span>
                  )}
                  {job.salary && job.location && <span>·</span>}
                  {job.location && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      <span>{job.location}</span>
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

      <JobFormModal 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        job={editingJob} 
        onSave={handleFormSave} 
      />
    </div>
  );
}
