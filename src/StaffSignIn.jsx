import { useState } from 'react';
import { staffSession } from './api/staffSession.js';

export default function StaffSignIn({ onSignedIn }) {
  const [deviceName, setDeviceName] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await staffSession.signIn({ deviceName, pin });
      onSignedIn(result.deviceName);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPin('');
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="form-card">
        <div className="form-banner">
          <div className="banner-logo">SC</div>
          <div className="banner-text"><h1>ระบบสมาชิก SC CRM</h1><p>ยืนยันตัวตนพนักงานก่อนบันทึกข้อมูลสมาชิก</p></div>
        </div>
        <div className="accent-bar" />
        <div className="form-body">
          <form onSubmit={submit}>
            <div className="question-block">
              <label htmlFor="staff-device-name">ชื่อเครื่องที่ผู้ดูแลอนุญาต</label>
              <input id="staff-device-name" className="gf-input" value={deviceName} onChange={event => setDeviceName(event.target.value)} maxLength={100} required disabled={busy} autoComplete="username" />
            </div>
            <div className="question-block">
              <label htmlFor="staff-pin">PIN พนักงาน</label>
              <input id="staff-pin" className="gf-input" type="password" value={pin} onChange={event => setPin(event.target.value)} required disabled={busy} autoComplete="current-password" />
            </div>
            {error && <p role="alert">{error}</p>}
            <p>เมื่อรีเฟรชหรือปิดหน้านี้ ต้องยืนยันตัวตนใหม่</p>
            <button type="submit" className="submit-btn" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'เข้าใช้งาน'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
