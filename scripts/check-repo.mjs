#!/usr/bin/env node
// Optional, read-only Helm source audit. --no-fetch disables network. --strict fails on dirty worktrees.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2), offline=args.includes('--no-fetch'), strict=args.includes('--strict');
let pass=0,warn=0,fail=0;
const report=(kind,msg)=>{console.log('  '+kind+' '+msg);if(kind==='PASS')pass++;else if(kind==='WARN')warn++;else fail++};
const P=m=>report('PASS',m),W=m=>report('WARN',m),F=m=>report('FAIL',m);
const run=(cmd,...args)=>spawnSync(cmd,args,{cwd:root,encoding:'utf8'});
const git=(...a)=>run('git',...a);
const read=f=>{try{return fs.readFileSync(path.join(root,f),'utf8')}catch{return null}};
const json=f=>{try{return JSON.parse(read(f))}catch{return null}};
console.log('Helm repository audit (read-only)');
const pkg=json('package.json');
if(!pkg){F('invalid or missing package.json');process.exit(1)}
pkg.name==='@samjuniors/helm' && /^\d+\.\d+\.\d+$/.test(pkg.version)?P('Helm name and SemVer'):F('invalid package identity/version');
for(const f of ['plugin.json','.claude-plugin/plugin.json']){
 const j=json(f);j?.name==='helm'&&j.version===pkg.version?P(f+' version agrees'):F(f+' version mismatch');
}
(read('server/mcp.mjs')||'').includes("const VERSION = '"+pkg.version+"';")?P('MCP version agrees'):F('MCP version mismatch');
(read('CHANGELOG.md')||'').includes('## '+pkg.version)?P('changelog includes version'):F('missing changelog entry');
for(const f of ['README.md','LICENSE','.gitattributes','.gitignore','docs/RELEASING.md','scripts/build-release.mjs'])read(f)?P(f+' exists'):F('missing '+f);
for(const h of ['Quick start','Updat','Contribut'])new RegExp('^## .*'+h,'mi').test(read('README.md')||'')?P('README '+h+' section'):W('README '+h+' section missing');
new RegExp('^## .*Custom plugin names','mi').test(read('docs/ADVANCED_USAGE.md')||'')?P('advanced custom-name instructions'):W('advanced custom-name instructions missing');
pkg.license==='MIT'?P('MIT license preserved'):F('MIT license changed');
pkg.private===true?P('npm publishing disabled'):W('npm publishing is enabled');
Array.isArray(pkg.keywords)&&pkg.keywords.includes('mcp')?P('package keywords configured'):W('missing MCP keyword');
const r=git('rev-parse','--is-inside-work-tree');
if(r.status!==0)W('not a Git checkout: skipped remote checks');
else{
 const branch=git('branch','--show-current').stdout.trim();
 branch?P('branch '+branch):W('detached HEAD');
 const changes=git('status','--porcelain').stdout.trim();
 changes?(strict?F:W)('worktree has uncommitted changes'):P('worktree clean');
 const remote=git('remote','get-url','origin');
 if(remote.status!==0)W('origin remote missing');else{
  P('origin remote configured');
  if(!offline){const fetch=git('fetch','--tags','--quiet','origin');if(fetch.status!==0)W('origin fetch failed')}
  const compare=git('rev-list','--left-right','--count','origin/'+branch+'...'+branch);
  if(compare.status!==0)W('remote branch comparison unavailable');
  else{const [behind,ahead]=compare.stdout.trim().split(/\s+/).map(Number);behind||ahead?W('branch divergence behind='+behind+' ahead='+ahead):P('branch in sync with origin')}
 }
 const tags=git('tag','--list','v*').stdout.trim().split('\n').filter(Boolean);
 tags.includes('v'+pkg.version)?P('current tag exists locally'):W('planned v'+pkg.version+' is not tagged yet');
 const tracked=git('ls-files').stdout.trim().split('\n').filter(Boolean);
 const bad=tracked.filter(f=>/(^|\/)node_modules\/|(^|\/)\.env(\.|$)|(^|\/)\.plugin-name$|(^|\/)dist\//.test(f));
 bad.length?F('tracked local-only files: '+bad.slice(0,5).join(', ')):P('no local-only files tracked');
 const patterns=[/AKIA[0-9A-Z]{16}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/gh[pousr]_[A-Za-z0-9]{30,}/,/sk-[A-Za-z0-9_-]{20,}/,/xox[abprs]-[A-Za-z0-9-]{10,}/];
 const leaks=[];for(const f of tracked.slice(0,500)){const s=read(f);if(s&&patterns.some(p=>p.test(s)))leaks.push(f)}
 leaks.length?F('secret-like text: '+leaks.join(', ')):P('no obvious secrets in tracked text');
 if(!offline){const gh=run('gh','repo','view','--json','description,repositoryTopics,latestRelease');if(gh.status!==0)W('gh CLI unavailable/not authenticated');else{try{const info=JSON.parse(gh.stdout);info.description?P('GitHub description present'):W('GitHub description missing');info.repositoryTopics?.length?P('GitHub topics present'):W('GitHub topics missing');const t=info.latestRelease?.tagName;t==='v'+pkg.version?P('latest release version matches'):W('latest release '+(t||'none')+' differs from planned v'+pkg.version)}catch{W('GitHub metadata could not be parsed')}}}
}
console.log('Result: '+pass+' passed, '+warn+' warnings, '+fail+' failures');
process.exit(fail?1:0);
