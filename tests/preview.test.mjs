import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createPreviewServer,parsePort} from '../demo/server.mjs';
let server,base;
before(async()=>{server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('preview validates its configured port before opening a listener',()=>{
  assert.equal(parsePort('8788'),8788);
  for(const value of ['','0','-1','NaN','1.5','65536','90000','1023'])assert.throws(()=>parsePort(value),/PORT must be/);
});
test('preview serves HTML and the actual extracted state-model output',async()=>{
  const home=await fetch(base);assert.equal(home.status,200);assert.match(home.headers.get('content-type'),/text\/html/);
  assert.equal(home.headers.get('cache-control'),'no-store');assert.ok(home.headers.get('content-security-policy'));
  const response=await fetch(base+'/result.json');assert.equal(response.status,200);const result=await response.json();assert.equal(result.finalState,'saved_for_scanning');assert.equal(result.receipts,2);
});
test('preview refuses unknown files instead of reading arbitrary paths',async()=>{
  for(const pathname of ['/README.md','/.git/config','/missing'])assert.equal((await fetch(base+pathname)).status,404);
});
test('preview rejects nonlocal Host and foreign Origin headers',async()=>{
  // fetch controls Host itself; use raw HTTP so this really sends the test header.
  const status=await new Promise((resolve,reject)=>{
    const req=http.get(base,{headers:{Host:'attacker.invalid'}},response=>{response.resume();resolve(response.statusCode);});
    req.on('error',reject);
  });
  assert.equal(status,403);
  assert.equal((await fetch(base,{headers:{Origin:'https://attacker.invalid'}})).status,403);
});
test('preview refuses writes and gives the allowed method',async()=>{
  const response=await fetch(base+'/result.json',{method:'POST'});assert.equal(response.status,405);assert.equal(response.headers.get('allow'),'GET');
});
