#!/usr/bin/env node
// Verified local build and optional GitHub publication. No GitHub Actions required.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=process.argv.slice(2);
const allowed=new Set(['--dry-run','--publish','--yes','--help']);
if(argv.some(a=>!allowed.has(a)))throw Error('usage: helm release [--dry-run | --publish --yes]');
if(argv.includes('--help')){console.log('helm release [--dry-run | --publish --yes]\nBuilds locally with tests, integration checks, versioned archives and SHA-256 checksums.\nPublishing requires gh authentication, a clean main checkout and explicit --publish --yes.');process.exit(0);}
const dry=argv.includes('--dry-run'),publish=argv.includes('--publish');
if(dry&&publish)throw Error('Choose --dry-run or --publish, not both');
if(publish&&!argv.includes('--yes'))throw Error('Publishing requires explicit --yes after reviewing helm release --dry-run');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const version=pkg.version,tag='v'+version,notes=path.join(root,'docs','releases',tag+'.md');
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Package version must be SemVer X.Y.Z');
if(!fs.existsSync(notes))throw Error('Custom release notes missing: '+notes);
const assets=[path.join(root,'dist','helm-'+tag+'.zip'),path.join(root,'dist','helm-'+tag+'.tgz')];
const sums=path.join(root,'dist','SHA256SUMS');
const exec=(cmd,args,options={})=>{
  const executable=process.platform==='win32'&&cmd==='npm'?'npm.cmd':cmd;
  const r=spawnSync(executable,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:300000,shell:process.platform==='win32'&&cmd==='npm',...options});
  if(r.error||r.status!==0)throw Error(cmd+' '+args.join(' ')+' failed: '+String(r.stderr||r.error||r.stdout||r.status).slice(0,1400));
  return (r.stdout||'').trim();
};
function verifyAssets(){
  const lines=fs.readFileSync(sums,'utf8').trim().split(/\r?\n/);
  for(const name of assets){
    const base=path.basename(name);
    const match=lines.filter(s=>s.endsWith('  '+base));
    if(match.length!==1||!fs.existsSync(name))throw Error('Missing artifact or checksum: '+base);
    const hash=crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
    if(match[0]!==hash+'  '+base)throw Error('Checksum mismatch: '+base);
    if(fs.statSync(name).size<1000)throw Error('Archive unexpectedly small: '+base);
  }
  console.log('Verified SHA-256 for '+assets.map(path.basename).join(', '));
}
const mainOnly=()=>{
  const top=exec('git',['rev-parse','--show-toplevel']);
  if(path.resolve(top)!==root)throw Error('Release must run in the Helm Git repository root');
  const branch=exec('git',['branch','--show-current']);
  if(branch!=='main')throw Error('Publishing requires main (currently '+branch+')');
  if(exec('git',['status','--porcelain','--untracked-files=normal']))throw Error('Uncommitted source changes; commit/review before publishing');
  exec('git',['fetch','origin','main','--tags']);
  const head=exec('git',['rev-parse','HEAD']),remote=exec('git',['rev-parse','origin/main']);
  if(head!==remote)throw Error('Local main and origin/main differ; sync and review before release');
  const origin=exec('git',['remote','get-url','origin']);
  if(!/(?:github\.com[:/])samjuniors\/Helm(?:\.git)?$/i.test(origin))throw Error('Git origin is not samjuniors/Helm');
  exec('gh',['auth','status','--hostname','github.com']);
  return head;
};
function ensureTag(head){
  const local=spawnSync('git',['rev-parse','-q','--verify','refs/tags/'+tag+'^{commit}'],{cwd:root,encoding:'utf8'});
  if(local.status===0){
    if(local.stdout.trim()!==head)throw Error('Existing tag '+tag+' does not point at HEAD');
    return;
  }
  exec('git',['tag','-a',tag,'-m','Helm '+tag],{stdio:'inherit'});
  exec('git',['push','origin','refs/tags/'+tag],{stdio:'inherit'});
}
console.log('Helm '+tag+' · '+(dry?'preview':publish?'publish locally':'local release build'));
console.log('Tests: npm run check; npm test; npm run test:integration; npm run audit:repo; npm run pack:release');
console.log('Artifacts: '+assets.map(a=>path.relative(root,a)).join(', ')+' and dist/SHA256SUMS');
if(dry){console.log('Preview only: no tests, packaging, git tags or GitHub changes performed.');process.exit(0);}
if(publish)mainOnly(); // Fail early: never run/commit a release from a stale or dirty checkout.
exec('npm',['run','check'],{stdio:'inherit'});
exec('npm',['test'],{stdio:'inherit'});
exec('npm',['run','test:integration'],{stdio:'inherit'});
exec('npm',['run','audit:repo'],{stdio:'inherit'});
exec('npm',['run','pack:release'],{stdio:'inherit'});
verifyAssets();
if(!publish){console.log('Local artifacts built and verified. To publish after review: helm release --publish --yes');process.exit(0);}
const head=mainOnly(); // Recheck after tests in case anything touched the checkout.
const release=spawnSync('gh',['release','view',tag,'--repo','samjuniors/Helm','--json','tagName'],{cwd:root,encoding:'utf8'});
if(release.status===0)throw Error('GitHub Release '+tag+' already exists; refusing to overwrite assets');
ensureTag(head);
try{
  exec('gh',['release','create',tag,...assets,sums,'--repo','samjuniors/Helm','--verify-tag','--title','Helm '+tag,'--notes-file',notes],{stdio:'inherit'});
}catch(e){
  throw Error(e.message+'\nTag '+tag+' was kept at the verified commit. Fix the upload problem and use gh release create '+tag+' --verify-tag with the existing files; do not retag.');
}
console.log('Published and uploaded verified Helm '+tag+' assets.');
