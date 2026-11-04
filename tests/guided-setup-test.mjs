// Helm guided setup + advanced lifecycle in an isolated fake user environment.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverClients, parseClientSelection, selectedHostFlag } from '../server/setup-discovery.mjs';
import { latestStatus } from '../wizard.mjs';

let n=0;
const pass=(name)=>{n++;console.log('  PASS '+name)};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'helm-v010-wizard-'));
const home=path.join(temp,'private-home'),bin=path.join(temp,'fake-bin');
fs.mkdirSync(home,{recursive:true});fs.mkdirSync(bin,{recursive:true});
const parentPath=[bin,path.dirname(process.execPath),
  ...(process.platform==='win32'?[path.join(process.env.SystemRoot||'C:\\Windows','System32')]:['/usr/bin','/bin'])].join(path.delimiter);
const env={...process.env,HOME:home,USERPROFILE:home,APPDATA:path.join(home,'AppData','Roaming'),
  LOCALAPPDATA:path.join(home,'AppData','Local'),PATH:parentPath,HELM_MOCK_HOME:temp};
const mocks=path.join(temp,'fake-agent.mjs');
fs.writeFileSync(mocks,[
  "import fs from 'node:fs';",
  "import path from 'node:path';",
  "const name=process.env.HELM_MOCK_CLIENT;",
  "const marker=path.join(process.env.HELM_MOCK_HOME,'registered-'+name+'.txt');",
  "const a=process.argv.slice(2);",
  "if(a[0]==='--version'){console.log(name+' mock 1.0');process.exit(0);}",
  "if(a[0]==='mcp'&&a[1]==='list'){if(fs.existsSync(marker))console.log('helm: stdio');process.exit(0);}",
  "if(a[0]==='mcp'&&a[1]==='add'){if(fs.existsSync(marker)){console.error('already exists');process.exit(1);}fs.writeFileSync(marker,a.join(' '));console.log('added');process.exit(0);}",
  "if(a[0]==='mcp'&&a[1]==='remove'){fs.rmSync(marker,{force:true});console.log('removed');process.exit(0);}",
  "if(a[0]==='mcp'&&a[1]==='get'){if(fs.existsSync(marker))console.log(fs.readFileSync(marker,'utf8'));process.exit(fs.existsSync(marker)?0:1);}",
  "process.exit(2);",
].join('\n')+'\n');
const addCli=(name)=>{
  const file=path.join(bin,process.platform==='win32'?name+'.cmd':name);
  const content=process.platform==='win32'
    ? '@echo off\r\nset "HELM_MOCK_CLIENT='+name+'"\r\n"'+process.execPath+'" "'+mocks+'" %*\r\n'
    : '#!/bin/sh\nexport HELM_MOCK_CLIENT='+name+'\nexec "'+process.execPath+'" "'+mocks+'" "$@"\n';
  fs.writeFileSync(file,content,{mode:0o755});
};
const call=(args)=>spawnSync(process.execPath,[path.join(root,'setup.mjs'),...args],{
  env,cwd:temp,encoding:'utf8',timeout:30000,
});
const cli=(args)=>spawnSync(process.execPath,[path.join(root,'bin','helm.mjs'),...args],{
  env,cwd:temp,encoding:'utf8',timeout:20000,
});
const out=(r)=>(r.stdout||'')+(r.stderr||'');
const ok=(r,label)=>assert.equal(r.status,0,label+': '+out(r));
try{
  const discovered=discoverClients({home,env,platform:process.platform,commandExists:(s)=>s==='codex',
    exists:(p)=>p.endsWith('mcp_config.json')});
  assert.equal(discovered.find(x=>x.id==='codex').available,true);
  assert.equal(discovered.find(x=>x.id==='antigravity').integration,'guided-manual');
  assert.equal(discovered.find(x=>x.id==='antigravity').detected,true);
  pass('client discovery distinguishes detectable desktop configs from auto-install clients');
  assert.deepEqual(parseClientSelection('detected',discovered),['codex']);
  assert.deepEqual(parseClientSelection('claude,codex',discovered),['claude','codex']);
  assert.equal(selectedHostFlag([]),'none');
  assert.equal(selectedHostFlag(['codex','claude']),'all');
  assert.throws(()=>parseClientSelection('antigravity',discovered),/guided manual/);
  pass('wizard selection is explicit; manual-only IDEs never get auto-registered');
  const latest=await latestStatus('0.9.1',async()=>({
    ok:true,json:async()=>({tag_name:'v0.11.0',draft:false,prerelease:false}),
  }));
  assert.equal(latest.status,'available');
  const current=await latestStatus('0.11.0',async()=>({
    ok:true,json:async()=>({tag_name:'v0.11.0',draft:false,prerelease:false}),
  }));
  assert.equal(current.status,'current');
  const offline=await latestStatus('0.9.1',async()=>{throw Error('offline');});
  assert.equal(offline.status,'unavailable');
  pass('release discovery handles newer, current and offline without writes');
  const initial=call(['install','--host','none','--no-path','--dry-run']);
  ok(initial,'initial dry-run');assert.ok(!fs.existsSync(path.join(home,'.helm','install.json')));
  pass('CLI-only install preview is genuinely read-only');
  const setup=call(['install','--host','none','--no-path']);
  ok(setup,'CLI-only install');
  const state=path.join(home,'.helm','install.json'),plugin=path.join(home,'.helm','plugin');
  assert.deepEqual(JSON.parse(fs.readFileSync(state,'utf8')).hosts,[]);
  pass('CLI-only managed installation works without any coding assistant');
  addCli('claude');
  const preview=call(['install','--host','claude','--no-path','--dry-run']);
  ok(preview,'reconfigure preview');
  assert.ok(!fs.existsSync(path.join(temp,'registered-claude.txt')));
  pass('adding a client previews without writing');
  const connected=call(['install','--host','claude','--no-path']);
  ok(connected,'connect Claude Code');
  const marker=path.join(temp,'registered-claude.txt');
  assert.ok(fs.existsSync(marker));
  assert.deepEqual(JSON.parse(fs.readFileSync(state,'utf8')).hosts,['claude']);
  pass('existing managed copy can add Claude without reinstalling');
  const first=fs.readFileSync(marker,'utf8');
  const again=call(['install','--host','claude','--no-path']);
  ok(again,'re-register existing host');
  assert.equal(fs.readFileSync(marker,'utf8'),first);
  pass('existing Claude registration remains byte-for-byte unchanged');
  addCli('codex');
  const c=call(['install','--host','codex','--no-path']);
  ok(c,'add Codex');
  assert.deepEqual(JSON.parse(fs.readFileSync(state,'utf8')).hosts,['claude','codex']);
  assert.equal(fs.readFileSync(marker,'utf8'),first);
  pass('Codex can be added later without disturbing Claude');
  const doc=cli(['doctor','--json']);
  ok(doc,'doctor json');
  const j=JSON.parse(doc.stdout);
  assert.equal(j.installed.status,'installed');
  assert.equal(j.clients.find(x=>x.id==='codex').cli,true);
  pass('advanced helm doctor --json reports detected hosts read-only');
  const noTty=cli(['setup']);
  assert.notEqual(noTty.status,0);
  assert.match(out(noTty),/interactive terminal/);
  pass('guided wizard refuses non-interactive execution with clear CLI alternative');
  if (process.platform === 'linux' && spawnSync('which',['script'],{encoding:'utf8'}).status===0) {
    const cmd=JSON.stringify(process.execPath)+' '+JSON.stringify(path.join(root,'wizard.mjs'));
    // Deliver the keystroke after the wizard actually renders its prompt.
    // Piping q before the program starts loses input in util-linux script(1).
    const tty=await new Promise((resolve,reject)=>{
      const child=spawn('script',['-q','-e','-c',cmd,'/dev/null'],{env,cwd:temp,stdio:'pipe'});
      let stdout='',stderr='',sent=false;
      const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('wizard pseudo-terminal did not exit after prompt: '+stdout));},15000);
      child.stdout.on('data',chunk=>{
        stdout+=chunk.toString('utf8');
        if(!sent&&stdout.includes('Choose [1-6 or q]')){sent=true;child.stdin.write('q\n');child.stdin.end();}
      });
      child.stderr.on('data',chunk=>{stderr+=chunk.toString('utf8');});
      child.on('error',error=>{clearTimeout(timeout);reject(error);});
      child.on('close',(status)=>{clearTimeout(timeout);resolve({status,stdout,stderr});});
    });
    assert.equal(tty.status,0,'pseudo-terminal wizard quit: '+out(tty));
    assert.match(out(tty),/Helm\s+·\s+Setup & Integration Manager/);
    pass('Linux pseudo-terminal wizard opens, renders setup menu and exits without writes');
  }
  const note=path.join(home,'.helm','keep-me.txt');
  fs.writeFileSync(note,'PRESERVE');
  const rem=call(['uninstall','--yes']);
  ok(rem,'uninstall');
  assert.equal(fs.readFileSync(note,'utf8'),'PRESERVE');
  assert.ok(!fs.existsSync(marker)&&!fs.existsSync(path.join(temp,'registered-codex.txt')));
  assert.ok(!fs.existsSync(plugin));
  pass('managed uninstall preserves user notes and removes selected mock integrations');
  console.log(n+'/'+n+' isolated guided and advanced setup tests passed');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
