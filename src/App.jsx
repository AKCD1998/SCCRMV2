import { useState } from 'react';
import { registerMember } from './api/crmMembers.js';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const DISEASES = [
  { key: 'hasDiabetes',       label: 'เบาหวาน' },
  { key: 'hasHypertension',   label: 'ความดันโลหิตสูง' },
  { key: 'hasHyperlipidemia', label: 'ไขมันในเลือดสูง' },
  { key: 'hasHeartDisease',   label: 'โรคหัวใจ' },
  { key: 'hasKidneyDisease',  label: 'โรคไต' },
  { key: 'hasLiverDisease',   label: 'โรคตับ' },
  { key: 'hasThyroidDisease', label: 'ไทรอยด์' },
];

const PID_TYPES = [
  { value: '',          label: '— ไม่ระบุ —' },
  { value: 'THAI_ID',   label: 'บัตรประชาชนไทย' },
  { value: 'ALIEN_ID',  label: 'เลขประจำตัวคนต่างชาติ' },
  { value: 'PASSPORT',  label: 'พาสปอร์ต' },
  { value: 'OTHER',     label: 'อื่น ๆ' },
];

const PID_PLACEHOLDERS = {
  THAI_ID:  '1-XXXX-XXXXX-XX-X (13 หลัก)',
  ALIEN_ID: '1234567890123 (13 หลัก)',
  PASSPORT: 'AA1234567',
  OTHER:    'เลขที่เอกสาร',
};

const CHANNELS = ['หน้าร้าน', 'ออนไลน์', 'ทางโทรศัพท์'];

const BLANK_FORM = {
  firstName: '', lastName: '', phone: '', email: '',
  dob: '', sex: '',
  pidType: '', pidNumber: '',
  drugAllergies: '',
  hasDiabetes: false, hasHypertension: false, hasHyperlipidemia: false,
  hasHeartDisease: false, hasKidneyDisease: false,
  hasLiverDisease: false, hasThyroidDisease: false,
  otherConditions: '',
  currentMedications: '',
  pharmacistNote: '',
  branchCode: '', staffName: '',
  channel: 'หน้าร้าน', remark: '',
  consentPdpaGeneral: false,
  consentPdpaHealth: false,
  consentMarketing: false,
};

/* ─── Validation helpers ─────────────────────────────────────────────────── */

function validateThaiId(raw) {
  const id = raw.replace(/\D/g, '');
  if (id.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id[12]);
}

function validateForm(form) {
  const e = {};

  if (!form.firstName.trim()) e.firstName = 'กรุณากรอกชื่อ';
  if (!form.lastName.trim())  e.lastName  = 'กรุณากรอกนามสกุล';

  if (!form.phone.trim()) {
    e.phone = 'กรุณากรอกเบอร์โทรศัพท์';
  } else if (!/^[0-9+\-\s()]{7,20}$/.test(form.phone.trim())) {
    e.phone = 'รูปแบบเบอร์โทรไม่ถูกต้อง';
  }

  if (!form.dob) e.dob = 'กรุณากรอกวันเกิด (ใช้สำหรับตรวจสอบสิทธิ์รับคะแนน)';

  if (form.pidType === 'THAI_ID' && form.pidNumber) {
    if (!validateThaiId(form.pidNumber)) e.pidNumber = 'เลขบัตรประชาชนไม่ถูกต้อง (checksum ผิด)';
  }
  if (form.pidType === 'ALIEN_ID' && form.pidNumber) {
    if (!/^\d{13}$/.test(form.pidNumber.replace(/\D/g, ''))) e.pidNumber = 'ต้องเป็นตัวเลข 13 หลัก';
  }
  if (form.pidType === 'PASSPORT' && form.pidNumber) {
    if (!/^[A-Z0-9]{6,12}$/i.test(form.pidNumber.trim())) e.pidNumber = 'รูปแบบพาสปอร์ตไม่ถูกต้อง (ตัวอักษร/ตัวเลข 6–12 ตัว)';
  }

  if (!form.consentPdpaGeneral) e.consentPdpaGeneral = 'จำเป็นต้องยินยอมข้อนี้เพื่อสมัครสมาชิก';

  return e;
}

/* ─── App ────────────────────────────────────────────────────────────────── */

export default function App() {
  const [form, setForm]               = useState(BLANK_FORM);
  const [errors, setErrors]           = useState({});
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [apiError, setApiError]       = useState('');
  const [memberCode, setMemberCode]   = useState('');

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to the first error field
      setTimeout(() => {
        const el = document.querySelector('[data-has-error="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setSubmitState('submitting');
    setApiError('');

    try {
      const result = await registerMember(form);
      const code = result?.data?.memberCode ?? result?.memberCode ?? '';
      setMemberCode(code);
      setSubmitState('success');
    } catch (err) {
      setApiError(err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      setSubmitState('error');
    }
  }

  function handleRegisterAnother() {
    setForm(BLANK_FORM);
    setErrors({});
    setSubmitState('idle');
    setApiError('');
    setMemberCode('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isSubmitting = submitState === 'submitting';

  return (
    <div className="page">
      <div className="form-card">

        {/* ── Banner ── */}
        <div className="form-banner">
          <div className="banner-logo">SC</div>
          <div className="banner-text">
            <h1>ระบบสมาชิก SC CRM</h1>
            <p>บันทึกข้อมูลลูกค้าสมาชิกใหม่ — กรุณากรอกข้อมูลให้ครบถ้วน</p>
          </div>
        </div>
        <div className="accent-bar" />

        {/* ── Form body ── */}
        <div className="form-body">
          <p className="required-note">* หมายถึงข้อมูลที่จำเป็น</p>

          <form onSubmit={handleSubmit} noValidate>

            {/* ══ Section 1: ข้อมูลสมาชิก ══ */}
            <SectionHeader>ข้อมูลสมาชิก</SectionHeader>
            <div className="question-block">
              <div className="two-col">
                <Field label="ชื่อ" required error={errors.firstName}>
                  <input
                    className={`gf-input${errors.firstName ? ' invalid' : ''}`}
                    type="text"
                    value={form.firstName}
                    onChange={e => setField('firstName', e.target.value)}
                    placeholder="ชื่อจริง"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="นามสกุล" required error={errors.lastName}>
                  <input
                    className={`gf-input${errors.lastName ? ' invalid' : ''}`}
                    type="text"
                    value={form.lastName}
                    onChange={e => setField('lastName', e.target.value)}
                    placeholder="นามสกุล"
                    autoComplete="family-name"
                  />
                </Field>
              </div>

              <div className="two-col">
                <Field label="เบอร์โทรศัพท์" required error={errors.phone}>
                  <input
                    className={`gf-input${errors.phone ? ' invalid' : ''}`}
                    type="tel"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    placeholder="0812345678"
                    autoComplete="tel"
                  />
                </Field>
                <Field label="อีเมล">
                  <input
                    className="gf-input"
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="email@example.com"
                    autoComplete="email"
                  />
                </Field>
              </div>

              <div className="two-col">
                <Field label="วันเกิด" required error={errors.dob}>
                  <input
                    className={`gf-input${errors.dob ? ' invalid' : ''}`}
                    type="date"
                    value={form.dob}
                    onChange={e => setField('dob', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </Field>
                <Field label="เพศ">
                  <select
                    className="gf-select"
                    value={form.sex}
                    onChange={e => setField('sex', e.target.value)}
                  >
                    <option value="">— ไม่ระบุ —</option>
                    <option value="male">ชาย</option>
                    <option value="female">หญิง</option>
                  </select>
                </Field>
              </div>
            </div>

            {/* ══ Section 2: ข้อมูลยืนยันตัวตน ══ */}
            <SectionHeader>ข้อมูลยืนยันตัวตน</SectionHeader>
            <div className="question-block">
              <Field label="ประเภทเอกสาร">
                <select
                  className="gf-select"
                  value={form.pidType}
                  onChange={e => { setField('pidType', e.target.value); setField('pidNumber', ''); }}
                >
                  {PID_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>

              {form.pidType && (
                <Field label="เลขที่เอกสาร" error={errors.pidNumber}>
                  <input
                    className={`gf-input${errors.pidNumber ? ' invalid' : ''}`}
                    type="text"
                    value={form.pidNumber}
                    onChange={e => setField('pidNumber', e.target.value)}
                    placeholder={PID_PLACEHOLDERS[form.pidType] || 'เลขที่เอกสาร'}
                    autoComplete="off"
                  />
                  {form.pidType === 'THAI_ID' && (
                    <p className="field-hint">ระบบจะตรวจสอบ checksum ของเลขบัตร 13 หลักโดยอัตโนมัติ</p>
                  )}
                </Field>
              )}
            </div>

            {/* ══ Section 3: ข้อมูลสุขภาพสำคัญ ══ */}
            <SectionHeader>ข้อมูลสุขภาพสำคัญ</SectionHeader>
            <div className="health-note">
              <span>ℹ</span>
              ข้อมูลนี้ใช้เพื่อช่วยเตือนเภสัชกรเท่านั้น — ไม่ใช่การวินิจฉัยโรค และจะถูกเก็บเป็นความลับ
            </div>
            <div className="question-block">
              <Field label="ประวัติแพ้ยา">
                <textarea
                  className="gf-textarea"
                  value={form.drugAllergies}
                  onChange={e => setField('drugAllergies', e.target.value)}
                  placeholder="เช่น Penicillin, Aspirin, Sulfa — ระบุชื่อยาที่แพ้"
                  rows={2}
                />
              </Field>

              <div className="field-group">
                <label className="field-label">โรคประจำตัว</label>
                <div className="disease-grid">
                  {DISEASES.map(d => (
                    <label key={d.key} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form[d.key]}
                        onChange={e => setField(d.key, e.target.checked)}
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
                <input
                  className="gf-input"
                  type="text"
                  value={form.otherConditions}
                  onChange={e => setField('otherConditions', e.target.value)}
                  placeholder="โรคอื่น ๆ (ระบุ)"
                  style={{ marginTop: '8px' }}
                />
              </div>

              <Field label="ยาที่ใช้ประจำ">
                <textarea
                  className="gf-textarea"
                  value={form.currentMedications}
                  onChange={e => setField('currentMedications', e.target.value)}
                  placeholder="ชื่อยา / ขนาด / ความถี่ เช่น Metformin 500mg วันละ 2 ครั้ง"
                  rows={2}
                />
              </Field>

              <Field label="หมายเหตุสำหรับเภสัชกร">
                <textarea
                  className="gf-textarea"
                  value={form.pharmacistNote}
                  onChange={e => setField('pharmacistNote', e.target.value)}
                  placeholder="ข้อมูลเพิ่มเติมที่ควรแจ้งเภสัชกร"
                  rows={2}
                />
              </Field>
            </div>

            {/* ══ Section 4: ข้อมูลระบบ ══ */}
            <SectionHeader>ข้อมูลระบบ</SectionHeader>
            <div className="question-block">
              <div className="two-col">
                <Field label="สาขาที่สมัคร">
                  <input
                    className="gf-input"
                    type="text"
                    value={form.branchCode}
                    onChange={e => setField('branchCode', e.target.value)}
                    placeholder="รหัสสาขา เช่น SC001"
                  />
                </Field>
                <Field label="พนักงานผู้บันทึก">
                  <input
                    className="gf-input"
                    type="text"
                    value={form.staffName}
                    onChange={e => setField('staffName', e.target.value)}
                    placeholder="ชื่อพนักงาน"
                  />
                </Field>
              </div>
              <div className="two-col">
                <Field label="ช่องทางสมัคร">
                  <select
                    className="gf-select"
                    value={form.channel}
                    onChange={e => setField('channel', e.target.value)}
                  >
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="หมายเหตุ">
                  <input
                    className="gf-input"
                    type="text"
                    value={form.remark}
                    onChange={e => setField('remark', e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติม"
                  />
                </Field>
              </div>
            </div>

            {/* ══ Section 5: PDPA / Consent ══ */}
            <SectionHeader>ความยินยอม (PDPA)</SectionHeader>
            <div className="question-block">
              <ConsentItem
                checked={form.consentPdpaGeneral}
                onChange={v => setField('consentPdpaGeneral', v)}
                required
                error={errors.consentPdpaGeneral}
                label="ยินยอมให้ร้านยา SC เก็บและใช้ข้อมูลส่วนบุคคลเพื่อระบบสมาชิกและการให้บริการ"
              />
              <ConsentItem
                checked={form.consentPdpaHealth}
                onChange={v => setField('consentPdpaHealth', v)}
                label="ยินยอมให้ใช้ข้อมูลสุขภาพและประวัติการซื้อเพื่อช่วยดูแลความปลอดภัยด้านยา"
              />
              <ConsentItem
                checked={form.consentMarketing}
                onChange={v => setField('consentMarketing', v)}
                label="ยินยอมรับข่าวสารและโปรโมชั่นสุขภาพจากร้านยา SC"
              />
            </div>

            {/* ══ Submit ══ */}
            <div className="submit-row">
              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'กำลังบันทึก…' : 'บันทึกสมาชิก'}
              </button>
              {submitState === 'error' && apiError && (
                <p className="api-error" role="alert">{apiError}</p>
              )}
            </div>

          </form>
        </div>
      </div>

      {/* ── Success overlay ── */}
      {submitState === 'success' && (
        <div className="status-overlay" onClick={handleRegisterAnother}>
          <div className="status-card" onClick={e => e.stopPropagation()}>
            <div className="status-icon success">
              <svg viewBox="0 0 52 52" fill="none">
                <circle
                  cx="26" cy="26" r="24"
                  stroke="#27ae60" strokeWidth="2.5"
                  className="stroke-anim"
                />
                <path
                  d="M14 26l8 8 16-16"
                  stroke="#27ae60" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  className="check-anim"
                />
              </svg>
            </div>
            <h2>สมัครสมาชิกสำเร็จ</h2>
            {memberCode ? (
              <p className="member-code-display">
                รหัสสมาชิก: <strong>{memberCode}</strong>
              </p>
            ) : (
              <p className="status-sub">ข้อมูลถูกบันทึกเรียบร้อยแล้ว</p>
            )}
            <p className="status-sub">กดปุ่มด้านล่างเพื่อสมัครสมาชิกรายต่อไป</p>
            <button className="submit-btn" onClick={handleRegisterAnother}>
              สมัครสมาชิกรายใหม่
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Small components ───────────────────────────────────────────────────── */

function SectionHeader({ children }) {
  return <h2 className="section-header">{children}</h2>;
}

function Field({ label, required, error, children }) {
  return (
    <div className="field-group" data-has-error={!!error ? 'true' : undefined}>
      <label className="field-label">
        {label}
        {required && <span className="required-star"> *</span>}
      </label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

function ConsentItem({ checked, onChange, required, label, error }) {
  return (
    <div className="consent-item" data-has-error={!!error ? 'true' : undefined}>
      <label className="checkbox-label consent-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span>
          {label}
          {required && <span className="required-star"> *</span>}
        </span>
      </label>
      {error && <p className="field-error" role="alert" style={{ marginLeft: '24px' }}>{error}</p>}
    </div>
  );
}
