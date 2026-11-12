import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareEvidence, createEvidenceClient, saveCapturedEvidence, targetPath } from './careops-evidence.mjs';
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const bytes = Buffer.from('%PDF-fictional'), sha256 = createHash('sha256').update(bytes).digest('hex');
const bundle = () => ({ status: 'captured', artifacts: [{ filename: 'summary.pdf', bytes }, { filename: 'component-01.pdf', bytes }], manifest: {
  captureId: id, provider: 'fowler', componentsExpected: 1, failures: [], artifacts: [
    { filename: 'summary.pdf', kind: 'summary', byteLength: bytes.length, sha256, sourceUrl: 'private-provider-url' },
    { filename: 'component-01.pdf', kind: 'component', byteLength: bytes.length, sha256, sourceUrl: 'private-provider-url' },
  ],
} });
test('employee or prehire application is required, with no ambiguous target', () => {
  assert.ok(targetPath({ employeeId: id }).includes('/employees/'));
  assert.ok(targetPath({ applicationId: id }).includes('/employmentapplications/'));
  for (const target of [{}, { employeeId: id, applicationId: other }, { employeeId: '../anything' }]) assert.throws(() => targetPath(target));
});
test('checks every hash and report part before any upload; metadata omits private URLs', () => {
  const payloads = prepareEvidence({ employeeId: id }, bundle());
  assert.equal(payloads.length, 2); assert.ok(!JSON.stringify(payloads).includes('private-provider-url'));
  assert.equal(payloads[1].componentIndex, 1); assert.equal(payloads[0].checkDate, null);
  const altered = bundle(); altered.artifacts[1].bytes = Buffer.from('%PDF-changed');
  assert.throws(() => prepareEvidence({ employeeId: id }, altered));
  assert.throws(() => prepareEvidence({ employeeId: id }, { ...bundle(), status: 'partial' }));
});
test('uncertain upload stops the batch and retries use the same capture identity', async () => {
  let attempts = 0;
  const saved = await saveCapturedEvidence({ inspect: async () => {}, upload: async () => { attempts++; throw Error('network'); } }, { employeeId: id }, bundle());
  assert.equal(saved.status, 'upload_unconfirmed'); assert.equal(attempts, 1); assert.equal(saved.retrySameCapture, true);
  const capturedIds = [];
  const retry = await saveCapturedEvidence({ inspect: async () => {}, upload: async (_target, body) => { capturedIds.push(body.captureId); return { documentId: other }; } }, { employeeId: id }, bundle());
  assert.equal(retry.status, 'saved_for_scanning'); assert.deepEqual(capturedIds, [id, id]);
});
test('client refuses scope mismatch and never forwards tokens through redirects', async () => {
  let observed;
  const client = createEvidenceClient({ apiBaseUrl: 'https://careops.example.invalid', getAccessToken: async () => 'fictional-token',
    fetchImpl: async (_url, options) => { observed = options; return { ok: true, json: async () => ({ ok: true, employeeId: other }) }; } });
  await assert.rejects(client.inspect({ employeeId: id }), /target_mismatch/);
  assert.equal(observed.redirect, 'error');
  assert.throws(() => createEvidenceClient({ apiBaseUrl: 'http://external.example.invalid', getAccessToken: async () => '' }));
});
