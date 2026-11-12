import { createHash, randomUUID } from 'node:crypto';
import { origin, applicantListUrl } from './provider-target.mjs';
export { origin, applicantListUrl } from './provider-target.mjs';

// Receives an already-authenticated Playwright context. No credentials, logger,
// scheduler, provider-order operation or CareOps upload is owned by this module.
const routes = {
  summary: '/4DACTION/WebAppTextReport',
  component: '/4DACTION/WebAppLinkReport',
};
const knownFailures = new Set([
  'invalid_search', 'invalid_report_url', 'selection_required', 'form_changed',
  'sign_in_required', 'source_unavailable', 'unexpected_content',
  'incomplete_render', 'invalid_pdf', 'capture_limit', 'report_changed',
  'sensitive_access_required', 'stage2_ssn_unavailable', 'target_changed', 'sensitive_result_blocked',
  'report_not_ready',
]);
const fail = code => { throw new Error(code); };
const failureCode = error => knownFailures.has(error?.message) ? error.message : 'source_unavailable';

export function reportUrl(value, kind) {
  try {
    const url = new URL(value);
    const route = routes[kind];
    if (!route || url.origin !== origin || url.username || url.password || url.hash || url.search
      || !url.pathname.startsWith(`${route}/`) || url.pathname.length <= route.length + 1) {
      fail('invalid_report_url');
    }
    return url.href;
  } catch { fail('invalid_report_url'); }
}

export function searchCriteria({ lastName, ssn } = {}) {
  let name = typeof lastName === 'string' ? lastName.normalize('NFC').trim() : '';
  // Pasted surrounding double quotes are formatting, not part of a surname.
  // Preserve apostrophes, hyphens and accents; never turn discovery into identity matching.
  if ((name.startsWith('"') && name.endsWith('"'))
    || (name.startsWith('“') && name.endsWith('”'))) name = name.slice(1, -1).trim();
  name = name.replace(/\s+/gu, ' ');
  const identifier = typeof ssn === 'string' ? ssn.trim() : '';
  if (Boolean(name) === Boolean(identifier)) fail('invalid_search');
  if (name && (name.length > 100 || /[\x00-\x1f\x7f"“”\u200b-\u200f\u202a-\u202e\u2066-\u2069]/u.test(name))) fail('invalid_search');
  if (identifier && !/^(?:\d{9}|\d{3}-\d{2}-\d{4})$/.test(identifier)) fail('invalid_search');
  return { name, ssn: identifier };
}

// Keep the provider's complete displayed name. Do not deduplicate by surname,
// full name, row order or applicant ID (one applicant can have several reports).
export function presentApplicantCandidates(candidates) {
  const names = new Map();
  const nameKey = value => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const rows = candidates.map(candidate => {
    if (typeof candidate.applicantName !== 'string' || !candidate.applicantName.trim()
      || typeof candidate.providerReference !== 'string' || !candidate.providerReference.trim()) fail('form_changed');
    const url = candidate.reportUrl == null ? null : reportUrl(candidate.reportUrl, 'summary');
    const key = nameKey(candidate.applicantName);
    names.set(key, (names.get(key) ?? 0) + 1);
    return { ...candidate, reportUrl: url, reportAvailable: url !== null,
      candidateKey: createHash('sha256').update(JSON.stringify([candidate.providerReference, url])).digest('hex'),
      displayLabel: `${candidate.applicantName} | Applicant ID ${candidate.providerReference} | ${candidate.providerStatus || 'Status not recorded'} | Received ${candidate.providerDates?.received || 'not recorded'} | Released ${candidate.providerDates?.released || 'not recorded'}` };
  });
  return rows.map(row => ({ ...row, sameNameOnPage: names.get(nameKey(row.applicantName)) > 1 }));
}

// Select one current result by its exact key, never by a name or numeric index.
// This chooses a provider report for inspection; it does not verify a CareOps link.
export function selectApplicantReport(search, candidateKey) {
  if (search?.status !== 'candidates_found' || !Array.isArray(search.candidates)
    || typeof candidateKey !== 'string' || !/^[a-f0-9]{64}$/.test(candidateKey)) fail('selection_required');
  const matches = presentApplicantCandidates(search.candidates).filter(c => c.candidateKey === candidateKey);
  if (matches.length !== 1) fail('selection_required');
  if (!matches[0].reportAvailable) fail('report_not_ready');
  return { selectedReportUrl: matches[0].reportUrl, selectionConfirmed: true };
}

async function boundedPage(context, allowedPaths) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  // Restrict this page, leaving the caller's interactive session untouched.
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const document = request.isNavigationRequest();
    const allowed = url.origin === origin && (document
      ? allowedPaths.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))
        && (request.method() === 'GET' || request.method() === 'POST'
          && url.pathname === '/4DACTION/WebShowEMApps')
      : request.method() === 'GET');
    if (allowed) await route.fallback();
    else await route.abort('blockedbyclient');
  });
  return page;
}

function verifyResponse(response, contentType = 'text/html') {
  if (response?.status() === 401 || response?.status() === 403) fail('sign_in_required');
  if (!response?.ok()) fail('source_unavailable');
  if (!response.headers()['content-type']?.toLowerCase().includes(contentType)) fail('unexpected_content');
}

// Candidate values and URLs are private business data, not log/telemetry output.
// No first-match auto-selection and no automatic follow-up SSN lookup.
export async function searchApplicants(context, criteria) {
  return runApplicantSearch(context, () => searchCriteria(criteria));
}

// Explicit SSN mode only. The protected loader is called after the provider form
// is verified, so an expired provider session never unnecessarily reveals an SSN.
export async function searchApplicantsWithProtectedSsn(context, loadSsn) {
  return runApplicantSearch(context, async () => {
    if (typeof loadSsn !== 'function') fail('stage2_ssn_unavailable');
    return searchCriteria({ ssn: await loadSsn() });
  });
}

async function runApplicantSearch(context, loadCriteria) {
  let page;
  let query;
  let stage = 'criteria';
  try {
    page = await boundedPage(context, ['/4DACTION/WebShowEMApps']);
    verifyResponse(await page.goto(applicantListUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }));
    stage = 'search_form';
    const form = page.locator('form').filter({ has: page.locator('[name="WEBFtSearchRAApplicantName"]') });
    if (await form.count() !== 1) fail('form_changed');
    const action = new URL(await form.getAttribute('action') || page.url(), page.url());
    if (action.href !== applicantListUrl || (await form.getAttribute('method'))?.toLowerCase() !== 'post') fail('form_changed');
    const fields = ['ApplicantID', 'ApplicantName', 'SubmittedFrom', 'SubmittedTo',
      'ReceivedFrom', 'ReceivedTo', 'Department', 'ReleasedFrom', 'ReleasedTo', 'Recruiter', 'SSN'];
    // Validate every required control before loading a protected value.
    for (const name of fields) if (await form.locator(`[name="WEBFtSearchRA${name}"]`).count() !== 1) fail('form_changed');
    for (const name of ['WEBFtSearchRAStatus', 'WEBFtSearchMeetsReq', 'WEBFtPageView']) {
      if (await form.locator(`[name="${name}"]`).count() !== 1) fail('form_changed');
    }
    for (const name of fields) {
      stage = 'search_fields';
      const control = form.locator(`[name="WEBFtSearchRA${name}"]`);
      if (await control.count() !== 1) fail('form_changed');
      await control.fill('');
    }
    await form.locator('[name="WEBFtSearchRAStatus"]').selectOption({ label: '' });
    await form.locator('[name="WEBFtSearchMeetsReq"]').selectOption({ label: '' });
    await form.locator('[name="WEBFtPageView"]').selectOption({ label: 'Standard View' });
    stage = 'criteria';
    query = await loadCriteria();
    await form.locator(query.ssn ? '[name="WEBFtSearchRASSN"]' : '[name="WEBFtSearchRAApplicantName"]').fill(query.ssn || query.name);
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
      form.locator('input[type="submit"][name="OK"]').click(),
    ]);
    verifyResponse(response);
    stage = 'result_page';
    const observed = await page.evaluate(() => {
      const headings = row => [...row.cells].map(c => c.textContent.trim().replace(/\s+/g, ' '));
      // Processing applicants may have no report link. Read the result table,
      // rather than treating report anchors as the list of applicants.
      const tables = [...document.querySelectorAll('table')].filter(table => [...table.rows]
        .some(row => headings(row).includes('Applicant ID') && headings(row).includes('Applicant Name')));
      const rows = tables.flatMap(table => {
        const header = [...table.rows].find(row => headings(row).includes('Applicant ID') && headings(row).includes('Applicant Name'));
        return [...table.rows].filter(row => row !== header && row.closest('table') === table && row.cells.length === header.cells.length);
      });
      return {
        searchFormPresent: Boolean(document.querySelector('[name="WEBFtSearchRAApplicantName"]')),
        noMatchesExplicit: /no (?:applicants|records|results|matches)(?: were)? found|0 (?:applicants|records|results)\b/i.test(document.body.innerText),
        candidates: rows.map(row => ({
          cells: [...row.cells].map(c => c.textContent.trim()),
          headers: [...row.closest('table').rows]
            .map(r => [...r.cells].map(c => c.textContent.trim().replace(/\s+/g, ' ')))
            .find(cells => cells.includes('Applicant ID') && cells.includes('Applicant Name')) || [],
          urls: [...new Set([...row.querySelectorAll('a[href*="/4DACTION/WebAppTextReport/"]')].map(a => a.href))],
        })),
        // Preserve uncertainty about list paging rather than claiming a complete directory.
        pagingVisible: [...document.querySelectorAll('a,button,input[type="submit"]')]
          .some(e => /\b(next|previous|more results)\b/i.test(e.textContent || e.value || '')),
      };
    });
    if (!observed.searchFormPresent) fail('form_changed');
    stage = 'candidate_rows';
    const candidates = observed.candidates.map(row => {
      const required = ['Applicant ID', 'Applicant Name', 'Status', 'Date Entered', 'Date Submitted', 'Date Received'];
      if (row.headers.length !== row.cells.length || row.urls.length > 1
        || required.some(label => row.headers.filter(h => h === label).length !== 1)) fail('form_changed');
      const value = label => row.cells[row.headers.indexOf(label)] ?? null;
      const [providerReference, applicantName, providerStatus, entered, submitted, received] = required.map(value);
      return { providerReference, applicantName, providerStatus,
        providerDates: { entered, submitted, received, released: value('Date Released'), modified: value('Date Modified') },
        reportUrl: row.urls.length ? reportUrl(row.urls[0], 'summary') : null };
    });
    if (query.ssn) {
      const digits = query.ssn.replaceAll('-', '');
      const formatted = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
      let serialized = JSON.stringify(candidates);
      try { serialized = decodeURIComponent(serialized); } catch { /* Check literal output too. */ }
      if (serialized.includes(digits) || serialized.includes(formatted)) fail('sensitive_result_blocked');
    }
    return { status: candidates.length ? 'candidates_found' : observed.noMatchesExplicit ? 'no_matches_on_page' : 'results_unverified',
      candidates: presentApplicantCandidates(candidates), pagingVisible: observed.pagingVisible, selectionRequired: true };
  } catch (error) { return { status: failureCode(error), stage, candidates: [], selectionRequired: true }; }
  finally { if (query) query.ssn = ''; await page?.close().catch(() => {}); }
}

// Only known categories enter filenames, never raw provider text or personal details.
export function componentTypeFromLabel(label) {
  const text = String(label ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const labels = {
    'ssn-trace': /^(?:ssn|social security(?: number)?)(?: trace| search| trace report| trace search)$/,
    'criminal-history': /^(?:criminal history|criminal background|criminal records?)(?: check| search| report)?$/,
    'county-criminal-search': /^county criminal(?: records?)?(?: check| search| report)?$/,
    'national-criminal-search': /^(?:national|nationwide) criminal(?: records?)?(?: check| search| report)?$/,
    'national-sex-offender-search': /^(?:national|nationwide) sex[- ]offender(?: registry)?(?: check| search| report)?$/,
    'sex-offender-search': /^sex[- ]offender(?: registry)?(?: check| search| report)?$/,
    'tennessee-foil': /^(?:tennessee )?(?:foil|felony offender(?: information)? lookup)(?: report| search)?$/,
    'abuse-registry': /^(?:tennessee )?abuse registry(?: check| search| report)?$/,
    'oig-exclusions': /^oig(?: exclusions?)?(?: check| search| report)?$/,
    'sam-exclusions': /^sam(?:\.gov)?(?: exclusions?)?(?: check| search| report)?$/,
    'motor-vehicle-record': /^(?:mvr|motor vehicle record)(?: check| search| report)?$/,
  };
  return Object.entries(labels).find(([, pattern]) => pattern.test(text))?.[0];
}

async function renderPdf(page, url, kind) {
  const expected = reportUrl(url, kind);
  verifyResponse(await page.goto(expected, { waitUntil: 'load', timeout: 20000 }));
  if (page.url() !== expected) fail('report_changed');
  const text = await page.locator('body').innerText();
  if (!text.trim() || !/Fowler|Profile\s+Links/i.test(text)
    || kind === 'summary' && !/Summary/i.test(text)) fail('unexpected_content');
  await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 20000 });
  const imagesReady = await page.locator('img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0));
  if (!imagesReady) fail('incomplete_render');
  const bytes = await page.pdf({ format: 'Letter', printBackground: true, displayHeaderFooter: false,
    margin: { top: '0.4in', bottom: '0.4in', left: '0.35in', right: '0.35in' } });
  if (bytes.length < 500 || bytes.subarray(0, 5).toString() !== '%PDF-') fail('invalid_pdf');
  return bytes;
}

// The caller must supply the exact report chosen in candidate review. Results
// stay in memory until a caller supplies a protected destination. No disk writes.
export async function captureReportBundle(context, { selectedReportUrl, selectionConfirmed = false } = {}) {
  let page;
  const artifacts = [];
  const manifest = { version: 1, captureId: randomUUID(), provider: 'fowler',
    capturedAtUtc: new Date().toISOString(), format: 'browser_rendered_pdf',
    reviewStatus: 'unreviewed', storageStatus: 'not_uploaded', sourceResult: 'not_interpreted',
    componentsExpected: 0, artifacts: [], failures: [] };
  let totalBytes = 0;
  const add = (bytes, sourceUrl, kind, index, componentType) => {
    if (bytes.length > 10 * 1024 * 1024 || totalBytes + bytes.length > 32 * 1024 * 1024) fail('capture_limit');
    const filename = kind === 'summary' ? 'summary.pdf' : `component-${String(index).padStart(2, '0')}.pdf`;
    totalBytes += bytes.length;
    artifacts.push({ filename, bytes });
    // sourceUrl can contain identifiers; this entire manifest requires protected storage.
    manifest.artifacts.push({ filename, kind, sourceUrl, ...(componentType ? { componentType } : {}), byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') });
  };
  try {
    if (selectionConfirmed !== true) fail('selection_required');
    const url = reportUrl(selectedReportUrl, 'summary');
    page = await boundedPage(context, Object.values(routes));
    add(await renderPdf(page, url, 'summary'), url, 'summary', 0);
    const links = await page.locator('a[href*="WebAppLinkReport"]').evaluateAll(anchors => [...new Set(anchors.map(a => a.href))].map(href => ({ href, labels: anchors.filter(a => a.href === href).map(a => a.textContent) })));
    manifest.componentsExpected = links.length;
    if (links.length > 20) fail('capture_limit');
    if (!links.length) fail('report_changed');
    for (const [index, link] of links.entries()) {
      try {
        const component = reportUrl(link.href, 'component');
        const bytes = await renderPdf(page, component, 'component');
        const headings = await page.locator('h1,h2,h3,caption').allTextContents();
        const types = [...new Set([...link.labels, ...headings].map(componentTypeFromLabel).filter(Boolean))];
        add(bytes, component, 'component', index + 1, types.length === 1 ? types[0] : undefined);
      } catch (error) {
        const code = failureCode(error);
        manifest.failures.push({ component: index + 1, code });
        // Do not repeatedly retry credentials, an outage or an unexpected response.
        if (['sign_in_required', 'source_unavailable', 'capture_limit'].includes(code)) break;
      }
    }
    const captured = manifest.artifacts.filter(a => a.kind === 'component').length;
    return { status: captured === links.length && !manifest.failures.length ? 'captured' : 'partial', manifest, artifacts };
  } catch (error) {
    const code = failureCode(error);
    manifest.failures.push({ component: 'summary', code });
    return { status: artifacts.length ? 'partial' : code, manifest, artifacts };
  } finally { await page?.close().catch(() => {}); }
}
