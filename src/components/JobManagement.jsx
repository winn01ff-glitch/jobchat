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
            <p>📋 {t('admin.noJobPosts') || 'Chưa có bài đăng nào'}</p>
          </div>
        ) : (
          jobs.map(job => {
            const posLabel = t('register.positions.' + job.position) || job.position || '';
            const statusClass = job.status === 'published' ? 'published' : 'draft';
            const statusText = job.status === 'published' ? '✅ Published' : '📝 Draft';

            return (
              <div 
                key={job.id}
                className={`job-post-item ${selectedJobId === job.id ? 'selected' : ''}`}
                onClick={() => onSelectJob(job.id)}
                style={{
                  padding: '16px', border: '1px solid var(--border-light)', borderRadius: '8px', marginBottom: '12px', cursor: 'pointer',
                  background: selectedJobId === job.id ? 'var(--bg-hover)' : 'var(--bg-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                <div className="job-post-item-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span className="job-post-item-title" style={{ fontWeight: '600' }}>{job.title}</span>
                  <span className={`job-post-item-status ${statusClass}`} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', background: job.status === 'published' ? '#e6f4ea' : '#f1f3f4', color: job.status === 'published' ? '#1e8e3e' : '#5f6368' }}>
                    {statusText}
                  </span>
                </div>
                <div className="job-post-item-meta" style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  {posLabel && `🏢 ${posLabel} · `}
                  {job.salary && `💰 ${job.salary} · `}
                  {job.location && `📍 ${job.location}`}
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
