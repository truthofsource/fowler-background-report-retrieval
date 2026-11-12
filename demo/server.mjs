import http from 'node:http';import {readFile} from 'node:fs/promises';import {demonstrate} from './run.mjs';
const port=Number(process.env.PORT||8788),host='127.0.0.1';
http.createServer(async(req,res)=>{try{if(req.headers.host!==`${host}:${port}`||req.method!=='GET'){res.writeHead(403);return res.end();}res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'");
if(req.url==='/result.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(demonstrate()));}
if(req.url!=='/'){res.writeHead(404);return res.end();}
res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await readFile(new URL('./index.html',import.meta.url)));}catch{res.writeHead(500);res.end('Local demonstration unavailable. Check the local process; no provider action was started.');}}).listen(port,host,()=>console.log(`Local fictional preview: http://${host}:${port}`));
