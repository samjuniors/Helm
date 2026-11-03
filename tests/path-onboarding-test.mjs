import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendPathEntry, removePathEntry, changeWindowsUserPath } from '../server/user-path.mjs';

let n=0;const pass=(t)=>{n++;console.log('  PASS '+t);};
const target='C:\\Users\\Example\\.helm\\bin';
let value='C:\\Windows\\System32;%USERPROFILE%\\tools';
let a=appendPathEntry(value,target);
assert.equal(a.changed,true);
assert.equal(a.value,value+';'+target);
pass('append preserves existing PATH entries');
assert.deepEqual(appendPathEntry(a.value,'c:\\users\\example\\.HELM\\BIN\\'),{value:a.value,changed:false});
pass('append is case- and separator-insensitive');
let removed=removePathEntry(a.value,target);
assert.equal(removed.changed,true);assert.equal(removed.value,value);
pass('remove deletes only the exact launcher PATH entry');
assert.deepEqual(removePathEntry(value,target),{value,changed:false});
pass('remove is idempotent and preserves unknown entries');
assert.throws(()=>appendPathEntry('A;B',''),/empty/);
assert.throws(()=>appendPathEntry('x'.repeat(30000),'C:\\Helm'),/too long/);
pass('rejects empty directories and excessively long PATH');

if(process.platform==='win32'){
 const subkey='Software\\HelmPathQA_'+crypto.randomBytes(16).toString('hex');
 const reg='HKCU\\'+subkey;
 const run=(exe,args)=>spawnSync(exe,args,{encoding:'utf8',timeout:12000,windowsHide:true});
 const check=(r,title)=>assert.equal(r.status,0,title+': '+String(r.stderr||r.stdout||''));
 const original='C:\\Windows\\System32;%USERPROFILE%\\Tools';
 try{
  check(run('reg.exe',['add',reg,'/v','Path','/t','REG_EXPAND_SZ','/d',original,'/f']),'create isolated registry key');
  const q=()=>{const result=run('reg.exe',['query',reg,'/v','Path']);check(result,'query test path');const m=result.stdout.match(/^\s*Path\s+REG_EXPAND_SZ\s+(.*)$/mi);assert.ok(m,'value not found');return m[1].trimEnd();};
  assert.equal(q(),original);
  const added=changeWindowsUserPath(target,'add',{testKey:subkey});
  assert.equal(added.changed,true);
  assert.equal(q(),original+';'+target);
  pass('Windows user PATH handler safely appends to an isolated registry key');
  assert.equal(changeWindowsUserPath(target,'add',{testKey:subkey}).changed,false);
  assert.equal(q(),original+';'+target);
  pass('Windows PATH operation is idempotent');
  assert.equal(changeWindowsUserPath(target,'remove',{testKey:subkey}).changed,true);
  assert.equal(q(),original);
  pass('Windows PATH removal preserves the original REG_EXPAND_SZ value');
  assert.equal(changeWindowsUserPath(target,'remove',{testKey:subkey}).changed,false);
  pass('Windows PATH removal is idempotent');
 } finally {
  const result=run('reg.exe',['delete',reg,'/f']);
  check(result,'remove isolated QA registry key');
 }
}else{
 assert.throws(()=>changeWindowsUserPath('/tmp/helm','add'),/Only Windows/);
 pass('non-Windows hosts never mutate Windows user environment');
}
console.log(n+'/'+n+' PATH-onboarding checks passed');
