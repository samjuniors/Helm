#!/usr/bin/env node
// Cross-platform, offline-capable release packaging using the verified npm file list.
// A pure Node ZIP writer avoids dependency on the external zip/PowerShell commands.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createReleaseZip} from './zip-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,tag='v'+version,out=path.join(root,'dist');
function run(command,args,{capture=false}={}){
  // npm_execpath is populated by npm run and works on Windows without shell quoting.
  const npmCli=process.env.npm_execpath&&process.env.npm_execpath.endsWith('.js')?process.env.npm_execpath:null;
  const cmd=command==='npm'&&npmCli?process.execPath:command==='npm'&&process.platform==='win32'?'npm.cmd':command;
  const argv=command==='npm'&&npmCli?[npmCli,...args]:args;
  const r=spawnSync(cmd,argv,{cwd:root,encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit',shell:command==='npm'&&!npmCli&&process.platform==='win32'});
  if(r.error||r.status!==0)throw Error(command+' failed: '+String(r.stderr||r.error||r.status));
  return r.stdout||'';
}
run(process.execPath,['scripts/check-release.mjs']);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
run('npm',['pack','--ignore-scripts','--pack-destination',out]);
const packed=fs.readdirSync(out).filter(n=>n.endsWith('.tgz'));
if(packed.length!==1)throw Error('expected exactly one npm package tarball');
fs.renameSync(path.join(out,packed[0]),path.join(out,'helm-'+tag+'.tgz'));
const manifest=JSON.parse(run('npm',['pack','--dry-run','--ignore-scripts','--json'],{capture:true}));
const files=manifest[0]?.files?.map(e=>e.path);
if(!Array.isArray(files)||files.length<20)throw Error('incomplete npm package manifest');
const zip=createReleaseZip(root,files,path.join(out,'helm-'+tag+'.zip'));
const assets=fs.readdirSync(out).filter(n=>/\.(zip|tgz)$/.test(n)).sort();
if(assets.length!==2)throw Error('expected exactly a ZIP and a TGZ asset');
const checksums=assets.map(name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')+'  '+name).join('\n')+'\n';
fs.writeFileSync(path.join(out,'SHA256SUMS'),checksums);
console.log('Built '+tag+': '+zip.files+' package entries, '+zip.bytes+' ZIP bytes\n'+checksums);
