import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { DB } from '../lib/supabase';
import { hashPassword, showConfirmModal } from '../lib/helpers';

export default function ApplicantSettingsModal({ isOpen, onClose, applicantId }) {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loginId, setLoginId] = useState('');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  
  // Email management states
  const [isEmailSectionOpen, setIsEmailSectionOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailStep, setEmailStep] = useState('email'); // 'email' or 'otp'
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isEmailOtpLoading, setIsEmailOtpLoading] = useState(false);

  const fileInputRef = useRef(null);
  const displayNameInputRef = useRef(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);

  useEffect(() => {
    if (isOpen && applicantId) {
      const loadProfile = async () => {
        try {
          const applicant = await DB.getApplicant(applicantId);
          if (applicant) {
            setDisplayName(applicant.name || '');
            setEmail(applicant.email || '');
            setAvatar(applicant.avatar || '');
            setLoginId(applicant.login_id || '');
          }
        } catch (e) {
          console.error('Failed to load applicant profile:', e);
        }
      };
      loadProfile();
    } else {
      // Reset fields on close
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
      setIsEmailSectionOpen(false);
      setNewEmailInput('');
      setEmailStep('email');
      setEmailOtp('');
    }
  }, [isOpen, applicantId]);

  if (!isOpen) return null;

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 400;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const ext = file.type === 'image/png' ? '.png' : '.jpg';

          canvas.toBlob(
            (blob) => {
              resolve({
                blob: blob || file,
                mimeType,
                ext
              });
            },
            mimeType,
            0.8
          );
        };
      };
    });
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(t('auth.invalidImageType') || 'Định dạng ảnh không hợp lệ.', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast(t('auth.avatarTooLarge') || 'Kích thước ảnh đại diện quá lớn (Tối đa 2MB)', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { blob, mimeType, ext } = await compressImage(file);
      const compressedFile = new File([blob], `avatar_${Date.now()}${ext}`, { type: mimeType });

      const uploadResult = await DB.uploadFile(applicantId, compressedFile, compressedFile.name);
      
      // Update database immediately
      await DB.updateApplicant(applicantId, { avatar: uploadResult.url });
      setAvatar(uploadResult.url);
      
      // Dispatch events immediately so parent pages refresh their state
      window.dispatchEvent(new Event('authChange'));
      window.dispatchEvent(new Event('applicantProfileUpdate'));

      showToast(t('admin.avatarUpdated') || 'Đã cập nhật ảnh đại diện', 'success');
    } catch (err) {
      console.error('Avatar upload failed:', err);
      showToast(t('common.error') || 'Đã xảy ra lỗi', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await DB.updateApplicant(applicantId, { avatar: null });
      setAvatar('');
      window.dispatchEvent(new Event('authChange'));
      window.dispatchEvent(new Event('applicantProfileUpdate'));
      showToast(t('auth.avatarRemoved') || 'Đã gỡ ảnh đại diện', 'info');
    } catch (err) {
      console.error(err);
      showToast(t('common.error') || 'Đã xảy ra lỗi', 'error');
    }
  };

  const handleSendEmailOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = newEmailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsEmailLoading(true);
    try {
      const currentLang = (typeof window !== 'undefined' ? localStorage.getItem('jobchat_lang') : 'vi') || 'vi';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, lang: currentLang })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      showToast(t('register.otpSent') || 'Mã xác thực đã được gửi tới email của bạn!', 'success');
      setEmailStep('otp');
    } catch (err) {
      console.error(err);
      showToast(t('register.sendOtpFailed') || 'Gửi mã xác thực thất bại.', 'error');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    const cleanEmail = newEmailInput.trim().toLowerCase();
    const cleanOtp = emailOtp.trim();

    if (!cleanOtp || !applicantId) return;

    setIsEmailOtpLoading(true);
    try {
      const result = await DB.verifyOtp(cleanEmail, cleanOtp);
      if (!result || !result.success) {
        showToast(t('register.invalidOtp') || 'Mã xác thực không chính xác.', 'error');
        setIsEmailOtpLoading(false);
        return;
      }

      // Update email immediately in DB & LocalState
      await DB.updateApplicant(applicantId, { email: cleanEmail });
      setEmail(cleanEmail);

      // Update session Storage
      const sessionStr = localStorage.getItem('jobchat_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          session.email = cleanEmail;
          localStorage.setItem('jobchat_session', JSON.stringify(session));
        } catch (e) {}
      }

      showToast(t('auth.emailLinkedSuccess') || 'Liên kết email thành công!', 'success');
      window.dispatchEvent(new Event('authChange'));
      
      // Reset email state
      setNewEmailInput('');
      setEmailOtp('');
      setEmailStep('email');
      setIsEmailSectionOpen(false);
    } catch (err) {
      console.error(err);
      showToast(t('common.error') || 'Đã xảy ra lỗi', 'error');
    } finally {
      setIsEmailOtpLoading(false);
    }
  };

  const handleSave = async () => {
    const cleanName = displayName.trim();
    if (!cleanName) {
      showToast(t('auth.errorNameRequired') || 'Tên hiển thị không được để trống', 'error');
      displayNameInputRef.current?.focus();
      return;
    }

    const updateData = { name: cleanName, avatar: avatar || null };

    // Check password fields
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        showToast(t('admin.currentPasswordRequired') || 'Vui lòng nhập mật khẩu hiện tại', 'error');
        return;
      }
      if (newPassword.length < 6) {
        showToast(t('auth.errorPasswordMin') || 'Mật khẩu phải tối thiểu 6 ký tự', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast(t('admin.passwordsNotMatch') || 'Mật khẩu xác nhận không khớp', 'error');
        return;
      }

      try {
        const currentPwHash = await hashPassword(currentPassword.trim());
        const isCurrentPwValid = await DB.verifyApplicantPassword(applicantId, currentPwHash);
        
        if (!isCurrentPwValid) {
          showToast(t('admin.wrongCurrentPassword') || 'Mật khẩu hiện tại không đúng', 'error');
          return;
        }

        const newPwHash = await hashPassword(newPassword.trim());
        updateData.password_hash = newPwHash;
      } catch (err) {
        console.error(err);
        showToast(t('common.error') || 'Lỗi xác thực mật khẩu', 'error');
        return;
      }
    }

    try {
      const result = await DB.updateApplicant(applicantId, updateData);
      
      // Update session Storage
      const sessionStr = localStorage.getItem('jobchat_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          session.name = result.name;
          localStorage.setItem('jobchat_session', JSON.stringify(session));
        } catch (e) {}
      }

      showToast(t('admin.settingsSaved') || 'Đã lưu cài đặt ✓', 'success');
      window.dispatchEvent(new Event('authChange'));
      window.dispatchEvent(new Event('applicantProfileUpdate'));
      onClose();
    } catch (e) {
      showToast(e.message || t('common.error') || 'Có lỗi xảy ra', 'error');
    }
  };

  return (
    <div className="settings-modal" style={{position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="settings-overlay" onClick={onClose} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.4)'}}></div>
      
      <div className="settings-card" style={{
        position:'relative', 
        background:'var(--bg-primary)', 
        borderRadius:'var(--radius-md)', 
        width:'90%', 
        maxWidth:'380px', 
        maxHeight:'90%', 
        display:'flex', 
        flexDirection:'column', 
        overflow:'hidden', 
        boxShadow:'0 16px 48px rgba(0,0,0,0.2)',
        padding: 0
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Fixed Title Header */}
        <div style={{
          display:'flex', 
          alignItems:'center', 
          justifyContent:'space-between', 
          padding:'8px 16px',
          borderBottom:'1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <h3 style={{margin:0, fontSize:'18px', display:'flex', alignItems:'center', gap:'6px'}}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--text-primary)'}}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>{t('admin.settings') || 'Cài đặt tài khoản'}</span>
          </h3>
          <button 
            type="button" 
            onClick={onClose}
            onMouseEnter={() => setIsCloseHovered(true)}
            onMouseLeave={() => setIsCloseHovered(false)}
            style={{
              background: isCloseHovered ? 'var(--border-light)' : 'none',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              transition: 'background 0.2s ease',
              marginRight: '-6px',
              fontSize: '20px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div style={{
          padding:'16px', 
          overflowY:'auto', 
          flexGrow: 1
        }}>
          {/* Avatar Section */}
          <div style={{textAlign:'center', marginBottom:'20px', position:'relative'}}>
            <input type="file" accept="image/png, image/jpeg, image/jpg" ref={fileInputRef} style={{display:'none'}} onChange={handleAvatarChange} />
            <div style={{position:'relative', width:'80px', height:'80px', margin:'0 auto'}}>
              <div 
                className="settings-avatar" 
                title={t('admin.clickToChangeAvatar') || 'Nhấn để đổi ảnh'}
                onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                style={{width:'80px', height:'80px', borderRadius:'50%', background:'var(--messenger-gradient)', color:'white', fontSize:'32px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', overflow:'hidden', border:'2px solid var(--border-light)'}}
              >
                {isUploadingAvatar ? (
                  <div className="spinner" style={{borderColor:'white', borderTopColor:'transparent'}}></div>
                ) : avatar ? (
                  <img src={avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
                ) : (
                  displayName ? displayName.charAt(0).toUpperCase() : '?'
                )}
              </div>
              {avatar && !isUploadingAvatar && (
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }} 
                  title="Gỡ ảnh đại diện" 
                  style={{position:'absolute', right:'-4px', bottom:'-4px', width:'24px', height:'24px', borderRadius:'50%', background:'var(--border-light)', border:'1px solid var(--border-light)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-primary)'}}
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              )}
            </div>
            <p style={{fontSize:'12px', color:'var(--text-muted)', marginTop:'8px'}}>{t('admin.clickToChangeAvatar') || 'Nhấn để đổi ảnh đại diện'}</p>
          </div>

          {/* Read-only Login ID */}
          <div style={{marginBottom:'12px'}}>
            <label style={{display:'block', marginBottom:'4px', fontSize:'13px', fontWeight:'600', color:'var(--text-muted)'}}>{t('admin.id') || 'ID tài khoản'}</label>
            <input 
              type="text" 
              className="form-input" 
              value={loginId}
              disabled
              style={{background:'var(--bg-secondary)', cursor:'not-allowed', color:'var(--text-muted)'}}
            />
          </div>

          {/* Display Name */}
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block', marginBottom:'4px', fontSize:'13px', fontWeight:'600'}}>
              {t('admin.displayName') || 'Tên hiển thị'} <span style={{color:'var(--color-danger, #ef4444)'}}>*</span>
            </label>
            <input 
              ref={displayNameInputRef}
              type="text" 
              className="form-input" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Email Linking Section */}
          <div style={{borderTop:'1px solid var(--border-light)', paddingTop:'12px', marginBottom:'16px'}}>
            <label style={{display:'block', marginBottom:'4px', fontSize:'13px', fontWeight:'600'}}>{t('admin.email') || 'Email liên kết'}</label>
            
            {email ? (
              <div>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-secondary)', borderRadius:'8px', fontSize:'13px', marginBottom: isEmailSectionOpen ? '8px' : '0'}}>
                  <span style={{fontWeight:'500', wordBreak:'break-all'}}>{email}</span>
                  <button 
                    type="button" 
                    onClick={() => { setIsEmailSectionOpen(!isEmailSectionOpen); setNewEmailInput(''); setEmailStep('email'); }}
                    style={{color:'var(--messenger-blue)', border:'none', background:'none', cursor:'pointer', fontWeight:'600', fontSize:'12px', padding:0}}
                  >
                    {isEmailSectionOpen ? (t('admin.cancel') || 'Hủy') : (t('auth.changeEmail') || 'Thay đổi')}
                  </button>
                </div>
                
                {isEmailSectionOpen && (
                  <div style={{padding:'8px', background:'var(--bg-secondary)', borderRadius:'8px', marginTop:'8px'}}>
                    {emailStep === 'email' ? (
                      <form onSubmit={handleSendEmailOtp}>
                        <input 
                          type="email" 
                          className="form-input" 
                          required 
                          placeholder={t('auth.enterNewEmail') || "Nhập email mới"}
                          value={newEmailInput}
                          onChange={e => setNewEmailInput(e.target.value)}
                          style={{marginBottom:'8px', background:'var(--bg-primary)'}}
                        />
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'8px'}}>
                          <button type="button" className="btn-job-cancel" onClick={() => setIsEmailSectionOpen(false)} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>{t('admin.cancel') || 'Hủy'}</button>
                          <button type="submit" className="btn-job-publish" disabled={isEmailLoading} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>
                            {isEmailLoading ? <div className="spinner" style={{width:'12px', height:'12px'}}></div> : (t('auth.sendOtpCode') || 'Gửi mã OTP')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyEmailOtp}>
                        <p style={{fontSize:'11px', color:'var(--text-secondary)', margin:'0 0 8px'}}>
                          {t('register.otpSentHint') || 'Đã gửi mã xác thực 6 chữ số đến:'} <br/>
                          <strong style={{color:'var(--text-primary)'}}>{newEmailInput}</strong>
                        </p>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="form-input" 
                          required 
                          maxLength={6}
                          value={emailOtp}
                          onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="------"
                          style={{textAlign:'center', letterSpacing:'4px', fontSize:'16px', fontWeight:'bold', marginBottom:'8px', background:'var(--bg-primary)'}}
                        />
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'8px'}}>
                          <button type="button" className="btn-job-cancel" onClick={() => setEmailStep('email')} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>{t('common.back') || 'Quay lại'}</button>
                          <button type="submit" className="btn-job-publish" disabled={isEmailOtpLoading} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>
                            {isEmailOtpLoading ? <div className="spinner" style={{width:'12px', height:'12px'}}></div> : (t('register.verify') || 'Xác thực')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!isEmailSectionOpen ? (
                  <button 
                    type="button" 
                    onClick={() => setIsEmailSectionOpen(true)}
                    style={{width:'100%', padding:'8px', border:'1px dashed var(--border-light)', borderRadius:'8px', background:'none', color:'var(--messenger-blue)', cursor:'pointer', fontSize:'13px', fontWeight:'500'}}
                  >
                    + {t('auth.linkEmail') || 'Liên kết Email'}
                  </button>
                ) : (
                  <div style={{padding:'8px', background:'var(--bg-secondary)', borderRadius:'8px'}}>
                    {emailStep === 'email' ? (
                      <form onSubmit={handleSendEmailOtp}>
                        <input 
                          type="email" 
                          className="form-input" 
                          required 
                          placeholder="example@gmail.com" 
                          value={newEmailInput}
                          onChange={e => setNewEmailInput(e.target.value)}
                          style={{marginBottom:'8px', background:'var(--bg-primary)'}}
                        />
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'8px'}}>
                          <button type="button" className="btn-job-cancel" onClick={() => setIsEmailSectionOpen(false)} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>{t('admin.cancel') || 'Hủy'}</button>
                          <button type="submit" className="btn-job-publish" disabled={isEmailLoading} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>
                            {isEmailLoading ? <div className="spinner" style={{width:'12px', height:'12px'}}></div> : (t('auth.sendOtpCode') || 'Gửi mã OTP')}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyEmailOtp}>
                        <p style={{fontSize:'11px', color:'var(--text-secondary)', margin:'0 0 8px'}}>
                          {t('register.otpSentHint') || 'Đã gửi mã xác thực 6 chữ số đến:'} <br/>
                          <strong style={{color:'var(--text-primary)'}}>{newEmailInput}</strong>
                        </p>
                        <input 
                          type="text" 
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="form-input" 
                          required 
                          maxLength={6}
                          value={emailOtp}
                          onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                          placeholder="------"
                          style={{textAlign:'center', letterSpacing:'4px', fontSize:'16px', fontWeight:'bold', marginBottom:'8px', background:'var(--bg-primary)'}}
                        />
                        <div style={{display:'flex', justifyContent:'flex-end', gap:'8px'}}>
                          <button type="button" className="btn-job-cancel" onClick={() => setEmailStep('email')} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>{t('common.back') || 'Quay lại'}</button>
                          <button type="submit" className="btn-job-publish" disabled={isEmailOtpLoading} style={{padding:'6px 16px', fontSize:'12px', borderRadius:'20px'}}>
                            {isEmailOtpLoading ? <div className="spinner" style={{width:'12px', height:'12px'}}></div> : (t('register.verify') || 'Xác thực')}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Password Section */}
          <div style={{borderTop:'1px solid var(--border-light)', paddingTop:'12px', marginBottom:'8px'}}>
            <h4 style={{margin:'0 0 12px', fontSize:'14px', color:'var(--text-muted)'}}>{t('admin.changePassword') || 'Đổi mật khẩu (không bắt buộc)'}</h4>
            
            {/* Current Password */}
            <div style={{marginBottom:'12px', position:'relative'}}>
              <input 
                type={showCurrentPw ? 'text' : 'password'} 
                className="form-input" 
                placeholder={t('admin.currentPasswordPlaceholder') || 'Mật khẩu hiện tại'}
                style={{paddingRight:'40px'}}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowCurrentPw(!showCurrentPw)} 
                style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'}}
              >
                {showCurrentPw ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* New Password */}
            <div style={{marginBottom:'12px', position:'relative'}}>
              <input 
                type={showNewPw ? 'text' : 'password'} 
                className="form-input" 
                placeholder={t('admin.newPasswordPlaceholder') || 'Mật khẩu mới'}
                style={{paddingRight:'40px'}}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowNewPw(!showNewPw)} 
                style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'}}
              >
                {showNewPw ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>

            {/* Confirm Password */}
            <div style={{marginBottom:'12px', position:'relative'}}>
              <input 
                type={showConfirmPw ? 'text' : 'password'} 
                className="form-input" 
                placeholder={t('admin.confirmPasswordPlaceholder') || 'Xác nhận mật khẩu mới'}
                style={{paddingRight:'40px'}}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button 
                type="button" 
                onClick={() => setShowConfirmPw(!showConfirmPw)} 
                style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'}}
              >
                {showConfirmPw ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Fixed Action Footer */}
        <div style={{
          display:'flex', 
          justifyContent:'flex-end', 
          gap:'12px', 
          padding:'8px 16px', 
          borderTop:'1px solid var(--border-light)',
          flexShrink: 0
        }}>
          <button 
            onClick={onClose} 
            style={{padding:'8px 20px', border:'1px solid var(--border-light)', borderRadius:'8px', background:'white', cursor:'pointer'}}
          >
            {t('admin.cancel') || 'Hủy'}
          </button>
          <button 
            onClick={handleSave} 
            style={{padding:'8px 20px', border:'none', borderRadius:'8px', background:'var(--messenger-blue)', color:'white', cursor:'pointer', fontWeight:'600'}}
          >
            {t('admin.save') || 'Lưu'}
          </button>
        </div>

      </div>
    </div>
  );
}
