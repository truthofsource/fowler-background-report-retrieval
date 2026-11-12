import { createHash } from 'node:crypto';
import { captureReportBundle, selectApplicantReport } from './report-retrieval.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const invalid = () => { throw Error('invalid_evidence_request'); };
export function targetPath(target) {
  const employee = target?.employeeId, application = target?.applicationId;
  if (Boolean(employee) === Boolean(application) || !uuid.test(employee || application)) invalid();
  return `/api/${application ? 'employmentapplications' : 'employees'}/${application || employee}/screening`;
}
function matchesTarget(result, target) {
  const key = target.applicationId ? 'applicationId' : 'employeeId';
  return result?.ok === true && typeof result[key] === 'string' && result[key].toLowerCase() === target[key].toLowerCase();
}

// Supply a delegated HR/Admin token in memory. Do not save it in receipts or a
// provider browser. This client does not acquire permissions or persist secrets.
export function createEvidenceClient({ apiBaseUrl, getAccessToken, fetchImpl = fetch }) {
  const base = new URL(apiBaseUrl);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)))
    || base.username || base.password || base.search || base.hash || base.pathname !== '/' || typeof getAccessToken !== 'function') invalid();
  async function request(path, body) {
    try {
      const token = await getAccessToken();
      if (typeof token !== 'string' || !token) throw Error('authorization_unavailable');
      const response = await fetchImpl(new URL(path, base), { method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error('evidence_service_unavailable');
      return await response.json();
    } catch { throw Error(body ? 'upload_unconfirmed' : 'evidence_service_unavailable'); }
  }
  return {
    async inspect(target) {
      const data = await request(targetPath(target));
      if (!matchesTarget(data, target)) throw Error('target_mismatch');
      return data;
    },
    async upload(target, payload) {
      const data = await request(targetPath(target), payload);
      if (!matchesTarget(data, target) || !uuid.test(data.document?.documentId ?? '')) throw Error('upload_unconfirmed');
      return { documentId: data.document.documentId, alreadySaved: data.alreadySaved === true };
    },
  };
}

export function prepareEvidence(target, bundle, checkDate = null) {
  targetPath(target);
  if (!bundle || bundle.status !== 'captured' || !uuid.test(bundle.manifest?.captureId ?? '') || bundle.manifest?.provider !== 'fowler'
    || !Number.isInteger(bundle.manifest.componentsExpected) || bundle.manifest.componentsExpected < 1 || bundle.manifest.componentsExpected > 20
    || bundle.manifest.failures?.length !== 0 || !Array.isArray(bundle.artifacts) || !Array.isArray(bundle.manifest.artifacts)
    || bundle.artifacts.length !== bundle.manifest.componentsExpected + 1 || bundle.manifest.artifacts.length !== bundle.artifacts.length) invalid();
  if (checkDate !== null && (typeof checkDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(checkDate)
    || !Number.isFinite(Date.parse(checkDate)) || new Date(checkDate).toISOString().slice(0, 10) !== checkDate)) invalid();
  const names = new Set(); let size = 0;
  const payloads = bundle.artifacts.map(artifact => {
    const matches = bundle.manifest.artifacts.filter(entry => entry.filename === artifact.filename);
    if (matches.length !== 1 || names.has(artifact.filename)) invalid();
    names.add(artifact.filename);
    const record = matches[0], bytes = artifact.bytes;
    if (!Buffer.isBuffer(bytes) || bytes.length < 5 || bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-'
      || record.byteLength !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== record.sha256) invalid();
    size += bytes.length;
    const part = artifact.filename === 'summary.pdf' ? 'summary' : 'component';
    const match = /^component-(\d{2})\.pdf$/.exec(artifact.filename);
    const componentIndex = part === 'summary' ? 0 : match ? Number(match[1]) : -1;
    if (record.kind !== part || componentIndex < 0 || componentIndex > bundle.manifest.componentsExpected
      || part === 'component' && componentIndex === 0) invalid();
    // Keep URLs, raw provider IDs and person identifiers out of document metadata.
    return { source: 'fowler', checkDate, captureId: bundle.manifest.captureId, captureMethod: 'browser_pdf', part, componentIndex,
      ...(record.componentType ? { componentType: record.componentType } : {}),
      expectedParts: bundle.artifacts.length, contentBase64: bytes.toString('base64') };
  });
  if (size > 32 * 1024 * 1024 || !names.has('summary.pdf') || new Set(payloads.map(p => p.componentIndex)).size !== payloads.length) invalid();
  return payloads;
}

export async function saveCapturedEvidence(client, target, bundle, { checkDate = null } = {}) {
  const payloads = prepareEvidence(target, bundle, checkDate);
  await client.inspect(target); // Confirm exact CareOps scope before any upload.
  const uploads = [];
  for (const payload of payloads) {
    try { uploads.push({ part: payload.part, componentIndex: payload.componentIndex, ...await client.upload(target, payload) }); }
    catch { return { status: 'upload_unconfirmed', captureId: bundle.manifest.captureId, expectedFiles: payloads.length, uploads, retrySameCapture: true }; }
  }
  return { status: 'saved_for_scanning', captureId: bundle.manifest.captureId, expectedFiles: payloads.length, uploads, reviewStatus: 'unreviewed' };
}

export async function retrieveEvidenceToCareOps({ context, client, target, selectedReportUrl, selectionConfirmed = false, checkDate = null }) {
  targetPath(target);
  await client.inspect(target);
  const bundle = await captureReportBundle(context, { selectedReportUrl, selectionConfirmed });
  if (bundle.status !== 'captured') return { status: bundle.status, bundle, receipt: null };
  const receipt = await saveCapturedEvidence(client, target, bundle, { checkDate });
  // Retain bundle privately for retry with the same captureId after an uncertain upload.
  return { status: receipt.status, bundle, receipt };
}

// The future candidate picker supplies a result key, not a name or row index.
// Choosing a provider report remains separate from confirming its CareOps owner.
export async function retrieveSelectedEvidenceToCareOps({ search, candidateKey, context, client, target, checkDate = null }) {
  const selected = selectApplicantReport(search, candidateKey);
  return retrieveEvidenceToCareOps({ context, client, target, checkDate, ...selected });
}
