import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportUrl,origin} from '../reference/report-retrieval.mjs';
import {providerCandidates} from '../reference/fowlerRetrieval.mjs';
import {createEvidenceClient} from '../reference/careops-evidence.mjs';

test('both candidate paths reject query-string report URLs before selection',()=>{
  const report=`${origin}/4DACTION/WebAppTextReport/demo?ssn=fictional`;
  assert.throws(()=>reportUrl(report,'summary'),/^Error: invalid_report_url$/);
  assert.throws(()=>providerCandidates([{name:'Alex Example',reference:'demo',status:'Released',received:null,released:null,reportUrl:report}]));
});
test('report URLs reject credential, fragment and wrong-host overrides',()=>{
  for(const url of [`${origin}/4DACTION/WebAppTextReport/demo#fragment`,'https://user:secret@reports.example.invalid/4DACTION/WebAppTextReport/demo','https://other.invalid/4DACTION/WebAppTextReport/demo'])
    assert.throws(()=>reportUrl(url,'summary'),/^Error: invalid_report_url$/);
});
test('invalid client configuration does not echo the supplied URL or credentials',()=>{
  for(const apiBaseUrl of ['not-a-url-sensitive-value','https://user:secret@api.example.invalid','http://api.example.invalid']){
    assert.throws(()=>createEvidenceClient({apiBaseUrl,getAccessToken:async()=>''}),/^Error: invalid_evidence_request$/);
  }
});
test('malformed JSON after upload is unconfirmed and never causes an automatic resend',async()=>{
  let calls=0;
  const client=createEvidenceClient({apiBaseUrl:'https://api.example.invalid',getAccessToken:async()=>'fictional-token',fetchImpl:async()=>{calls++;return {ok:true,json:async()=>{throw Error('private-provider-response');}};}});
  await assert.rejects(client.upload({employeeId:'11111111-1111-4111-8111-111111111111'},{}),/^Error: upload_unconfirmed$/);
  assert.equal(calls,1);
});
