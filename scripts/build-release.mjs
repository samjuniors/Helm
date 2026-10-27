#!/usr/bin/env node
import fs from'node:fs';import os from'node:os';import path from'node:path';import crypto from'node:crypto';import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,tag='v'+version,out=path.join(root,'dist');
function run(cmd,args,cwd=root,pipe=false){const r=spawnSync(cmd,args,{cwd,encoding:'utf8',stdio:pipe?['ignore','pipe','inherit']:'inherit'});if(r.status!==0)throw Error(cmd+' failed '+r.status);return r.stdout}
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);run(process.execPath,['scripts/check-release.mjs']);
run('npm',['pack','--ignore-scripts','--pack-destination',out]);
const packed=fs.readdirSync(out).find(x=>x.endsWith('.tgz'));if(!packed)throw Error('npm pack failed');fs.renameSync(path.join(out,packed),path.join(out,'helm-'+tag+'.tgz'));
const meta=JSON.parse(run('npm',['pack','--dry-run','--ignore-scripts','--json'],root,true))[0].files;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'helm-release-'));try{const dest=path.join(tmp,'helm');for(const entry of meta){const to=path.join(dest,entry.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(root,entry.path),to)}run('zip',['-q','-r',path.join(out,'helm-'+tag+'.zip'),'helm'],tmp)}finally{fs.rmSync(tmp,{recursive:true,force:true})}
const names=fs.readdirSync(out).filter(x=>/\.(zip|tgz)$/.test(x)).sort();const sums=names.map(n=>crypto.createHash('sha256').update(fs.readFileSync(path.join(out,n))).digest('hex')+'  '+n).join('\n')+'\n';fs.writeFileSync(path.join(out,'SHA256SUMS'),sums);console.log(sums);
