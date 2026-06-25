import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useNotification } from '../context/NotificationContext';
import { DB } from '../lib/supabase';
import { hashPassword } from '../lib/helpers';

export default function AdminSettingsModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const { showToast } = useNotification();
  
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  
  const fileInputRef = React.useRef(null);
  
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  
  const [adminProfile, setAdminProfile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const loadProfile = async () => {
        const session = await DB.getAdminSession();
        if (session) {
          setAdminProfile(session.profile);
          setDisplayName(session.profile.display_name || '');
          setAvatar(session.profile.avatar || '');
        }
      };
      loadProfile();
    } else {
      // Reset fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPw(false);
      setShowNewPw(false);
      setShowConfirmPw(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height *= maxSize / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width *= maxSize / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        setAvatar(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      showToast(t('admin.invalidData') || 'Tên hiển thị không hợp lệ', 'error');
      return;
    }

    if (newPassword || confirmPassword || currentPassword) {
      if (newPassword !== confirmPassword) {
        showToast(t('admin.passwordsNotMatch') || 'Mật khẩu xác nhận không khớp', 'error');
        return;
      }
      if (!currentPassword) {
        showToast(t('admin.currentPasswordRequired') || 'Vui lòng nhập mật khẩu hiện tại', 'error');
        return;
      }
    }

    try {
      const updateData = { display_name: displayName };
      if (avatar !== adminProfile.avatar) updateData.avatar = avatar;
      if (newPassword) {
        updateData.password = newPassword;
        updateData.currentPassword = currentPassword;
      }
      
      await DB.updateAdminProfile(adminProfile.id, updateData);
      
      showToast(t('admin.settingsSaved') || 'Đã lưu cài đặt ✓', 'success');
      window.dispatchEvent(new Event('authChange')); // trigger header update
      onClose();
    } catch (e) {
      showToast(e.message || t('common.error') || 'Có lỗi xảy ra', 'error');
    }
  };

  return (
    <div className="settings-modal" style={{position:'fixed', top:0, left:0, width:'100vw', height:'100vh', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div className="settings-overlay" onClick={onClose} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.4)'}}></div>
      <div className="settings-card" style={{position:'relative', background:'var(--bg-primary)', borderRadius:'var(--radius-md)', padding:'var(--space-lg)', width:'90%', maxWidth:'360px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 16px 48px rgba(0,0,0,0.2)'}}>
        
        <h3 style={{margin:'0 0 12px', fontSize:'18px'}}>⚙️ <span>{t('admin.settings') || 'Cài đặt'}</span></h3>
        
        <div style={{textAlign:'center', marginBottom:'20px'}}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={handleAvatarChange} />
          <div 
            className="settings-avatar" 
            title={t('admin.clickToChangeAvatar') || 'Nhấn để đổi ảnh'}
            onClick={() => fileInputRef.current?.click()}
            style={{width:'80px', height:'80px', borderRadius:'50%', background:'var(--messenger-gradient)', color:'white', fontSize:'32px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto', cursor:'pointer', overflow:'hidden', border:'2px solid var(--border-light)'}}
          >
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          <p style={{fontSize:'12px', color:'var(--text-muted)', marginTop:'8px'}}>{t('admin.clickToChangeAvatar') || 'Nhấn để đổi ảnh đại diện'}</p>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block', marginBottom:'8px', fontSize:'14px', fontWeight:'600'}}>{t('admin.displayName') || 'Tên hiển thị'}</label>
          <input 
            type="text" 
            className="form-input" 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div style={{borderTop:'1px solid var(--border-light)', margin:'20px 0', paddingTop:'20px'}}>
          <h4 style={{margin:'0 0 12px', fontSize:'14px', color:'var(--text-muted)'}}>{t('admin.changePassword') || 'Đổi mật khẩu (không bắt buộc)'}</h4>
          
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
              style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'var(--text-muted)'}}
            >👁️</button>
          </div>

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
              style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'var(--text-muted)'}}
            >👁️</button>
          </div>

          <div style={{marginBottom:'20px', position:'relative'}}>
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
              style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'16px', color:'var(--text-muted)'}}
            >👁️</button>
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:'12px'}}>
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
