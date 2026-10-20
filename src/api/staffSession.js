import { BASE_URL } from './apiConfig.js';

export class StaffSessionRequiredError extends Error {
  constructor() {
    super('กรุณายืนยันตัวตนพนักงานอีกครั้ง');
    this.code = 'STAFF_SESSION_REQUIRED';
  }
}

export function createStaffSession({ fetchImpl = globalThis.fetch, baseUrl = BASE_URL, getDeviceId } = {}) {
  let token = '';
  let generation = 0;
  let tabDeviceId = '';
  // Server bootstrap rotates a token by device ID. Tabs must never share an ID.
  const resolveDeviceId = getDeviceId || (() => {
    tabDeviceId ||= `sccrm-browser-${globalThis.crypto.randomUUID()}`;
    return tabDeviceId;
  });

  return {
    clear() { token = ''; generation += 1; },
    requireToken() {
      if (!token) throw new StaffSessionRequiredError();
      return token;
    },
    async signIn({ pin, deviceName }) {
      token = '';
      const requestGeneration = ++generation;
      const name = String(deviceName || '').trim();
      if (!name || name.length > 100 || typeof pin !== 'string' || !pin) {
        throw new Error('กรุณากรอกชื่อเครื่องและ PIN พนักงาน');
      }
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/api/sccrm/auth/staff-device`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: resolveDeviceId(), deviceName: name, pin }),
          cache: 'no-store',
        });
      } catch {
        throw new Error('เชื่อมต่อระบบยืนยันตัวตนไม่ได้ กรุณาลองใหม่');
      }
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('PIN หรือชื่อเครื่องไม่ได้รับอนุญาต กรุณาตรวจสอบกับผู้ดูแล');
        }
        throw new Error('ระบบยืนยันตัวตนไม่พร้อม กรุณาลองใหม่ภายหลัง');
      }
      let data;
      try { data = await response.json(); } catch { throw new Error('ระบบยืนยันตัวตนตอบกลับไม่สมบูรณ์'); }
      if (requestGeneration !== generation) throw new StaffSessionRequiredError();
      if (typeof data?.staffToken !== 'string' || !/^[A-Za-z0-9_-]{16,2048}$/.test(data.staffToken)) {
        throw new Error('ระบบยืนยันตัวตนตอบกลับไม่สมบูรณ์');
      }
      // Runtime credential stays in this tab's memory. Never return, log or persist it.
      token = data.staffToken;
      return { deviceName: name };
    },
  };
}

export const staffSession = createStaffSession();
