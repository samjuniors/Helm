// Offline acceptance tests for Helm's managed self-updater.
// All I/O occurs in disposable test directories; no real GitHub requests or
// user MCP registrations. Fixture server responds with 14 standard MCP tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { runSelfUpdate, unpackNpmTgz, compareVersions } from '../server/self-update.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-self-update-acceptance-'));
let count = 0;
const pass = (title) => { count++; console.log('  PASS ' + title); };
const makeHome = (label) => {
  const home = path.join(temp, label);
  const plugin = path.join(home, '.helm', 'plugin');
  fs.mkdirSync(path.join(plugin, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(plugin, 'server'), { recursive: true });
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({name:'@samjuniors/helm',version:'0.7.1'}));
  fs.writeFileSync(path.join(plugin, 'server', 'mcp.mjs'), "// fake older MCP\nconst VERSION = '0.7.1';\n");
  fs.writeFileSync(path.join(plugin, 'bin', 'helm.mjs'), "// old CLI\n");
  fs.writeFileSync(path.join(plugin, 'user-notes.txt'), 'unchanged');
  const stateFile = path.join(home, '.helm', 'install.json');
  fs.writeFileSync(stateFile, JSON.stringify({name:'helm',dir:plugin,inPlace:false,scope:'user',host:'codex',installedAt:'2026-01-01',version:'0.7.1'}));
  return {home,plugin,stateFile};
};
const packageFiles = (version = '0.8.0') => {
  const sampleServer = [
    "// disposable test MCP server",
    "const VERSION = '" + version + "';",
    "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{serverInfo:{name:'helm',version:VERSION}}})+'\\n');",
    "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:Array.from({length:14},(_,i)=>({name:'t'+i}))}})+'\\n');",
  ].join('\n');
  const files = new Map([
    ['package.json', JSON.stringify({name:'@samjuniors/helm',version})],
    ['server/mcp.mjs', sampleServer],
    ['setup.mjs',fs.readFileSync(path.join(root,'setup.mjs'))],
    ['update.mjs',fs.readFileSync(path.join(root,'update.mjs'))],
    ['bin/helm.mjs','// test CLI\n'],
    ['rename.mjs','// never used in default-name fixture\n'],
  ]);
  for (let i = 0; i < 20; i++) files.set('docs/test-' + i + '.txt', 'fixture\n');
  return files;
};
function tarHeader(name, size, type='0') {
  const h=Buffer.alloc(512);
  const write=(s,a,len)=>h.write(String(s).slice(0,len),a,len,'ascii');
  write(name,0,100);write('0000644\0',100,8);write('0000000\0',108,8);write('0000000\0',116,8);
  write(size.toString(8).padStart(11,'0')+'\0',124,12);write('00000000000\0',136,12);
  for (let i=148; i<156; i++) h[i]=0x20;
  h[156]=type.charCodeAt(0);write('ustar\0',257,6);write('00',263,2);
  const sum=h.reduce((acc,v)=>acc+v,0);write(sum.toString(8).padStart(6,'0')+'\0 ',148,8);
  return h;
}
const makeArchive=(files, entryOverride=null)=>{
  const chunks=[];
  for(const [rel, body] of files){
    const b=Buffer.from(body);
    const name=entryOverride ? entryOverride(rel) : 'package/'+rel;
    chunks.push(tarHeader(name,b.length),b,Buffer.alloc((512-b.length%512)%512));
  }
  chunks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(chunks));
};
const assetLink=(version,name)=>'https://github.com/samjuniors/Helm/releases/download/v'+version+'/'+name;
const mockRelease=(archive,version='0.8.0',override={})=>{
  const file='helm-v'+version+'.tgz';
  const hash=crypto.createHash('sha256').update(archive).digest('hex');
  const sums=(override.wrongHash?'0'.repeat(64):hash)+'  '+file+'\n';
  const release={tag_name:'v'+version,draft:false,prerelease:false,
    html_url:'https://github.com/samjuniors/Helm/releases/tag/v'+version,
    assets:[{name:file,browser_download_url:assetLink(version,file)},
      {name:'SHA256SUMS',browser_download_url:assetLink(version,'SHA256SUMS')}],...override.release};
  const requests=[];
  const fetchImpl=async (url)=>{
    requests.push(url);
    const response=url.endsWith('/releases/latest')?JSON.stringify(release):
      url.endsWith('/SHA256SUMS')?sums:archive;
    if(!response)throw Error('unknown request');
    return new Response(response,{status:200});
  };
  return {fetchImpl,requests,release};
};
const candidate=makeArchive(packageFiles());
const envFor=(home)=>({...process.env,HOME:home,USERPROFILE:home,APPDATA:path.join(home,'AppData','Roaming'),LOCALAPPDATA:path.join(home,'AppData','Local')});
const opts=(fixture,mock,args)=>({pluginRoot:fixture.plugin,home:fixture.home,args,fetchImpl:mock.fetchImpl,
  childEnv:envFor(fixture.home),log:(msg)=>fixture.log.push(msg)});
const fixture=makeHome('basic');
fixture.log=[];
try {
  assert.equal(compareVersions('0.8.0','0.7.1'),1);
  assert.equal(compareVersions('0.7.1','0.7.1'),0);
  assert.equal(compareVersions('0.7.0','0.7.1'),-1);
  pass('semantic version ordering');
  let mock=mockRelease(candidate);
  let result=await runSelfUpdate(opts(fixture,mock,['--check']));
  assert.equal(result.status,'available');
  assert.equal(mock.requests.length,1);
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile,'utf8')).version,'0.7.1');
  pass('check calls only release metadata; no archive download or writes');
  mock=mockRelease(candidate);result=await runSelfUpdate(opts(fixture,mock,['--dry-run']));
  assert.equal(result.status,'preview');assert.equal(mock.requests.length,1);
  pass('dry-run previews and does not download or write');
  await assert.rejects(()=>runSelfUpdate(opts(fixture,mock,['--check','--dry-run'])),/usage/);
  pass('conflicting flags are rejected');
  const equal=mockRelease(candidate,'0.7.1');result=await runSelfUpdate(opts(fixture,equal,[]));
  assert.equal(result.status,'current');assert.equal(equal.requests.length,1);
  pass('current release is a no-op');
  const old=mockRelease(candidate,'0.7.0');result=await runSelfUpdate(opts(fixture,old,[]));
  assert.equal(result.status,'current');assert.equal(old.requests.length,1);
  pass('downgrade is never automatically selected');
  const corrupt=mockRelease(candidate,'0.8.0',{wrongHash:true});
  await assert.rejects(()=>runSelfUpdate(opts(fixture,corrupt,[])),/SHA-256 verification failed/);
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile,'utf8')).version,'0.7.1');
  pass('checksum mismatch refuses installation and preserves previous version');
  const traversal=makeArchive(packageFiles(),(p)=>p==='docs/test-0.txt'?'package/../escape.txt':'package/'+p);
  await assert.rejects(()=>runSelfUpdate(opts(fixture,mockRelease(traversal),[])),/unsafe archive entry/);
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile,'utf8')).version,'0.7.1');
  pass('tar path traversal rejected before installation');
  const link=Buffer.from(candidate); // separate crafted archive with forbidden symlink type
  const evil=makeArchive(new Map([['package.json',JSON.stringify({name:'@samjuniors/helm',version:'0.8.0'})]]));
  // Replace first file header type with symlink in the uncompressed tar.
  const raw=Buffer.from((await import('node:zlib')).gunzipSync(evil));raw[156]='2'.charCodeAt(0);
  await assert.rejects(()=>runSelfUpdate(opts(fixture,mockRelease(gzipSync(raw)),[])),/unsafe link or entry type/);
  pass('symlink entries rejected before any installation');
  const clone=makeHome('git-clone');fs.writeFileSync(path.join(clone.plugin,'.git'),'gitdir: /tmp/example\n');clone.log=[];
  await assert.rejects(()=>runSelfUpdate(opts(clone,mockRelease(candidate),[])),/Git source checkout/);
  pass('Git source checkout cannot be overwritten');
  const unrecorded=makeHome('unrecorded');fs.rmSync(unrecorded.stateFile);unrecorded.log=[];
  await assert.rejects(()=>runSelfUpdate(opts(unrecorded,mockRelease(candidate),[])),/managed installation record/);
  pass('unrecorded installation cannot be modified');
  const mismatch=makeHome('record-mismatch');mismatch.log=[];
  let st=JSON.parse(fs.readFileSync(mismatch.stateFile,'utf8'));st.dir=path.join(temp,'unrelated');
  fs.writeFileSync(mismatch.stateFile,JSON.stringify(st));
  await assert.rejects(()=>runSelfUpdate(opts(mismatch,mockRelease(candidate),[])),/ENOENT|not the managed Helm installation/);
  pass('tampered installation record cannot target unrelated folder');
  const prerelease=mockRelease(candidate,'0.8.0',{release:{prerelease:true}});
  await assert.rejects(()=>runSelfUpdate(opts(fixture,prerelease,[])),/stable Helm release/);
  pass('pre-release or draft is not silently installed');
  const successMock=mockRelease(candidate);
  result=await runSelfUpdate(opts(fixture,successMock,[]));
  assert.equal(result.status,'updated');
  assert.equal(JSON.parse(fs.readFileSync(fixture.stateFile,'utf8')).version,'0.8.0');
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture.plugin,'package.json'),'utf8')).version,'0.8.0');
  assert.equal(fs.readFileSync(path.join(fixture.plugin,'user-notes.txt'),'utf8'),'unchanged');
  assert.ok(fs.readdirSync(path.join(fixture.home,'.helm')).some((f)=>f.startsWith('plugin-backup-0.7.1-')));
  assert.ok(fs.existsSync(path.join(fixture.home,'.helm','bin',process.platform==='win32'?'helm.cmd':'helm')));
  pass('verified release updates the managed copy, retains user notes, creates backup and launcher');
  const final=mockRelease(candidate);result=await runSelfUpdate(opts(fixture,final,['--check']));
  assert.equal(result.status,'current');pass('updated package is current on subsequent checks');
  console.log(count+'/'+count+' offline Helm self-update checks passed');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
