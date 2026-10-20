/**
 * SC CRM Member Registration — API Client
 *
 * Uses the existing server-side staff-device authorization for CRM routes.
 */

import { BASE_URL } from './apiConfig.js';
import { staffSession, StaffSessionRequiredError } from './staffSession.js';

const MEMBER_ENDPOINT = '/api/crm/members';
const CONSENT_VERSION = 'v1.0';

function authHeaders(session) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.requireToken()}` };
}

async function parseError(res) {
  let msg = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    msg = String(body.error || body.message || msg);
  } catch (_) { /* ignore */ }
  return msg;
}

/**
 * Register a new CRM member.
 * Returns the raw response body from the backend.
 * Throws with a Thai-language message on failure.
 */
export async function registerMember(form, { fetchImpl = globalThis.fetch, session = staffSession } = {}) {
  const headers = authHeaders(session);
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

  const res = await fetchImpl(`${BASE_URL}${MEMBER_ENDPOINT}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    if (res.status === 401) {
      session.clear();
      throw new StaffSessionRequiredError();
    }
    const raw = await parseError(res);
    throw new Error(mapApiError(res.status, raw));
  }

  const data = await res.json();

  // If health consent given and there is health data, attempt a second call
  const memberId = data?.data?.id ?? data?.id;
  if (form.consentPdpaHealth && memberId && hasHealthData(form)) {
    try {
      await saveHealthRecord(memberId, form, { fetchImpl, session });
    } catch {
      // Non-fatal: health record endpoint may not exist yet
    }
  }

  return data;
}

async function saveHealthRecord(memberId, form, { fetchImpl, session }) {
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

  const res = await fetchImpl(`${BASE_URL}${MEMBER_ENDPOINT}/${encodeURIComponent(memberId)}/health`, {
    method: 'PUT',
    headers: authHeaders(session),
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
    return 'ไม่มีสิทธิ์บันทึกข้อมูล กรุณาติดต่อผู้ดูแล';
  }
  if (status === 400) {
    return `ข้อมูลไม่ถูกต้อง: ${raw}`;
  }
  if (status >= 500) {
    return `เซิร์ฟเวอร์มีปัญหา (${status}) — กรุณาลองใหม่ภายหลัง`;
  }
  return raw || `เกิดข้อผิดพลาด (${status})`;
}
