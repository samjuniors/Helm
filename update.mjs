#!/usr/bin/env node
// Helm self-updater: run from the unpacked NEW release, --into the existing folder.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source=path.dirname(fileURLToPath(import.meta.url)),args=process.argv.slice(2);
const opt=k=>{const i=args.indexOf('--'+k);return i<0?null:args[i+1]};
const fail=m=>{console.error('update: '+m);process.exit(1)};
const dst=opt('into');if(!dst)fail('usage: node update.mjs --into INSTALL-DIR [--dry-run] [--force] [--name CUSTOM]');
const target=path.resolve(dst);
const meta=d=>{try{const p=JSON.parse(fs.readFileSync(path.join(d,'package.json'),'utf8'));return ['@samjuniors/helm','product-kit-plugin'].includes(p.name)?p:null}catch{return null}};
const current=meta(source),old=meta(target);
if(!current||!fs.existsSync(path.join(source,'server/mcp.mjs')))fail('source is not a Helm package');
if(!old||!fs.existsSync(path.join(target,'server/mcp.mjs')))fail('target is not a Helm or legacy Product Kit installation');
if(source===target||source.startsWith(target+path.sep)||target.startsWith(source+path.sep))fail('source and destination must be separate folders');
if(fs.existsSync(path.join(target,'.git')))fail('target is a git source clone; use git pull instead of destructive update');
const cmp=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if((x[i]||0)!==(y[i]||0))return (x[i]||0)-(y[i]||0);return 0};
if(cmp(current.version,old.version)<0&&!args.includes('--force'))fail('refusing downgrade without --force');
if(cmp(current.version,old.version)===0&&!args.includes('--force')){console.log('Already at '+old.version);process.exit(0)}
let name=opt('name');if(!name){try{name=fs.readFileSync(path.join(target,'.plugin-name'),'utf8').trim()}catch{}}
if(!name){const bins=fs.readdirSync(path.join(target,'bin')).filter(n=>n.endsWith('.mjs'));name=bins.length===1?bins[0].slice(0,-4):'helm'}
if(!/^[a-z][a-z0-9-]{1,30}$/.test(name))fail('invalid server name');
console.log('Updating '+old.version+' -> '+current.version+', keeping name '+name);
if(args.includes('--dry-run')){console.log('DRY RUN: will back up, replace managed files, reapply name and self-test');process.exit(0)}
const backup=target+'-backup-'+old.version+'-'+new Date().toISOString().replace(/[:.]/g,'-');
fs.cpSync(target,backup,{recursive:true,filter:f=>!f.includes(path.sep+'node_modules')});
const managed=['server','bin','engine','commands','agents','skills','hooks','.claude-plugin','tests','scripts','rules','.mcp.json','plugin.json','mcp_config.json','install.mjs','rename.mjs','update.mjs','download.mjs','README.md','TODO-MAP.md','CHANGELOG.md','LICENSE','package.json','.gitignore'];
try{
for(const item of managed)fs.rmSync(path.join(target,item),{recursive:true,force:true});
fs.cpSync(source,target,{recursive:true,filter:f=>{const rel=path.relative(source,f);return !/(^|[\\/])(node_modules|\.git|dist)([\\/]|$)/.test(rel)&&rel!=='.plugin-name'}});
if(name!=='helm'){const r=spawnSync(process.execPath,[path.join(target,'rename.mjs'),'--name',name],{encoding:'utf8'});if(r.status!==0)throw Error('rename failed: '+r.stderr)}
fs.writeFileSync(path.join(target,'.plugin-name'),name+'\n');
const input=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'update',version:'1'}}},{jsonrpc:'2.0',id:2,method:'tools/list'}].map(JSON.stringify).join('\n')+'\n';
const r=spawnSync(process.execPath,[path.join(target,'server/mcp.mjs')],{input,encoding:'utf8',timeout:8000});
const lines=r.stdout.trim().split('\n').map(JSON.parse);
if(lines[0]?.result?.serverInfo?.name!==name||lines[0]?.result?.serverInfo?.version!==current.version||lines[1]?.result?.tools?.length<9)throw Error('MCP startup verification failed');
console.log('Updated and verified '+name+' '+current.version+'. Backup: '+backup+'; restart your agent and upgrade each project with helm upgrade-project.');
}catch(e){console.error('Update failed; rolling back: '+e.message);for(const item of managed)fs.rmSync(path.join(target,item),{recursive:true,force:true});fs.cpSync(backup,target,{recursive:true,force:true});fail('restored original files from '+backup)}
