import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {seedInner} from './demo-data.js';
const args = process.argv.slice(2);
if (args.some(x => x !== '--remote')) throw new Error('Usage: npm run seed -- [--remote]');
const location = args.includes('--remote') ? '--remote' : '--local';
const wrangler = ['wrangler','d1','execute','DEMO_DB',location];
const query = JSON.parse(execFileSync('npx',[...wrangler,'--command','SELECT COUNT(*) AS c FROM users','--json'],{encoding:'utf8'}));
if (query[0].results[0].c) { console.log('Demo database already contains users; no changes made.'); process.exit(0); }
const statements=[];
const literal = v => v === null ? 'NULL' : typeof v === 'number' ? String(v) : "'"+String(v).replaceAll("'","''")+"'";
await seedInner({DB:{prepare(sql){return {bind(...values){return {sql:sql.replace(/\?/g,()=>literal(values.shift()))};},async first(){return {c:0};}};},async batch(batch){statements.push(...batch.map(x=>x.sql+';'));}}});
const dir=mkdtempSync(join(tmpdir(),'skillloop-seed-'));
try { const file=join(dir,'demo.sql'); writeFileSync(file,statements.join('\n')); execFileSync('npx',[...wrangler,'--file',file],{stdio:'inherit'}); }
finally { rmSync(dir,{recursive:true}); }
