#!/usr/bin/env node
// Safe self-healing for Helm-owned launcher and per-user PATH only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const argv=process.argv.slice(2),dry=argv.includes('--dry-run'),yes=argv.includes('--yes');
if(argv.some(v=>!['--dry-run','--yes'].includes(v))||(dry&&yes)){
  console.error('Usage: helm repair --dry-run | --yes');process.exit(1);
}
const home=os.homedir(), folder=path.join(home,'.helm'),recordFile=path.join(folder,'install.json');
function abort(message){console.error('helm repair: '+message);process.exit(1);}
let record;
try{record=JSON.parse(fs.readFileSync(recordFile,'utf8'));}catch{abort('no managed installation record. Use helm install or the verified bootstrap first.');}
if(record?.name!=='helm'||typeof record.dir!=='string'||!['user','local','project'].includes(record.scope))
  abort('invalid installation record; refusing automatic repair.');
const packageFile=path.join(record.dir,'package.json');
try{
  if(fs.lstatSync(record.dir).isSymbolicLink()||!fs.existsSync(path.join(record.dir,'server','mcp.mjs'))||
    JSON.parse(fs.readFileSync(packageFile,'utf8')).name!=='@samjuniors/helm')throw Error('invalid package');
}catch{abort('managed installation is missing or unrecognized. No files changed.');}
const bin=path.join(folder,'bin'),launcher=path.join(bin,process.platform==='win32'?'helm.cmd':'helm');
if(fs.existsSync(launcher)&&(!fs.statSync(launcher).isFile()||!fs.readFileSync(launcher,'utf8').includes('HELM-MANAGED-LAUNCHER')))
  abort('launcher is not Helm-owned; refusing to replace it: '+launcher);
console.log('Helm repair: '+(dry?'preview':'apply')+'\n  managed copy: '+record.dir+'\n  launcher: '+launcher+'\n  user PATH: '+(process.platform==='win32'?'Windows HKCU only':'owned shell profile blocks only'));
if(!yes){console.log('No changes made. Apply with: helm repair --yes');process.exit(0);}
const args=[path.join(record.dir,'setup.mjs'),'install','--host','none','--scope',record.scope,'--yes'];
if(record.projectDir)args.push('--project',record.projectDir);
const result=spawnSync(process.execPath,args,{stdio:'inherit'});
if(result.error||result.status!==0)abort('managed repair failed; existing settings were preserved where possible.');
console.log('Repair finished. Restart the terminal and coding assistants to load new environment settings.');
