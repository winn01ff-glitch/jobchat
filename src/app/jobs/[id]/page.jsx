'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLanguage } from '../../../context/LanguageContext';
import { DB } from '../../../lib/supabase';
import { formatDate } from '../../../lib/helpers';

export default function JobDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const load = async () => {
      try {
        const data = await DB.getJob(id);
        if (data) {
          setJob(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  const handleApply = () => {
    router.push(`/register?position=${job.position || ''}`);
  };

  if (isLoading) {
    return (
      <div className="jobs-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="jobs-container">
        <div className="jobs-empty">
          <p>{t('jobs.noJobs') || 'Không tìm thấy việc làm'}</p>
          <button onClick={() => router.push('/jobs')} className="btn-primary" style={{ marginTop: '16px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--messenger-blue)', color: 'white', cursor: 'pointer' }}>
            ← {t('admin.jobPosts') || 'Trở lại danh sách'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jobs-container" style={{ maxWidth: '800px', margin: '0 auto', padding: 'var(--space-lg)' }}>
      <button onClick={() => router.push('/jobs')} style={{ background: 'none', border: 'none', color: 'var(--messenger-blue)', cursor: 'pointer', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        ← {t('admin.jobPosts') || 'Trở lại danh sách'}
      </button>

      <div className="job-detail-card" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-xl)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <h1 className="job-detail-title" style={{ fontSize: '28px', fontWeight: '800', marginBottom: '16px' }}>{job.title}</h1>
        
        <div className="job-detail-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          {job.position && (
            <div className="job-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', padding: '6px 16px', borderRadius: '20px', color: 'var(--text-secondary)' }}>
              🏢 {t('register.positions.' + job.position) || job.position}
            </div>
          )}
          {job.salary && (
            <div className="job-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', padding: '6px 16px', borderRadius: '20px', color: 'var(--text-secondary)' }}>
              💰 {job.salary}
            </div>
          )}
          {job.location && (
            <div className="job-detail-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', padding: '6px 16px', borderRadius: '20px', color: 'var(--text-secondary)' }}>
              📍 {job.location}
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />

        <div className="job-detail-content" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8', color: 'var(--text-primary)', fontSize: '16px', marginBottom: '32px' }}>
          {job.content}
        </div>

        <div className="job-detail-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="job-detail-apply" 
            onClick={handleApply}
            style={{ width: '100%', maxWidth: '400px', padding: '16px', background: 'var(--messenger-gradient)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 15px rgba(0,132,255,0.2)' }}
          >
            💬 {t('jobs.applyNow') || 'Ứng tuyển ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}
