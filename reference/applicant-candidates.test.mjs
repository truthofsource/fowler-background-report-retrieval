import test from 'node:test';
import assert from 'node:assert/strict';
import { origin, presentApplicantCandidates, selectApplicantReport } from './report-retrieval.mjs';
const candidate = (id, name, report = id) => ({ providerReference: id, applicantName: name,
  providerStatus: 'Released', providerDates: { received: '09/25/2026', released: '09/26/2026' },
  reportUrl: `${origin}/4DACTION/WebAppTextReport/${report}` });

test('same surname retains full displayed names and every distinct provider result', () => {
  const rows = presentApplicantCandidates([candidate('example-1', 'Example, Alex'), candidate('example-2', 'Example, Jordan')]);
  assert.equal(rows.length, 2);
  assert.match(rows[0].displayLabel, /Example, Alex.*Applicant ID example-1.*Released.*Received 09\/25\/2026/);
  assert.match(rows[1].displayLabel, /Example, Jordan.*Applicant ID example-2/);
  assert.ok(rows.every(row => !row.sameNameOnPage));
  assert.notEqual(rows[0].candidateKey, rows[1].candidateKey);
});

test('identical first and last names remain separate, with an ambiguity indicator', () => {
  const rows = presentApplicantCandidates([candidate('example-1', 'Example, Alex'), candidate('example-2', 'Example, Alex')]);
  assert.equal(rows.length, 2); assert.ok(rows.every(row => row.sameNameOnPage));
  const chosen = selectApplicantReport({ status: 'candidates_found', candidates: rows }, rows[1].candidateKey);
  assert.equal(chosen.selectedReportUrl, rows[1].reportUrl);
  assert.throws(() => selectApplicantReport({ status: 'candidates_found', candidates: rows }, 'Example, Alex'), /selection_required/);
});

test('multiple reports for one applicant remain separate and selection survives reordered rows', () => {
  const rows = presentApplicantCandidates([candidate('example-1', 'Example, Alex', 'older'), candidate('example-1', 'Example, Alex', 'newer')]);
  assert.notEqual(rows[0].candidateKey, rows[1].candidateKey);
  assert.equal(selectApplicantReport({ status: 'candidates_found', candidates: [...rows].reverse() }, rows[0].candidateKey).selectedReportUrl, rows[0].reportUrl);
  assert.throws(() => selectApplicantReport({ status: 'candidates_found', candidates: [rows[1]] }, rows[0].candidateKey));
  assert.throws(() => selectApplicantReport({ status: 'candidates_found', candidates: [rows[0], rows[0]] }, rows[0].candidateKey));
});

test('name formatting is preserved and missing identity or unrelated report URLs are rejected', () => {
  const rows = presentApplicantCandidates([candidate('example-1', 'Example-Smith, Alex Morgan'), candidate('example-2', ' EXAMPLE-SMITH,  ALEX MORGAN ')]);
  assert.equal(rows[0].applicantName, 'Example-Smith, Alex Morgan');
  assert.ok(rows.every(row => row.sameNameOnPage));
  assert.throws(() => presentApplicantCandidates([candidate('', 'Example, Alex')]));
  assert.throws(() => presentApplicantCandidates([{ ...rows[0], reportUrl: 'https://example.invalid/report' }]));
});

test('submitted applicant without a report stays in the list but cannot be captured', () => {
  const rows = presentApplicantCandidates([{ ...candidate('example-1', 'Example, Alex'), providerStatus: 'Submitted', reportUrl: null }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].reportAvailable, false); assert.match(rows[0].displayLabel, /Submitted/);
  assert.throws(() => selectApplicantReport({ status: 'candidates_found', candidates: rows }, rows[0].candidateKey), /report_not_ready/);
});
