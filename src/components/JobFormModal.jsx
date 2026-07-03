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
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryType, setSalaryType] = useState('hourly');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('draft');
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);

  // States mới cho các trường tuyển dụng
  const [description, setDescription] = useState('');
  const [bonusSelect, setBonusSelect] = useState('');
  const [bonusCustom, setBonusCustom] = useState('');
  const [insuranceSelect, setInsuranceSelect] = useState('');
  const [insuranceCustom, setInsuranceCustom] = useState('');
  const [raiseSelect, setRaiseSelect] = useState('');
  const [raiseCustom, setRaiseCustom] = useState('');
  const [transportSelect, setTransportSelect] = useState('');
  const [transportCustom, setTransportCustom] = useState('');
  const [dormitorySelect, setDormitorySelect] = useState('');
  const [dormitoryCustom, setDormitoryCustom] = useState('');
  const [visaSelect, setVisaSelect] = useState('');
  const [visaCustom, setVisaCustom] = useState('');
  const [mealSelect, setMealSelect] = useState('');
  const [mealCustom, setMealCustom] = useState('');
  const [otherSelect, setOtherSelect] = useState('');
  const [otherCustom, setOtherCustom] = useState('');

  // Hàm helper parse content
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

  useEffect(() => {
    if (isOpen) {
      setTitle(job?.title || '');
      setPosition(job?.position || '');
      
      if (job?.salary) {
        if (job.salary.endsWith('_monthly')) {
          setSalaryAmount(job.salary.replace('_monthly', ''));
          setSalaryType('monthly');
        } else if (job.salary.endsWith('_hourly')) {
          setSalaryAmount(job.salary.replace('_hourly', ''));
          setSalaryType('hourly');
        } else {
          setSalaryAmount(job.salary);
          setSalaryType('monthly');
        }
      } else {
        setSalaryAmount('');
        setSalaryType('hourly');
      }

      setLocation(job?.location || '');
      setStatus(job?.status || 'draft');

      const parsed = parseJobContent(job?.content || '');
      setDescription(parsed.description);

      // Load Bonus
      const bonusOpts = ['twice_a_year', 'once_a_year', 'performance', 'none'];
      if (!parsed.bonus) {
        setBonusSelect('');
        setBonusCustom('');
      } else if (bonusOpts.includes(parsed.bonus)) {
        setBonusSelect(parsed.bonus);
        setBonusCustom('');
      } else {
        setBonusSelect('custom');
        setBonusCustom(parsed.bonus);
      }

      // Load Insurance & Nenkin (Combined)
      const combinedInsurance = parsed.insurance || parsed.nenkin || '';
      const insOpts = ['full', 'partial', 'none'];
      if (!combinedInsurance) {
        setInsuranceSelect('');
        setInsuranceCustom('');
      } else if (insOpts.includes(combinedInsurance)) {
        setInsuranceSelect(combinedInsurance);
        setInsuranceCustom('');
      } else {
        setInsuranceSelect('custom');
        setInsuranceCustom(combinedInsurance);
      }

      // Load Raise
      const raiseOpts = ['once_a_year', 'performance', 'none'];
      if (!parsed.raise) {
        setRaiseSelect('');
        setRaiseCustom('');
      } else if (raiseOpts.includes(parsed.raise)) {
        setRaiseSelect(parsed.raise);
        setRaiseCustom('');
      } else {
        setRaiseSelect('custom');
        setRaiseCustom(parsed.raise);
      }

      // Load Transport
      const transOpts = ['full', 'limited', 'none'];
      if (!parsed.transport) {
        setTransportSelect('');
        setTransportCustom('');
      } else if (transOpts.includes(parsed.transport)) {
        setTransportSelect(parsed.transport);
        setTransportCustom('');
      } else {
        setTransportSelect('custom');
        setTransportCustom(parsed.transport);
      }

      // Load Dormitory
      const dormOpts = ['full', 'partial', 'rent_support', 'none'];
      if (!parsed.dormitory) {
        setDormitorySelect('');
        setDormitoryCustom('');
      } else if (dormOpts.includes(parsed.dormitory)) {
        setDormitorySelect(parsed.dormitory);
        setDormitoryCustom('');
      } else {
        setDormitorySelect('custom');
        setDormitoryCustom(parsed.dormitory);
      }

      // Load Visa
      const visaOptsVal = ['full', 'support', 'none'];
      if (!parsed.visa) {
        setVisaSelect('');
        setVisaCustom('');
      } else if (visaOptsVal.includes(parsed.visa)) {
        setVisaSelect(parsed.visa);
        setVisaCustom('');
      } else {
        setVisaSelect('custom');
        setVisaCustom(parsed.visa);
      }

      // Load Meal
      const mealOptsVal = ['free', 'allowance', 'none'];
      if (!parsed.meal) {
        setMealSelect('');
        setMealCustom('');
      } else if (mealOptsVal.includes(parsed.meal)) {
        setMealSelect(parsed.meal);
        setMealCustom('');
      } else {
        setMealSelect('custom');
        setMealCustom(parsed.meal);
      }

      // Load Other
      const otherOptsVal = ['cert', 'health', 'none'];
      if (!parsed.other) {
        setOtherSelect('');
        setOtherCustom('');
      } else if (otherOptsVal.includes(parsed.other)) {
        setOtherSelect(parsed.other);
        setOtherCustom('');
      } else {
        setOtherSelect('custom');
        setOtherCustom(parsed.other);
      }
    }
  }, [isOpen, job]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [description, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      showToast(t('admin.invalidData') || 'Vui lòng nhập Tiêu đề', 'error');
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
      return;
    }

    try {
      const adminSession = await DB.getAdminSession();

      const bonus = bonusSelect === 'custom' ? bonusCustom : bonusSelect;
      const insurance = insuranceSelect === 'custom' ? insuranceCustom : insuranceSelect;
      const raise = raiseSelect === 'custom' ? raiseCustom : raiseSelect;
      const transport = transportSelect === 'custom' ? transportCustom : transportSelect;
      const dormitory = dormitorySelect === 'custom' ? dormitoryCustom : dormitorySelect;
      const visa = visaSelect === 'custom' ? visaCustom : visaSelect;
      const meal = mealSelect === 'custom' ? mealCustom : mealSelect;
      const other = otherSelect === 'custom' ? otherCustom : otherSelect;

      const packedContent = JSON.stringify({
        description,
        bonus,
        nenkin: '',
        insurance,
        raise,
        transport,
        dormitory,
        visa,
        meal,
        other
      });

      let finalSalary = salaryAmount.trim();
      if (finalSalary && /\d/.test(finalSalary)) {
        finalSalary = `${finalSalary}_${salaryType}`;
      }

      const jobData = {
        title, position, salary: finalSalary, location,
        content: packedContent,
        status,
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
    setDescription(e.target.value);
  };

  const modalContent = (
    <div className="job-form-modal">
      <div onClick={onClose} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)'}}></div>
      <div className="job-form-card">
        
        <div className="job-form-header" style={{flexShrink: 0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--border-light)'}}>
          <h3 style={{margin:0, fontSize: '18px'}}>{job ? (t('admin.editJob') || 'Sửa Bài đăng') : (t('admin.createJob') || 'Tạo Bài đăng mới')}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'var(--text-muted)'}}>✕</button>
        </div>
        
        <div className="job-form-body" style={{padding:'20px', overflowY:'auto', flex:1}}>
          <div className="job-form-grid">
            
            <div className="form-group job-form-grid-full">
              <label className="form-label">{t('admin.jobTitle') || 'Tiêu đề'} *</label>
              <input ref={titleInputRef} type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobPosition') || 'Vị trí công việc'}</label>
              <select className="form-select" value={position} onChange={e => setPosition(e.target.value)}>
                <option value="">{t('register.positionPlaceholder') || 'Chọn vị trí...'}</option>
                <option value="factory">{t('register.positions.factory') || 'Nhà máy'}</option>
                <option value="office">{t('register.positions.office') || 'Văn phòng'}</option>
                <option value="nursing">{t('register.positions.nursing') || 'Điều dưỡng'}</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobLocation') || 'Địa điểm làm việc'}</label>
              <input type="text" className="form-input" placeholder={t('admin.locationExample') || 'Ví dụ: Tokyo'} value={location} onChange={e => setLocation(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">{t('admin.jobSalary') || 'Mức lương'}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  className="form-select" 
                  style={{ width: '120px', flexShrink: 0 }}
                  value={salaryType} 
                  onChange={e => setSalaryType(e.target.value)}
                >
                  <option value="hourly">{t('jobs.hourly') || 'Giờ'}</option>
                  <option value="monthly">{t('jobs.monthly') || 'Tháng'}</option>
                </select>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 1 }}
                  placeholder={salaryType === 'hourly' ? t('admin.salaryExampleHourly') : t('admin.salaryExampleMonthly')} 
                  value={salaryAmount} 
                  onChange={e => setSalaryAmount(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">{t('admin.jobStatus') || 'Trạng thái'}</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">{t('admin.statusDraft') || 'Bản nháp'}</option>
                <option value="published">{t('admin.statusPublished') || 'Công khai'}</option>
              </select>
            </div>

            {/* Chế độ & Phúc lợi */}
            <div className="job-form-section-title">
              {t('jobs.welfare') || 'Chế độ & Phúc lợi'}
            </div>

            {/* Thưởng */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.bonus') || 'Thưởng'}</label>
              <select className="form-select" value={bonusSelect} onChange={e => setBonusSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="twice_a_year">{t('jobs.jobFields.bonusOptions.twice_a_year') || '1 năm 2 lần'}</option>
                <option value="once_a_year">{t('jobs.jobFields.bonusOptions.once_a_year') || '1 năm 1 lần'}</option>
                <option value="performance">{t('jobs.jobFields.bonusOptions.performance') || 'Theo hiệu quả công việc'}</option>
                <option value="none">{t('jobs.jobFields.bonusOptions.none') || 'Không thưởng'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {bonusSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.bonus') || 'Nhập thông tin thưởng...'} 
                  value={bonusCustom} 
                  onChange={e => setBonusCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Tăng lương */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.raise') || 'Tăng lương'}</label>
              <select className="form-select" value={raiseSelect} onChange={e => setRaiseSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="once_a_year">{t('jobs.jobFields.raiseOptions.once_a_year') || '1 năm 1 lần'}</option>
                <option value="performance">{t('jobs.jobFields.raiseOptions.performance') || 'Theo đánh giá năng lực'}</option>
                <option value="none">{t('jobs.jobFields.raiseOptions.none') || 'Không tăng lương'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {raiseSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.raise') || 'Nhập thông tin tăng lương...'} 
                  value={raiseCustom} 
                  onChange={e => setRaiseCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Bảo hiểm & Nenkin */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.insurance') || 'Bảo hiểm & Nenkin'}</label>
              <select className="form-select" value={insuranceSelect} onChange={e => setInsuranceSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="full">{t('jobs.jobFields.insuranceOptions.full') || 'Đầy đủ bảo hiểm & Nenkin'}</option>
                <option value="partial">{t('jobs.jobFields.insuranceOptions.partial') || 'Một phần bảo hiểm & Nenkin'}</option>
                <option value="none">{t('jobs.jobFields.insuranceOptions.none') || 'Không hỗ trợ'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {insuranceSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.insurance') || 'Nhập thông tin bảo hiểm & Nenkin...'} 
                  value={insuranceCustom} 
                  onChange={e => setInsuranceCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Trợ cấp đi lại */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.transport') || 'Trợ cấp đi lại'}</label>
              <select className="form-select" value={transportSelect} onChange={e => setTransportSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="full">{t('jobs.jobFields.transportOptions.full') || 'Chi trả đầy đủ'}</option>
                <option value="limited">{t('jobs.jobFields.transportOptions.limited') || 'Hỗ trợ có giới hạn'}</option>
                <option value="none">{t('jobs.jobFields.transportOptions.none') || 'Không hỗ trợ'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {transportSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.transport') || 'Nhập thông tin trợ cấp...'} 
                  value={transportCustom} 
                  onChange={e => setTransportCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Ký túc xá công ty */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.dormitory') || 'Ký túc xá công ty'}</label>
              <select className="form-select" value={dormitorySelect} onChange={e => setDormitorySelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="full">{t('jobs.jobFields.dormitoryOptions.full') || 'Miễn phí nhà ở & chi phí đầu vào'}</option>
                <option value="partial">{t('jobs.jobFields.dormitoryOptions.partial') || 'Cung cấp KTX (Hỗ trợ tiền nhà & đồ đạc)'}</option>
                <option value="rent_support">{t('jobs.jobFields.dormitoryOptions.rent_support') || 'Hỗ trợ một phần tiền nhà'}</option>
                <option value="none">{t('jobs.jobFields.dormitoryOptions.none') || 'Không hỗ trợ KTX'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {dormitorySelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.dormitory') || 'Nhập thông tin ký túc xá...'} 
                  value={dormitoryCustom} 
                  onChange={e => setDormitoryCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Xin visa */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.visa') || 'Xin visa'}</label>
              <select className="form-select" value={visaSelect} onChange={e => setVisaSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="full">{t('jobs.jobFields.visaOptions.full') || 'Hỗ trợ đầy đủ thủ tục & chi phí'}</option>
                <option value="support">{t('jobs.jobFields.visaOptions.support') || 'Hỗ trợ làm thủ tục chuyển đổi/gia hạn'}</option>
                <option value="none">{t('jobs.jobFields.visaOptions.none') || 'Không hỗ trợ'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {visaSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.visa') || 'Nhập thông tin visa...'} 
                  value={visaCustom} 
                  onChange={e => setVisaCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Hỗ trợ tiền ăn */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.meal') || 'Hỗ trợ tiền ăn'}</label>
              <select className="form-select" value={mealSelect} onChange={e => setMealSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="free">{t('jobs.jobFields.mealOptions.free') || 'Cung cấp bữa ăn miễn phí'}</option>
                <option value="allowance">{t('jobs.jobFields.mealOptions.allowance') || 'Phụ cấp ăn uống hàng tháng'}</option>
                <option value="none">{t('jobs.jobFields.mealOptions.none') || 'Không hỗ trợ'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {mealSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.meal') || 'Nhập thông tin tiền ăn...'} 
                  value={mealCustom} 
                  onChange={e => setMealCustom(e.target.value)} 
                />
              )}
            </div>

            {/* Hỗ trợ khác */}
            <div className="form-group">
              <label className="form-label">{t('jobs.jobFields.other') || 'Hỗ trợ khác'}</label>
              <select className="form-select" value={otherSelect} onChange={e => setOtherSelect(e.target.value)}>
                <option value="">{t('common.select') || 'Chọn...'}</option>
                <option value="cert">{t('jobs.jobFields.otherOptions.cert') || 'Hỗ trợ phí thi chứng chỉ chuyên môn'}</option>
                <option value="health">{t('jobs.jobFields.otherOptions.health') || 'Khám sức khỏe định kỳ miễn phí'}</option>
                <option value="none">{t('jobs.jobFields.otherOptions.none') || 'Không hỗ trợ'}</option>
                <option value="custom">{t('common.other') || 'Khác / Nhập tay...'}</option>
              </select>
              {otherSelect === 'custom' && (
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ marginTop: '8px' }} 
                  placeholder={t('jobs.jobFields.other') || 'Nhập thông tin hỗ trợ khác...'} 
                  value={otherCustom} 
                  onChange={e => setOtherCustom(e.target.value)} 
                />
              )}
            </div>

          </div>
          
          <div className="form-group" style={{marginTop:'16px'}}>
            <label className="form-label">{t('admin.jobContent') || 'Nội dung chi tiết'}</label>
            <textarea 
              ref={textareaRef}
              className="form-input" 
              style={{ minHeight: '120px', resize: 'none', overflow: 'hidden' }}
              placeholder={t('admin.jobContentPlaceholder') || 'Mô tả chi tiết công việc...'} 
              value={description} 
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
