import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffSession } from './staffSession.js';
import { registerMember } from './crmMembers.js';

const fixtureToken = 'fixture_runtime_staff_session_1234567890';
const form = { firstName: 'Fixture', lastName: 'Member', phone: '0000000000', email: '', sex: '', dob: '2000-01-01', consentPdpaGeneral: true, consentPdpaHealth: false, consentMarketing: false, channel: 'หน้าร้าน' };
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

async function signedInSession() {
  const session = createStaffSession({ fetchImpl: async () => response(200, { ok: true, staffToken: fixtureToken }), getDeviceId: () => 'sccrm-browser-fixture' });
  await session.signIn({ pin: 'fixture-pin', deviceName: 'Fixture browser' });
  return session;
}

test('PIN bootstrap uses the existing staff endpoint without a Sync credential and returns no token', async () => {
  const requests = [];
  const session = createStaffSession({ baseUrl: 'https://example.invalid', getDeviceId: () => 'sccrm-browser-fixture', fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return response(200, { ok: true, staffToken: fixtureToken });
  } });
  const result = await session.signIn({ pin: 'fixture-pin', deviceName: 'Fixture browser' });
  assert.deepEqual(result, { deviceName: 'Fixture browser' });
  assert.equal(requests[0].url, 'https://example.invalid/api/sccrm/auth/staff-device');
  assert.deepEqual(requests[0].options.headers, { 'Content-Type': 'application/json' });
  assert.equal(requests[0].options.cache, 'no-store');
  assert.equal(JSON.parse(requests[0].options.body).deviceId, 'sccrm-browser-fixture');
  assert.equal(session.requireToken(), fixtureToken);
  session.clear();
  assert.throws(() => session.requireToken(), { code: 'STAFF_SESSION_REQUIRED' });
});

test('anonymous registration is blocked before any network or business write', async () => {
  let calls = 0;
  await assert.rejects(registerMember(form, { session: createStaffSession(), fetchImpl: async () => { calls += 1; } }), { code: 'STAFF_SESSION_REQUIRED' });
  assert.equal(calls, 0);
});

test('separate tabs have distinct device IDs and re-sign-in rotates only that tab', async () => {
  const ids = [];
  const fetchImpl = async (_url, options) => {
    ids.push(JSON.parse(options.body).deviceId);
    return response(200, { staffToken: fixtureToken });
  };
  const first = createStaffSession({ fetchImpl });
  const second = createStaffSession({ fetchImpl });
  const login = { pin: 'fixture-pin', deviceName: 'Fixture browser' };
  await first.signIn(login);
  await second.signIn(login);
  await first.signIn(login);
  assert.notEqual(ids[0], ids[1]);
  assert.equal(ids[0], ids[2]);
  assert.match(ids[0], /^sccrm-browser-[a-f0-9-]{36}$/);
});

test('registration and optional health save send only the runtime staff credential', async () => {
  const session = await signedInSession();
  const requests = [];
  const result = await registerMember({ ...form, consentPdpaHealth: true, drugAllergies: 'fixture' }, { session, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return requests.length === 1 ? response(201, { ok: true, data: { id: 'fixture-member', memberCode: 'fixture-code' } }) : response(200, { ok: true });
  } });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 2);
  for (const request of requests) assert.deepEqual(request.options.headers, { 'Content-Type': 'application/json', Authorization: `Bearer ${fixtureToken}` });
  assert.ok(requests[0].url.endsWith('/api/crm/members'));
  assert.ok(requests[1].url.endsWith('/api/crm/members/fixture-member/health'));
  const payload = JSON.parse(requests[0].options.body);
  assert.equal(payload.name, 'Fixture Member');
  assert.equal(payload.consents.pdpa_general, true);
  assert.equal(payload.consent_version, 'v1.0');
});

test('a failed optional health write does not retry successful registration', async () => {
  const session = await signedInSession();
  let calls = 0;
  const result = await registerMember({ ...form, consentPdpaHealth: true, drugAllergies: 'fixture' }, { session, fetchImpl: async () => ++calls === 1 ? response(201, { id: 'fixture-member' }) : response(500, {}) });
  assert.equal(result.id, 'fixture-member');
  assert.equal(calls, 2);
});

test('revoked runtime staff credential clears the session and requires sign-in without retry', async () => {
  const session = await signedInSession();
  let calls = 0;
  await assert.rejects(registerMember(form, { session, fetchImpl: async () => { calls += 1; return response(401, { error: 'unauthorized' }); } }), { code: 'STAFF_SESSION_REQUIRED' });
  assert.equal(calls, 1);
  assert.throws(() => session.requireToken(), { code: 'STAFF_SESSION_REQUIRED' });
});

test('duplicate member errors remain understandable', async () => {
  await assert.rejects(registerMember(form, { session: await signedInSession(), fetchImpl: async () => response(409, { error: 'duplicate phone' }) }), /เบอร์โทรหรืออีเมลนี้มีในระบบแล้ว/);
});

test('a late PIN response cannot restore a signed-out session', async () => {
  let finish;
  const session = createStaffSession({ getDeviceId: () => 'sccrm-browser-fixture', fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  const pending = session.signIn({ pin: 'fixture-pin', deviceName: 'Fixture' });
  session.clear();
  finish(response(200, { staffToken: fixtureToken }));
  await assert.rejects(pending, { code: 'STAFF_SESSION_REQUIRED' });
  assert.throws(() => session.requireToken(), { code: 'STAFF_SESSION_REQUIRED' });
});

test('login errors do not echo server details and malformed tokens are refused', async () => {
  const session = createStaffSession({ getDeviceId: () => 'sccrm-browser-fixture', fetchImpl: async () => response(401, { error: 'sensitive server detail' }) });
  await assert.rejects(session.signIn({ pin: 'fixture-pin', deviceName: 'Fixture' }), error => !error.message.includes('sensitive server detail'));
  const malformed = createStaffSession({ getDeviceId: () => 'sccrm-browser-fixture', fetchImpl: async () => response(200, { staffToken: 'bad\r\nheader' }) });
  await assert.rejects(malformed.signIn({ pin: 'fixture-pin', deviceName: 'Fixture' }));
  assert.throws(() => malformed.requireToken(), { code: 'STAFF_SESSION_REQUIRED' });
});
