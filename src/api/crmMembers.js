/**
 * SC CRM Member Registration — API Client
 *
 * Primary endpoint: POST /api/crm/members  (ยังไม่ได้ implement ใน backend)
 * Fallback target:  POST /api/members      (มีอยู่แล้วใน loyalty.js)
 *
 * เปลี่ยน endpoint ได้ที่ MEMBER_ENDPOINT ด้านล่าง
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const STAFF_TOKEN = import.meta.env.VITE_STAFF_TOKEN || '';
const POS_API_KEY = import.meta.env.VITE_POS_API_KEY || '';

const MEMBER_ENDPOINT = '/api/crm/members';
const CONSENT_VERSION = 'v1.0';

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (STAFF_TOKEN) h['Authorization'] = `Bearer ${STAFF_TOKEN}`;
  if (POS_API_KEY) h['x-pos-api-key'] = POS_API_KEY;
  return h;
}

async function parseError(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    msg = body.error || body.message || msg;
  } catch (_) { /* ignore */ }
  return msg;
}

/**
 * Register a new CRM member.
 * Returns the raw response body from the backend.
 * Throws with a Thai-language message on failure.
 */
export async function registerMember(form) {
  const name = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');

  const payload = {
    name,
    phone: form.phone.trim(),
    ...(form.email.trim() && { email: form.email.trim() }),
    ...(form.sex       && { sex: form.sex }),
    ...(form.dob       && { dob: form.dob }),
    remark: buildRemark(form) || undefined,
    consents: {
      pdpa_general:  form.consentPdpaGeneral,
      pdpa_health:   form.consentPdpaHealth,
      marketing_email: form.consentMarketing,
      marketing_sms:   false,
    },
    consent_version: CONSENT_VERSION,
  };

  if (import.meta.env.DEV) {
    // Log payload in dev mode only — never logs PID or health data directly
    const safe = { ...payload };
    console.log('[SCCRMV2] registerMember →', safe);
  }

  const res = await fetch(`${BASE_URL}${MEMBER_ENDPOINT}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await parseError(res);
    throw new Error(mapApiError(res.status, raw));
  }

  const data = await res.json();

  // If health consent given and there is health data, attempt a second call
  const memberId = data?.data?.id ?? data?.id;
  if (form.consentPdpaHealth && memberId && hasHealthData(form)) {
    try {
      await saveHealthRecord(memberId, form);
    } catch (err) {
      // Non-fatal: health record endpoint may not exist yet
      if (import.meta.env.DEV) {
        console.warn('[SCCRMV2] health record save failed (non-fatal):', err.message);
      }
    }
  }

  return data;
}

async function saveHealthRecord(memberId, form) {
  const payload = {
    ...(form.pidType   && { pidDocumentType: form.pidType }),
    ...(form.pidNumber && { pidDocumentNumberRaw: form.pidNumber }),
    hasDiabetes:        form.hasDiabetes,
    hasHypertension:    form.hasHypertension,
    hasHyperlipidemia:  form.hasHyperlipidemia,
    hasHeartDisease:    form.hasHeartDisease,
    hasKidneyDisease:   form.hasKidneyDisease,
    hasLiverDisease:    form.hasLiverDisease,
    hasThyroidDisease:  form.hasThyroidDisease,
    ...(form.otherConditions   && { otherConditions: form.otherConditions }),
    ...(form.drugAllergies     && { drugAllergies: form.drugAllergies }),
    ...(form.currentMedications && { currentMedications: form.currentMedications }),
  };

  const res = await fetch(`${BASE_URL}${MEMBER_ENDPOINT}/${memberId}/health`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`health HTTP ${res.status}`);
}

function hasHealthData(form) {
  return !!(
    form.drugAllergies || form.currentMedications ||
    form.hasDiabetes || form.hasHypertension || form.hasHyperlipidemia ||
    form.hasHeartDisease || form.hasKidneyDisease ||
    form.hasLiverDisease || form.hasThyroidDisease ||
    form.otherConditions
  );
}

function buildRemark(form) {
  const parts = [];
  if (form.pharmacistNote) parts.push(`[เภสัช] ${form.pharmacistNote.trim()}`);
  if (form.branchCode)     parts.push(`สาขา: ${form.branchCode.trim()}`);
  if (form.staffName)      parts.push(`บันทึกโดย: ${form.staffName.trim()}`);
  if (form.channel && form.channel !== 'หน้าร้าน') parts.push(`ช่องทาง: ${form.channel}`);
  if (form.remark)         parts.push(form.remark.trim());
  return parts.join(' | ');
}

function mapApiError(status, raw) {
  const lower = raw.toLowerCase();
  if (lower.includes('duplicate') || lower.includes('already') || lower.includes('conflict')) {
    return 'เบอร์โทรหรืออีเมลนี้มีในระบบแล้ว';
  }
  if (status === 404) {
    return 'ไม่พบ endpoint ของ backend — กรุณาตรวจสอบ VITE_API_BASE_URL หรือติดต่อผู้ดูแลระบบ';
  }
  if (status === 401 || status === 403) {
    return 'ไม่มีสิทธิ์เข้าถึง — กรุณาตรวจสอบ VITE_STAFF_TOKEN หรือ VITE_POS_API_KEY';
  }
  if (status === 400) {
    return `ข้อมูลไม่ถูกต้อง: ${raw}`;
  }
  if (status >= 500) {
    return `เซิร์ฟเวอร์มีปัญหา (${status}) — กรุณาลองใหม่ภายหลัง`;
  }
  return raw || `เกิดข้อผิดพลาด (${status})`;
}
