import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {demonstrate} from './run.mjs';

export function parsePort(value='8788'){
  if(!/^\d{1,5}$/.test(value)||Number(value)<1024||Number(value)>65535)
    throw Error('PORT must be a whole number from 1024 to 65535. No provider action was started.');
  return Number(value);
}

export function createPreviewServer(){
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    const address=server.address(),authority=`127.0.0.1:${address?.port}`;
    if(req.headers.host!==authority||req.headers.origin&&req.headers.origin!==`http://${authority}`){
      res.writeHead(403);return res.end('Use the exact local preview address.');
    }
    if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});return res.end('This preview accepts read-only GET requests.');}
    try{
      if(req.url==='/result.json'){
        res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(demonstrate()));
      }
      if(req.url!=='/'){res.writeHead(404);return res.end('That preview page was not found.');}
      const body=await readFile(new URL('./index.html',import.meta.url));
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end(body);
    }catch{
      res.writeHead(500);res.end('Local demonstration unavailable. Check the local process; no provider action was started.');
    }
  });
  return server;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const port=parsePort(process.env.PORT??'8788');
    const server=createPreviewServer();
    server.on('error',()=>{console.error('Local preview could not start. Check whether its port is in use and choose an unused PORT from 1024 to 65535. No provider action was started.');process.exitCode=1;});
    server.listen(port,'127.0.0.1',()=>console.log(`Local fictional preview: http://127.0.0.1:${port}`));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
