import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRetrieval, nextRetrieval, retrievalView, effectiveState, stagingKey,
  providerCandidates, captureManifest, type Retrieval, type Event, type Actor } from '../fowlerRetrieval.mjs';

const staffId = '11111111-1111-4111-8111-111111111111', workerId = '22222222-2222-4222-8222-222222222222';
const employeeId = '33333333-3333-4333-8333-333333333333', applicationId = '44444444-4444-4444-8444-444444444444';
const connectionRevision = '55555555-5555-4555-8555-555555555555', captureId = '66666666-6666-4666-8666-666666666666';
const staff: Actor = { kind: 'staff', id: staffId }, worker: Actor = { kind: 'worker', id: workerId };
const now = new Date('2026-09-28T02:00:00Z'), scope = { employeeId, applicationId };
const context = { scope, connectionRevision, workerId };
const hash = 'a'.repeat(64), otherHash = 'b'.repeat(64);
const candidate = (reference: string, report = true) => ({ name: 'Casey Example', reference, status: 'Released',
  received: '09/01/2026', released: null, reportUrl: report ? `https://reports.example.invalid/4DACTION/WebAppTextReport/${reference}` : null });
function job() { return createRetrieval({ id: randomUUID(), revision: randomUUID(), target: { kind: 'employee', id: employeeId },
  scope, requestedBy: staffId, connectionRevision, credentialVersion: 'a'.repeat(32), lastName: 'Example' }, now); }
function next(state: Retrieval, event: Event, actor = worker, at = now) {
  return nextRetrieval(state, event, actor, randomUUID(), at, context);
}
function candidates() {
  const claimed = next(job(), { action: 'claim' });
  return next(claimed, { action: 'lookup_complete', lease: claimed.lease!.token,
    candidates: [candidate('fixture-a'), candidate('fixture-b'), candidate('fixture-processing', false)], pagingVisible: true });
}
function captured() {
  const found = candidates(), selected = next(found, { action: 'select', key: found.candidates[1].key }, staff);
  const claimed = next(selected, { action: 'claim' });
  return next(claimed, { action: 'capture_complete', lease: claimed.lease!.token,
    capture: { id: captureId, capturedAt: now.toISOString(), parts: [
      { index: 0, sha256: hash, byteLength: 20 }, { index: 1, sha256: otherHash, byteLength: 30 }] } });
}

test('lookup keeps identical full names, processing rows and page coverage distinct', () => {
  const result = candidates();
  assert.equal(result.state, 'choose_report'); assert.equal(result.selectedKey, null);
  assert.equal(result.candidates.length, 3); assert.ok(result.candidates.every(row => row.sameName));
  assert.equal(result.pagingVisible, true);
  assert.throws(() => next(result, { action: 'select', key: 'Casey Example' }, staff));
  assert.throws(() => next(result, { action: 'select', key: result.candidates[2].key }, staff));
  const picked = next(result, { action: 'select', key: result.candidates[1].key }, staff);
  assert.equal(picked.selectedKey, result.candidates[1].key);
  assert.equal(picked.state, 'capture_queued');
});

test('connection replacement, changed person links and another worker invalidate results', () => {
  const pending = next(job(), { action: 'claim' });
  const event: Event = { action: 'lookup_complete', lease: pending.lease!.token, candidates: [], pagingVisible: false };
  assert.throws(() => nextRetrieval(pending, event, worker, randomUUID(), now, { ...context, connectionRevision: randomUUID() }));
  assert.throws(() => nextRetrieval(pending, event, worker, randomUUID(), now, { ...context, scope: { employeeId, applicationId: null } }));
  assert.throws(() => next(pending, event, { kind: 'worker', id: randomUUID() }));
  assert.throws(() => next(pending, event, staff));
  assert.throws(() => next(pending, { ...event, lease: randomUUID() }));
});

test('cancelled and expired requests reject late worker results; claims cannot overlap', () => {
  const claimed = next(job(), { action: 'claim' });
  assert.throws(() => next(claimed, { action: 'claim' }));
  const result: Event = { action: 'lookup_complete', lease: claimed.lease!.token, candidates: [], pagingVisible: false };
  assert.throws(() => next(claimed, result, worker, new Date(now.getTime() + 300000)));
  const cancelled = next(claimed, { action: 'cancel' }, staff);
  assert.throws(() => next(cancelled, result));
  assert.equal(effectiveState(job(), new Date(now.getTime() + 86400000)), 'expired');
  assert.throws(() => next(job(), { action: 'claim' }, worker, new Date(now.getTime() + 300000)));
});

test('saving requires staff action and all file receipts; saved means pending scanning, not passed screening', () => {
  let value = captured();
  assert.throws(() => next(value, { action: 'claim' }));
  value = next(value, { action: 'save', checkDate: null }, staff);
  value = next(value, { action: 'claim' });
  assert.throws(() => next(value, { action: 'save_complete', lease: value.lease!.token }));
  const firstId = randomUUID();
  const first: Event = { action: 'part_saved', lease: value.lease!.token, index: 0, sha256: hash, documentId: firstId };
  value = next(value, first); value = next(value, first);
  assert.equal(value.receipts.length, 1);
  assert.throws(() => next(value, { ...first, documentId: randomUUID() }));
  assert.throws(() => next(value, { ...first, index: 1, sha256: otherHash }));
  assert.throws(() => next(value, { ...first, index: 1, sha256: hash, documentId: randomUUID() }));
  value = next(value, { ...first, index: 1, sha256: otherHash, documentId: randomUUID() });
  value = next(value, { action: 'save_complete', lease: value.lease!.token });
  assert.equal(value.state, 'saved_for_scanning');
  assert.throws(() => next(value, { action: 'retry' }, staff));
});

test('partial save survives serialization, retains capture and requires explicit retry with same date', () => {
  let value = next(next(captured(), { action: 'save', checkDate: '2026-09-01' }, staff), { action: 'claim' });
  value = next(value, { action: 'part_saved', lease: value.lease!.token, index: 0, sha256: hash, documentId: randomUUID() });
  const original = structuredClone(value);
  value = JSON.parse(JSON.stringify(value));
  const later = new Date(now.getTime() + 300001);
  assert.equal(effectiveState(value, later), 'save_unconfirmed');
  assert.throws(() => next(value, { action: 'claim' }, worker, later));
  assert.throws(() => next(value, { action: 'retry' }, staff, later));
  assert.throws(() => next(value, { action: 'select', key: value.selectedKey! }, staff, later));
  assert.throws(() => next(value, { action: 'save', checkDate: null }, staff, later));
  value = next(value, { action: 'save', checkDate: '2026-09-01' }, staff, later);
  value = next(value, { action: 'claim' }, worker, later);
  assert.deepEqual(value.capture, original.capture); assert.deepEqual(value.receipts, original.receipts);
  assert.equal(value.selectedKey, original.selectedKey); assert.notEqual(value.lease!.token, original.lease!.token);
  assert.throws(() => next(value, { action: 'save_complete', lease: original.lease!.token }, worker, later));
});

test('staff view excludes credential versions, URLs, lease tokens, search input and staging paths', () => {
  const value = captured(), serialized = JSON.stringify(retrievalView(value));
  for (const forbidden of ['credentialVersion', 'connectionRevision', 'reportUrl', 'https://', 'lastName', 'lease', 'sha256']) {
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  }
  assert.equal(serialized.includes('WebAppTextReport'), false);
  assert.equal(serialized.includes('Casey Example'), true);
  const view = retrievalView(value); view.target.id = randomUUID();
  assert.equal(value.target.id, employeeId);
});

test('malformed results, leaked extra fields and incomplete or oversized captures are rejected', () => {
  assert.throws(() => providerCandidates([{ ...candidate('fixture'), ssn: '000-00-0000' }]));
  assert.throws(() => providerCandidates([candidate('same'), candidate('same')]));
  assert.throws(() => providerCandidates([{ ...candidate('x'), reportUrl: 'https://attacker.invalid/report' }]));
  assert.throws(() => providerCandidates([{ ...candidate('x'), reportUrl: 'https://reports.example.invalid/4DACTION/WebAppTextReport/x?ssn=000' }]));
  assert.throws(() => captureManifest({ id: captureId, capturedAt: now.toISOString(), parts: [{ index: 1, sha256: hash, byteLength: 5 }] }, now));
  assert.throws(() => captureManifest({ id: captureId, capturedAt: now.toISOString(), parts: Array.from({ length: 4 }, (_, index) => ({ index, sha256: hash, byteLength: 10 * 1024 * 1024 })) }, now));
  assert.throws(() => stagingKey('../other', captureId, 0));
  assert.throws(() => stagingKey(job().id, captureId, -1));
});

test('unknown worker actions and injected command fields fail closed', () => {
  assert.throws(() => next(job(), { action: 'approve' } as unknown as Event));
  assert.throws(() => next(job(), { action: 'claim', url: 'https://attacker.invalid' } as unknown as Event));
  assert.throws(() => next(job(), { action: 'claim' }, { kind: 'other', id: workerId } as unknown as Actor));
});

test('failed authentication cannot loop; an empty page is not a screening result', () => {
  const claimed = next(job(), { action: 'claim' });
  const failed = next(claimed, { action: 'fail', lease: claimed.lease!.token, reason: 'sign_in_required' });
  assert.throws(() => next(failed, { action: 'retry' }, staff));
  const empty = next(claimed, { action: 'lookup_complete', lease: claimed.lease!.token, candidates: [], pagingVisible: true });
  assert.equal(empty.state, 'no_matches_on_page'); assert.equal(empty.pagingVisible, true);
  assert.equal(next(empty, { action: 'retry' }, staff).state, 'lookup_queued');
});
