#!/usr/bin/env node
// Manual publication path when hosted GitHub Actions is blocked. Never force tags.
// Tested source, explicit confirmation, release-specific notes and SHA256 assets are mandatory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),yes=args.includes('--yes'),preview=args.includes('--dry-run')||!yes;
if(args.some(a=>!['--yes','--dry-run'].includes(a))||(yes&&args.includes('--dry-run'))){
  console.error('Usage: helm release --dry-run | --yes');process.exit(2);
}
function command(name,argv,{capture=true,allowFail=false}={}){
  const useNpm=name==='npm',npmCli=useNpm&&process.env.npm_execpath?.endsWith('.js')?process.env.npm_execpath:null;
  const program=npmCli?process.execPath:useNpm&&process.platform==='win32'?'npm.cmd':name;
  const callArgs=npmCli?[npmCli,...argv]:argv;
  const r=spawnSync(program,callArgs,{cwd:root,encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit',shell:useNpm&&!npmCli&&process.platform==='win32',timeout:300000,maxBuffer:8*1024*1024});
  if((r.error||r.status!==0)&&!allowFail)throw Error(name+' '+argv.join(' ')+' failed: '+String(r.stderr||r.error||r.stdout||r.status).trim().slice(0,1200));
  return r;
}
const git=(...argv)=>command('git',argv).stdout.trim();
function verifyAssets(version){
  const base=path.join(root,'dist'), names=['helm-v'+version+'.zip','helm-v'+version+'.tgz'], checks=fs.readFileSync(path.join(base,'SHA256SUMS'),'utf8');
  for(const name of names){
    const bytes=fs.readFileSync(path.join(base,name));
    if(!bytes.length)throw Error('empty asset '+name);
    const expected=checks.split(/\r?\n/).find(l=>l.endsWith('  '+name));
    const actual=crypto.createHash('sha256').update(bytes).digest('hex')+'  '+name;
    if(expected!==actual)throw Error('SHA-256 mismatch in '+name);
  }
  return names.map(n=>path.join(base,n)).concat(path.join(base,'SHA256SUMS'));
}
try{
  if(path.resolve(git('rev-parse','--show-toplevel'))!==root)throw Error('release must run from the root of the Helm Git checkout');
  if(git('rev-parse','--abbrev-ref','HEAD')!=='main')throw Error('switch to main before publishing');
  if(git('status','--porcelain','--untracked-files=all'))throw Error('Git checkout has uncommitted or untracked changes; do not release');
  const origin=git('remote','get-url','origin');
  if(!/(?:github\.com[:/]samjuniors\/Helm(?:\.git)?)$/.test(origin))throw Error('origin is not samjuniors/Helm');
  const sha=git('rev-parse','HEAD');
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('invalid SemVer version');
  const tag='v'+version,notes=path.join(root,'docs','releases',tag+'.md');
  if(!fs.existsSync(notes)||fs.statSync(notes).size<100)throw Error('missing custom versioned release notes: '+notes);
  const tagResult=command('git',['rev-parse','-q','--verify','refs/tags/'+tag+'^{commit}'],{allowFail:true});
  if(tagResult.status===0&&tagResult.stdout.trim()!==sha)throw Error(tag+' already points to a different commit; tags must never be moved');
  console.log('Helm manual release '+tag+'\n  commit: '+sha+'\n  source: '+root);
  if(preview){console.log('PREVIEW ONLY. Apply after code review with helm release --yes.\nChecks: metadata, tests, MCP integration, repository audit, ZIP/TGZ build, SHA-256, GitHub tag and Release upload.');process.exit(0);}
  const remote=git('ls-remote','origin','refs/heads/main').split(/\s+/)[0];
  if(remote!==sha)throw Error('origin/main does not match the reviewed local main. Fetch, reconcile, and rerun.');
  command('gh',['auth','status']);
  const existing=command('gh',['release','view',tag,'--json','tagName'],{allowFail:true});
  if(existing.status===0)throw Error(tag+' already has a GitHub Release; refusing to overwrite or duplicate assets');
  for(const [name,argv] of [
    ['npm',['run','check']],['npm',['test']],['npm',['run','test:integration']],
    ['npm',['run','audit:repo']],['npm',['run','pack:release']]
  ]){console.log('Verifying: '+name+' '+argv.join(' '));command(name,argv,{capture:false});}
  if(git('status','--porcelain','--untracked-files=all'))throw Error('verification changed tracked/untracked source files; inspect before publishing');
  const assets=verifyAssets(version);
  if(tagResult.status!==0){command('git',['tag',tag,sha]);console.log('Created local '+tag);}
  const published=git('ls-remote','--tags','origin','refs/tags/'+tag).split(/\s+/)[0];
  if(published&&published!==sha)throw Error('remote release tag belongs to a different commit; do not move it');
  if(!published){command('git',['push','origin',tag],{capture:false});console.log('Pushed '+tag);}
  command('gh',['release','create',tag,...assets,'--verify-tag','--title','Helm '+tag,'--notes-file',notes],{capture:false});
  const verify=command('gh',['release','view',tag,'--json','assets'],{capture:true});
  const actual=(JSON.parse(verify.stdout).assets||[]).map(a=>a.name);
  for(const f of assets)if(!actual.includes(path.basename(f)))throw Error('published release is missing '+path.basename(f));
  console.log('Published and verified '+tag+' with ZIP, TGZ and SHA256SUMS.');
}catch(e){console.error('Helm release stopped: '+e.message+'\nNo tag was force-moved. If a tag was already pushed, inspect its commit and resume deliberately; never retag a published version.');process.exitCode=1;}
