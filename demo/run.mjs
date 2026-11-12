import {randomUUID} from 'node:crypto';
import {createRetrieval,nextRetrieval,retrievalView} from '../reference/fowlerRetrieval.mjs';
const ids=()=>randomUUID(),now=new Date('2026-11-12T12:00:00Z');
const staff={kind:'staff',id:ids()},worker={kind:'worker',id:ids()},employeeId=ids(),connectionRevision=ids();
const scope={employeeId,applicationId:null},context={scope,connectionRevision,workerId:worker.id};
export function demonstrate(){
 let job=createRetrieval({id:ids(),revision:ids(),target:{kind:'employee',id:employeeId},scope,requestedBy:staff.id,connectionRevision,credentialVersion:'a'.repeat(32),lastName:'Example'},now);
 const history=[job.state],move=(event,actor=worker)=>{job=nextRetrieval(job,event,actor,ids(),now,context);history.push(job.state);};
 move({action:'claim'});move({action:'lookup_complete',lease:job.lease.token,candidates:[{name:'Alex Example',reference:'DEMO-A',status:'Released',received:'11/12/2026',released:'11/12/2026',reportUrl:'https://reports.example.invalid/4DACTION/WebAppTextReport/DEMO-A'}],pagingVisible:false});
 move({action:'select',key:job.candidates[0].key},staff);move({action:'claim'});
 move({action:'capture_complete',lease:job.lease.token,capture:{id:ids(),capturedAt:now.toISOString(),parts:[{index:0,sha256:'a'.repeat(64),byteLength:20},{index:1,sha256:'b'.repeat(64),byteLength:30}]}});
 move({action:'save',checkDate:'2026-11-12'},staff);move({action:'claim'});
 move({action:'part_saved',lease:job.lease.token,index:0,sha256:'a'.repeat(64),documentId:ids()});
 move({action:'part_saved',lease:job.lease.token,index:1,sha256:'b'.repeat(64),documentId:ids()});move({action:'save_complete',lease:job.lease.token});
 return {mode:'Fictional local state-model demonstration; no provider, database or scanner calls',history,finalState:job.state,receipts:job.receipts.length,meaning:'Saved for scanning. This does not establish a clean file, a verified identity or an employment decision.'};
}
if(process.argv[1]?.endsWith('run.mjs'))console.log(JSON.stringify(demonstrate(),null,2));
