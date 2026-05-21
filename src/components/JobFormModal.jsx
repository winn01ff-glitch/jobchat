import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { DB } from '../lib/supabase';

export default function JobFormModal({ isOpen, onClose, job, onSave }) {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  
  const [title, setTitle] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [location, setLocation] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(job?.title || '');
      setPosition(job?.position || '');
      setSalary(job?.salary || '');
      setLocation(job?.location || '');
      setContent(job?.content || '');
      setStatus(job?.status || 'draft');
    }
  }, [isOpen, job]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      showToast(t('admin.invalidData') || 'Vui lòng nhập Tiêu đề', 'error');
      return;
    }

    try {
      const adminSession = await DB.getAdminSession();
      const jobData = {
        title, position, salary, location, content, status,
        author_id: adminSession?.user?.id || '',
        author_name: adminSession?.profile?.display_name || ''
      };

      if (job?.id) {
        await DB.updateJob(job.id, jobData);
      } else {
        await DB.createJob(jobData);
      }

      showToast(t('admin.settingsSaved') || 'Đã lưu', 'success');
      onSave();
    } catch (e) {
      showToast(t('common.error') || 'Lỗi', 'error');
    }
  };

  const handleContentChange = (e) => {
    setContent(e.target.value);
  };

  const modalContent = (
    <div className="job-form-modal" style={{position:'fixed', top:0, left:0, width:'100vw', height:'100dvh', zIndex:9999, display:'flex', alignItems:'flex-start', justifyContent:'center', padding: '20px', boxSizing: 'border-box', overflowY:'auto'}}>
      <div onClick={onClose} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)'}}></div>
      <div className="job-form-card" style={{position:'relative', background:'var(--bg-primary)', borderRadius:'var(--radius-md)', width:'100%', maxWidth:'700px', display:'flex', flexDirection:'column', boxShadow:'0 16px 48px rgba(0,0,0,0.2)', margin:'auto 0', marginTop: '0'}}>
        
        <div className="job-form-header" style={{flexShrink: 0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--border-light)'}}>
          <h3 style={{margin:0, fontSize: '18px'}}>{job ? (t('admin.editJob') || 'Sửa Bài đăng') : (t('admin.createJob') || 'Tạo Bài đăng mới')}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'var(--text-muted)'}}>✕</button>
        </div>
        
        <div className="job-form-body" style={{padding:'20px', overflowY:'auto', flex:1}}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobTitle') || 'Tiêu đề'} *</label>
              <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobPosition') || 'Vị trí công việc'}</label>
              <select className="form-select" value={position} onChange={e => setPosition(e.target.value)}>
                <option value="">{t('register.positionPlaceholder') || 'Chọn vị trí...'}</option>
                <option value="factory">{t('register.positions.factory') || 'Lắp ráp / Nhà máy'}</option>
                <option value="restaurant">{t('register.positions.restaurant') || 'Nhà hàng / Dịch vụ'}</option>
                <option value="construction">{t('register.positions.construction') || 'Xây dựng / Cơ khí'}</option>
                <option value="office">{t('register.positions.office') || 'Văn phòng / IT'}</option>
                <option value="it">{t('register.positions.it') || 'IT'}</option>
                <option value="other">{t('register.positions.other') || 'Khác'}</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobSalary') || 'Mức lương'}</label>
              <input type="text" className="form-input" placeholder={t('admin.salaryExample') || 'Ví dụ: ¥250,000/tháng'} value={salary} onChange={e => setSalary(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobLocation') || 'Địa điểm làm việc'}</label>
              <input type="text" className="form-input" placeholder={t('admin.locationExample') || 'Ví dụ: Tokyo'} value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{t('admin.jobStatus') || 'Trạng thái'}</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">{t('admin.statusDraft') || 'Bản nháp'}</option>
                <option value="published">{t('admin.statusPublished') || 'Công khai'}</option>
              </select>
            </div>

          </div>
          
          <div className="form-group" style={{marginTop:'16px'}}>
            <label className="form-label">{t('admin.jobContent') || 'Nội dung chi tiết'}</label>
            <textarea 
              ref={textareaRef}
              className="form-input" 
              style={{ minHeight: '120px', resize: 'none', overflow: 'hidden' }}
              placeholder={t('admin.jobContentPlaceholder') || 'Mô tả chi tiết công việc...'} 
              value={content} 
              onChange={handleContentChange}
            ></textarea>
          </div>
        </div>

        <div className="job-form-footer" style={{flexShrink: 0, padding:'16px 20px', borderTop:'1px solid var(--border-light)', display:'flex', justifyContent:'flex-end', gap:'12px', background: 'var(--bg-primary)', borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)'}}>
          <button onClick={onClose} style={{padding:'8px 20px', border:'1px solid var(--border-light)', borderRadius:'8px', background:'white', cursor:'pointer'}}>{t('admin.cancel') || 'Hủy'}</button>
          <button onClick={handleSave} style={{padding:'8px 20px', border:'none', borderRadius:'8px', background:'var(--messenger-blue)', color:'white', cursor:'pointer', fontWeight:'600'}}>{t('admin.save') || 'Lưu'}</button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
