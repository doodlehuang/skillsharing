const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {resolve}=require('node:path');
const sql = name => readFileSync(resolve('migrations',name),'utf8').replace(/--[^\n]*/g,'').split(';').map(x=>x.trim()).filter(Boolean);
test('security boundaries and transactional commands',async t=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:resolve('src/index.js'),compatibilityDate:'2026-10-28',d1Databases:['DB','DEMO_DB'],serviceBindings:{ASSETS:()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})}}));
 try{
 const db=await mf.getD1Database('DB'),demo=await mf.getD1Database('DEMO_DB');
 for(const target of [db,demo]) for(const name of ['0001_init.sql','0002_security.sql']) await target.batch(sql(name).map(x=>target.prepare(x)));
 const api=async(path,{cookie,body,method='GET',headers={}}={})=>mf.dispatchFetch('https://example.test'+path,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{'content-type':'application/json','x-skillloop-request':'1'}:{}),...headers},...(method!=='GET'?{body:typeof body==='string'?body:JSON.stringify(body||{})}:{})});
 const cookie=res=>res.headers.get('set-cookie').split(';')[0];
 const register=async(email)=>{const res=await api('/api/auth/register',{method:'POST',body:{email,password:'a long test password',name:email}}); assert.equal(res.status,200); return {cookie:cookie(res),user:(await res.json()).user};};
 const a=await register('a@test.invalid'), b=await register('b@test.invalid'), outsider=await register('c@test.invalid');
 const {seedInner}=await import('../scripts/demo-data.js'); await seedInner({DB:demo});
 let d=await api('/api/demo/auth/demo',{method:'POST'});assert.equal(d.status,200);let dc=cookie(d);const du=(await d.json()).user;
 await t.test('realms, private data, session digests and headers',async()=>{
  for(const path of ['/api/me','/api/users/'+a.user.id,'/api/skills']) assert.equal((await api(path)).status,401);
  assert.equal((await api('/api/me',{cookie:dc})).status,401);
  assert.equal((await api('/api/demo/me',{cookie:a.cookie})).status,401);
  assert.equal((await api('/api/users/'+du.id,{cookie:a.cookie})).status,404);
  assert.equal((await api('/api/demo/users/'+a.user.id,{cookie:dc})).status,404);
  assert.equal((await api('/api/auth/demo',{method:'POST'})).status,404);
  assert.equal((await api('/api/demo/auth/register',{method:'POST',cookie:dc,body:{email:'x@y.invalid',password:'long enough password'}})).status,404);
  const raw=await db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').bind(a.user.id).first(); assert.equal(raw.token_hash.length,64);assert.notEqual(raw.token_hash,a.cookie.split('=')[1]);
  const res=await api('/api/users/'+b.user.id,{cookie:a.cookie});const data=await res.json(); assert.equal(data.user.email,undefined);assert.equal(data.user.password_hash,undefined);
  assert.match(res.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(res.headers.get('cache-control'),'no-store');
 });
 await t.test('CSRF and strict input',async()=>{
  for(const headers of [{'x-skillloop-request':''},{origin:'https://evil.test'},{'sec-fetch-site':'same-site'}]) assert.equal((await api('/api/me',{method:'PATCH',cookie:a.cookie,body:{name:'x'},headers})).status,403);
  for(const body of ['{','[]','null',JSON.stringify({name:42}),JSON.stringify({name:'x'.repeat(25)})])assert.equal((await api('/api/me',{method:'PATCH',cookie:a.cookie,body})).status,400);
  assert.equal((await api('/api/me',{method:'PATCH',cookie:a.cookie,body:' '.repeat(17000)})).status,413);
  assert.equal((await api('/api/me',{method:'PATCH',cookie:a.cookie,body:{},headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await api('/api/auth/register',{method:'POST',body:{email:'weak@test.invalid',password:'short'}})).status,400);
 });
 await api('/api/me/teach',{method:'POST',cookie:b.cookie,body:{skill:'Python'}});
 const create=async()=>{const res=await api('/api/exchanges',{method:'POST',cookie:a.cookie,body:{partnerId:b.user.id,teachSkill:'Python',durationHours:2}});assert.equal(res.status,200);return (await res.json()).exchange.id;};
 const e=await create(), e2=await create();
 await t.test('ownership, concurrent acceptance, balance and settlement',async()=>{
  assert.equal((await api('/api/exchanges/'+e,{cookie:outsider.cookie})).status,403);
  assert.equal((await api('/api/exchanges/'+e+'/accept',{method:'POST',cookie:a.cookie})).status,403);
  const accepts=await Promise.all([e,e,e2].map(id=>api('/api/exchanges/'+id+'/accept',{method:'POST',cookie:b.cookie})));
  assert.equal(accepts.filter(x=>x.status===200).length,1); assert.equal(accepts.filter(x=>x.status===409).length,2);
  const accepted=await db.prepare("SELECT id FROM exchanges WHERE status='accepted'").first();
  assert.equal((await api('/api/exchanges/'+accepted.id+'/complete',{method:'POST',cookie:b.cookie})).status,403);
  const finished=await Promise.all(['cancel','complete'].map(action=>api('/api/exchanges/'+accepted.id+'/'+action,{method:'POST',cookie:a.cookie})));
  assert.equal(finished.filter(x=>x.status===200).length,1);assert.equal(finished.filter(x=>x.status===409).length,1);
  const posts=(await db.prepare('SELECT reason FROM ledger WHERE exchange_id=?').bind(accepted.id).all()).results.map(x=>x.reason);
  assert.equal(posts.length,2);assert.ok(!(posts.includes('refund')&&posts.includes('earn')));
  assert.equal((await api('/api/exchanges/'+accepted.id+'/messages',{method:'POST',cookie:a.cookie,body:{body:'late'}})).status,409);
 });
 await t.test('demo remains interactive and reviews are unique',async()=>{
  const rows=(await demo.prepare("SELECT id,requester_id FROM exchanges WHERE status='accepted'").all()).results;
  const ex=rows[0];const switched=await api('/api/demo/auth/demo-switch',{method:'POST',cookie:dc,body:{userId:ex.requester_id}});assert.equal(switched.status,200);const nc=cookie(switched);
  assert.equal((await api('/api/demo/me',{cookie:dc})).status,401);dc=nc;
  assert.equal((await api('/api/demo/exchanges/'+ex.id+'/messages',{method:'POST',cookie:dc,body:{body:'demo message'}})).status,200);
  assert.equal((await api('/api/demo/exchanges/'+ex.id+'/complete',{method:'POST',cookie:dc})).status,200);
  const reviews=await Promise.all([1,2].map(()=>api('/api/demo/exchanges/'+ex.id+'/reviews',{method:'POST',cookie:dc,body:{rating:5,body:'good'}})));
  assert.deepEqual(reviews.map(x=>x.status).sort(),[200,409]);
 });
 await t.test('unauthorized mutations and sandbox exchange lifecycle',async()=>{
  for(const action of ['accept','cancel','complete','messages','reviews']) {
   const res=await api('/api/exchanges/'+e+'/'+action,{method:'POST',cookie:outsider.cookie,body:{body:'forged',rating:5}}); assert.equal(res.status,403);
  }
  const skillRes=await api('/api/me/teach',{method:'POST',cookie:a.cookie,body:{skill:'Guitar'}});const skill=(await skillRes.json()).teach;
  assert.equal((await api('/api/me/teach/'+skill.id,{method:'DELETE',cookie:outsider.cookie})).status,404);
  assert.equal((await api('/api/ledger',{cookie:outsider.cookie})).status,200);
  assert.ok((await (await api('/api/ledger',{cookie:outsider.cookie})).json()).entries.every(x=>!x.exchangeId));
  const people=(await (await api('/api/demo/discover',{cookie:dc})).json()).people;
  const partner=people.find(x=>x.teach.length);
  const made=await api('/api/demo/exchanges',{method:'POST',cookie:dc,body:{partnerId:partner.id,teachSkill:partner.teach[0].skill,durationHours:1,message:'demo request'}});
  assert.equal(made.status,200);const exchange=(await made.json()).exchange;
  const teacherLogin=await api('/api/demo/auth/demo',{method:'POST',body:{userId:partner.id}});const tc=cookie(teacherLogin);
  assert.equal((await api('/api/demo/exchanges/'+exchange.id+'/accept',{method:'POST',cookie:tc})).status,200);
  assert.equal((await api('/api/demo/exchanges/'+exchange.id+'/complete',{method:'POST',cookie:dc})).status,200);
  assert.equal((await demo.prepare("SELECT COUNT(*) AS n FROM ledger WHERE exchange_id=?").bind(exchange.id).first()).n,2);
 });
 await t.test('throttling and revoked sessions',async()=>{
  let last;for(let i=0;i<11;i++)last=await api('/api/auth/login',{method:'POST',body:{email:'missing@test.invalid',password:'wrong'}});
  assert.equal(last.status,429);assert.ok(Number(last.headers.get('retry-after'))>0);
  const login=await api('/api/auth/login',{method:'POST',cookie:a.cookie,body:{email:a.user.email,password:'a long test password'}});assert.equal(login.status,200);
  assert.equal((await api('/api/me',{cookie:a.cookie})).status,401);const ac=cookie(login);
  assert.equal((await api('/api/auth/logout',{method:'POST',cookie:ac})).status,200);assert.equal((await api('/api/me',{cookie:ac})).status,401);
 });
 }finally{await mf.dispose();}
});

test('migration preserves users, revokes old sessions, and rejects inconsistent ledgers',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-10-28',d1Databases:['DB','BAD']}));
 try {
  const {hashPassword}=await import('../src/index.js');const legacyHash=await hashPassword('legacy');
  for(const binding of ['DB','BAD']) {
   const db=await mf.getD1Database(binding);await db.batch(sql('0001_init.sql').map(x=>db.prepare(x)));
   await db.prepare("INSERT INTO users(id,email,password_hash,name,created_at) VALUES('legacy','legacy@test.invalid',?,'Legacy','2026-10-28')").bind(legacyHash).run();
   await db.prepare("INSERT INTO sessions VALUES('old-plaintext','legacy','2026-10-28','2027-10-28')").run();
   if(binding==='BAD')await db.prepare("INSERT INTO ledger VALUES('negative','legacy',NULL,-1,'escrow','2026-10-28')").run();
   const migrate=()=>db.batch(sql('0002_security.sql').map(x=>db.prepare(x)));
   if(binding==='BAD') {await assert.rejects(migrate);assert.equal((await db.prepare('SELECT token FROM sessions').first()).token,'old-plaintext');}
   else {await migrate();assert.equal((await db.prepare('SELECT password_hash FROM users').first()).password_hash,legacyHash);assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n,0);}
  }
 }finally{await mf.dispose();}
});
