// Generated from the adjacent source/ TypeScript extraction; syntax-transpiled, not a full application typecheck.
import { fowlerComponentTypes } from './boundaries.mjs';
import { createHash } from 'node:crypto';
import { EmployeeProfileError } from './boundaries.mjs';
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const hashPattern = /^[a-f0-9]{64}$/;
function error(code) { throw new EmployeeProfileError(409, code, 'Refresh this retrieval and review its current status before continuing.'); }
function validId(value) { return typeof value === 'string' && idPattern.test(value); }
function text(value, maximum, nullable = false) {
    if (nullable && value === null)
        return null;
    if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f]/.test(value))
        error('invalid_provider_result');
    return value.trim();
}
function exact(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k)))
        error('invalid_retrieval');
    return value;
}
export function sameScope(a, b) {
    return (a.employeeId?.toLowerCase() ?? null) === (b.employeeId?.toLowerCase() ?? null)
        && (a.applicationId?.toLowerCase() ?? null) === (b.applicationId?.toLowerCase() ?? null);
}
export function providerCandidates(input) {
    if (!Array.isArray(input) || input.length > 100)
        error('invalid_provider_result');
    const rows = input.map(value => {
        const item = exact(value, ['name', 'reference', 'status', 'received', 'released', 'reportUrl']);
        const name = text(item.name, 200), reference = text(item.reference, 100);
        let reportUrl = null;
        if (item.reportUrl !== null) {
            try {
                const url = new URL(text(item.reportUrl, 2048));
                if (url.origin !== 'https://reports.example.invalid' || url.username || url.password || url.hash || url.search
                    || !/^\/4DACTION\/WebAppTextReport\/[^\s]+$/.test(url.pathname))
                    error('invalid_report_url');
                reportUrl = url.href;
            }
            catch {
                error('invalid_report_url');
            }
        }
        return { key: createHash('sha256').update(JSON.stringify([reference, reportUrl])).digest('hex'),
            name, reference, reportUrl, status: text(item.status, 100, true),
            received: text(item.received, 100, true), released: text(item.released, 100, true), sameName: false };
    });
    // Duplicate identities/URLs cannot be selected unambiguously; do not silently collapse them.
    if (new Set(rows.map(row => row.key)).size !== rows.length)
        error('duplicate_provider_result');
    const nameKey = (name) => name.normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
    return rows.map(row => ({ ...row, sameName: rows.filter(other => nameKey(other.name) === nameKey(row.name)).length > 1 }));
}
export function captureManifest(input, now) {
    const value = exact(input, ['id', 'capturedAt', 'parts']);
    if (!validId(value.id) || typeof value.capturedAt !== 'string' || !Number.isFinite(Date.parse(value.capturedAt))
        || Date.parse(value.capturedAt) > now.getTime() || !Array.isArray(value.parts) || value.parts.length < 2 || value.parts.length > 21)
        error('invalid_capture');
    const parts = value.parts.map((part, index) => {
        const p = exact(part, ['index', 'sha256', 'byteLength', 'componentType']);
        if (p.index !== index || typeof p.sha256 !== 'string' || !hashPattern.test(p.sha256)
            || !Number.isInteger(p.byteLength) || Number(p.byteLength) < 5 || Number(p.byteLength) > 10 * 1024 * 1024)
            error('invalid_capture');
        if (p.componentType !== undefined && (index === 0 || !fowlerComponentTypes.includes(p.componentType)))
            error('invalid_capture');
        return { ...(p.componentType ? { componentType: p.componentType } : {}), index, sha256: p.sha256, byteLength: Number(p.byteLength) };
    });
    if (parts.reduce((sum, part) => sum + part.byteLength, 0) > 32 * 1024 * 1024)
        error('invalid_capture');
    return { id: value.id, capturedAt: new Date(value.capturedAt).toISOString(), parts };
}
// A storage adapter derives this path; callers cannot choose a container, host or arbitrary key.
export function stagingKey(jobId, captureId, index) {
    if (!validId(jobId) || !validId(captureId) || !Number.isInteger(index) || index < 0 || index > 20)
        error('invalid_capture');
    return `fowler-retrieval/${jobId.toLowerCase()}/${captureId.toLowerCase()}/${index}.pdf`;
}
export function createRetrieval(input, now) {
    if (![input.id, input.revision, input.target.id, input.requestedBy, input.connectionRevision].every(validId)
        || !['employee', 'application'].includes(input.target.kind) || !/^[a-f0-9]{32}$/i.test(input.credentialVersion))
        error('invalid_retrieval');
    if ((input.scope.employeeId !== null && !validId(input.scope.employeeId))
        || (input.scope.applicationId !== null && !validId(input.scope.applicationId))
        || input.target.id.toLowerCase() !== (input.target.kind === 'employee' ? input.scope.employeeId : input.scope.applicationId)?.toLowerCase())
        error('target_changed');
    const lastName = text(input.lastName, 100);
    // Hosted lookup initially supports names only. Protected SSN reveal is a separate delegated workflow.
    if (/\d/.test(lastName))
        error('invalid_search');
    return { id: input.id.toLowerCase(), revision: input.revision.toLowerCase(), target: { ...input.target },
        scope: { ...input.scope }, requestedBy: input.requestedBy, connectionRevision: input.connectionRevision,
        credentialVersion: input.credentialVersion, lastName, createdAt: now.toISOString(), updatedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 86400000).toISOString(), queuedAt: now.toISOString(), state: 'lookup_queued',
        lease: null, candidates: [], pagingVisible: false, selectedKey: null, capture: null, checkDate: null,
        saveStarted: false, receipts: [], failure: null };
}
export function effectiveState(job, now) {
    if (['cancelled', 'saved_for_scanning', 'expired'].includes(job.state))
        return job.state;
    if (Date.parse(job.expiresAt) <= now.getTime())
        return 'expired';
    if (job.lease && Date.parse(job.lease.until) <= now.getTime())
        return job.state === 'saving' ? 'save_unconfirmed' : 'failed';
    if (job.state === 'ready_to_save' && job.saveStarted && Date.parse(job.queuedAt) + 300000 <= now.getTime())
        return 'save_unconfirmed';
    if (['lookup_queued', 'capture_queued'].includes(job.state) && Date.parse(job.queuedAt) + 300000 <= now.getTime())
        return 'failed';
    return job.state;
}
export function nextRetrieval(job, event, actor, revision, now, context) {
    const fields = {
        claim: ['action'], lookup_complete: ['action', 'lease', 'candidates', 'pagingVisible'],
        select: ['action', 'key'], capture_start: ['action', 'lease', 'capture'], capture_complete: ['action', 'lease', 'capture'],
        save: ['action', 'checkDate'], part_saved: ['action', 'lease', 'index', 'sha256', 'documentId'],
        save_complete: ['action', 'lease'], fail: ['action', 'lease', 'reason'], retry: ['action'], cancel: ['action'],
    };
    if (!event || !Object.hasOwn(fields, event.action))
        error('invalid_event');
    exact(event, fields[event.action]);
    if (!validId(revision) || !validId(actor.id) || !validId(context.workerId) || !['staff', 'worker'].includes(actor.kind))
        error('invalid_actor');
    if (!sameScope(job.scope, context.scope))
        error('target_changed');
    if (actor.kind === 'worker' && actor.id.toLowerCase() !== context.workerId.toLowerCase())
        error('worker_denied');
    const staff = ['select', 'save', 'retry', 'cancel'].includes(event.action);
    if ((actor.kind === 'staff') !== staff)
        error('action_denied');
    const next = structuredClone(job), state = effectiveState(job, now);
    if (['saved_for_scanning', 'cancelled', 'expired'].includes(state))
        error('retrieval_closed');
    if (event.action !== 'cancel' && context.connectionRevision !== job.connectionRevision)
        error('connection_changed');
    next.revision = revision;
    next.updatedAt = now.toISOString();
    next.state = state;
    if (event.action === 'cancel') {
        next.state = 'cancelled';
        next.lease = null;
        return next;
    }
    if (event.action === 'claim') {
        if (!['lookup_queued', 'capture_queued', 'ready_to_save'].includes(state)
            || state === 'ready_to_save' && !job.saveStarted)
            error('not_queued');
        next.state = state === 'lookup_queued' ? 'looking_up' : state === 'capture_queued' ? 'capturing' : 'saving';
        next.lease = { token: revision, worker: actor.id, until: new Date(now.getTime() + 300000).toISOString() };
        return next;
    }
    if (actor.kind === 'worker' && ('lease' in event)) {
        if (!job.lease || event.lease !== job.lease.token || actor.id !== job.lease.worker
            || Date.parse(job.lease.until) <= now.getTime())
            error('lease_expired');
    }
    if (event.action === 'lookup_complete') {
        if (state !== 'looking_up' || typeof event.pagingVisible !== 'boolean')
            error('unexpected_result');
        next.candidates = providerCandidates(event.candidates);
        next.pagingVisible = event.pagingVisible;
        next.state = next.candidates.length ? 'choose_report' : 'no_matches_on_page';
        next.lease = null;
        next.failure = null;
    }
    else if (event.action === 'select') {
        if (state !== 'choose_report')
            error('selection_required');
        const selected = job.candidates.find(row => row.key === event.key);
        if (!selected || !selected.reportUrl)
            error('report_not_ready');
        next.selectedKey = selected.key;
        next.state = 'capture_queued';
        next.queuedAt = now.toISOString();
    }
    else if (event.action === 'capture_start') {
        if (state !== 'capturing' || !job.selectedKey || job.capture)
            error('selection_required');
        next.capture = captureManifest(event.capture, now);
        if (Date.parse(next.capture.capturedAt) < Date.parse(job.createdAt))
            error('invalid_capture');
    }
    else if (event.action === 'capture_complete') {
        if (state !== 'capturing' || !job.selectedKey)
            error('selection_required');
        next.capture = captureManifest(event.capture, now);
        if (job.capture && JSON.stringify(job.capture) !== JSON.stringify(next.capture))
            error('capture_changed');
        if (Date.parse(next.capture.capturedAt) < Date.parse(job.createdAt))
            error('invalid_capture');
        next.state = 'ready_to_save';
        next.lease = null;
    }
    else if (event.action === 'save') {
        if (!['ready_to_save', 'save_unconfirmed'].includes(state) || !job.capture)
            error('capture_required');
        if (event.checkDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(event.checkDate)
            || !Number.isFinite(Date.parse(event.checkDate)) || new Date(event.checkDate).toISOString().slice(0, 10) !== event.checkDate))
            error('invalid_check_date');
        if (job.saveStarted && event.checkDate !== job.checkDate)
            error('retry_same_capture');
        next.checkDate = event.checkDate;
        next.saveStarted = true;
        next.state = 'ready_to_save';
        next.lease = null;
        next.queuedAt = now.toISOString();
    }
    else if (event.action === 'part_saved') {
        const part = job.capture?.parts.find(part => part.index === event.index);
        if (state !== 'saving' || !part || part.sha256 !== event.sha256 || !validId(event.documentId))
            error('invalid_receipt');
        const prior = job.receipts.find(receipt => receipt.index === event.index);
        if (prior && prior.documentId !== event.documentId)
            error('receipt_conflict');
        if (job.receipts.some(receipt => receipt.index !== event.index && receipt.documentId === event.documentId))
            error('receipt_conflict');
        if (!prior)
            next.receipts.push({ index: event.index, documentId: event.documentId });
    }
    else if (event.action === 'save_complete') {
        if (state !== 'saving' || !job.capture || job.receipts.length !== job.capture.parts.length)
            error('missing_receipts');
        next.state = 'saved_for_scanning';
        next.lease = null;
    }
    else if (event.action === 'fail') {
        if (!['looking_up', 'capturing', 'saving'].includes(state)
            || !['sign_in_required', 'form_changed', 'source_unavailable', 'capture_changed', 'upload_unconfirmed'].includes(event.reason))
            error('invalid_failure');
        next.state = state === 'saving' ? 'save_unconfirmed' : 'failed';
        next.failure = event.reason;
        next.lease = null;
    }
    else if (event.action === 'retry') {
        if (!['failed', 'no_matches_on_page'].includes(state) || job.saveStarted || job.failure === 'sign_in_required')
            error('retry_not_available');
        next.state = job.selectedKey ? 'capture_queued' : 'lookup_queued';
        next.queuedAt = now.toISOString();
        next.lease = null;
        next.failure = null;
        next.capture = null; // Unfinished capture is abandoned; a new capture must have a new immutable ID.
    }
    return next;
}
export function retrievalView(job, now = new Date()) {
    return structuredClone({ id: job.id, revision: job.revision, target: job.target, state: effectiveState(job, now),
        createdAt: job.createdAt, expiresAt: job.expiresAt, pagingVisible: job.pagingVisible,
        candidates: job.candidates.map(({ reportUrl, ...candidate }) => ({ ...candidate, reportAvailable: reportUrl !== null })),
        selectedKey: job.selectedKey, capture: job.capture ? { id: job.capture.id, capturedAt: job.capture.capturedAt,
            parts: job.capture.parts.map(part => ({ index: part.index, byteLength: part.byteLength })) } : null,
        checkDate: job.checkDate, saveRequested: job.saveStarted, receipts: job.receipts, failure: job.failure });
}
