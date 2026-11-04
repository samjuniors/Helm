#!/usr/bin/env node
// Helm's guided terminal setup. All mutations flow through the existing guarded
// CLI, with a separate dry-run and human approval first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { discoverClients, parseClientSelection, selectedHostFlag } from './server/setup-discovery.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const home=os.homedir();
const recordFile=path.join(home,'.helm','install.json');
const setupFile=path.join(root,'setup.mjs');
const defaultDir=path.join(home,'.helm','plugin');
const log=(s='')=>console.log(s);
const call=(args)=>spawnSync(process.execPath,[setupFile,...args],{stdio:'inherit'}).status??1;
const ask=async (rl,prompt,fallback='')=>{
  const answer=(await rl.question(prompt)).trim();
  if(['q','quit','exit'].includes(answer.toLowerCase()))throw Object.assign(new Error('Cancelled'),{cancelled:true});
  return answer||fallback;
};
const confirm=async(rl,label)=>(await ask(rl,label+' Type YES to proceed: ','no'))==='YES';
export const installedState=()=>{
  if(!fs.existsSync(recordFile))return {status:'not-installed'};
  try{
    const record=JSON.parse(fs.readFileSync(recordFile,'utf8'));
    const pkg=JSON.parse(fs.readFileSync(path.join(record.dir,'package.json'),'utf8'));
    if(pkg.name==='@samjuniors/helm'&&fs.existsSync(path.join(record.dir,'server','mcp.mjs')))
      return {status:'installed',record,version:pkg.version};
  }catch{}
  return {status:'invalid',recordFile};
};
export const doctorReport=()=>{
  const installed=installedState();
  const clients=discoverClients();
  const launcher=path.join(home,'.helm','bin',process.platform==='win32'?'helm.cmd':'helm');
  return {installed,launcher,launcherExists:fs.existsSync(launcher),clients};
};
export async function latestStatus(version,fetchImpl=fetch){
  if(!/^\d+\.\d+\.\d+$/.test(version||''))return {status:'unknown'};
  const signal=AbortSignal.timeout(3500);
  try{
    const resp=await fetchImpl('https://api.github.com/repos/samjuniors/Helm/releases/latest',
      {headers:{'User-Agent':'helm-setup-wizard',Accept:'application/vnd.github+json'},signal});
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    const j=await resp.json();
    if(j.prerelease||j.draft||!/^v\d+\.\d+\.\d+$/.test(j.tag_name))throw new Error('Invalid stable release');
    const latest=j.tag_name.slice(1);
    const a=version.split('.').map(Number),b=latest.split('.').map(Number);
    const older=a[0]<b[0]||(a[0]===b[0]&&(a[1]<b[1]||(a[1]===b[1]&&a[2]<b[2])));
    return {status:older?'available':'current',installed:version,latest};
  }catch(e){return {status:'unavailable',message:e.message};}
}
const showClients=(clients)=>{
  log('\n  Coding environments detected (informational only):');
  for(const c of clients)log('  '+c.label+' — '+(c.detected?c.evidence:'not detected')+
    (c.integration==='automatic'?c.available?' [automatic setup available]':' [CLI not on PATH]':' [manual guidance]'));
};
const manualInstructions=(clients,server)=>{
  log('\n  Additional IDE/desktop integration (manual, no files changed):');
  for(const c of clients.filter(x=>x.integration!=='automatic')){
    log('  '+c.label+': '+c.config);
    if(c.id==='antigravity')log('    Global: ~/.gemini/config/mcp_config.json. Project: .agents/mcp_config.json. Use Settings → Customizations → Installed MCP Servers.');
    if(c.id==='claude_desktop')log('    Quit Claude Desktop before editing. MSIX installations can use different private settings.');
  }
  log('  MCP server to register: '+server);
  log('  Use helm print-config --host codex|claude|cursor|vscode for sample syntax.');
};
async function guidedInstall(rl,snapshot){
  const {installed,clients}=snapshot;
  log('\n── Install Helm / add coding clients ──');
  if(installed.status==='invalid'){log('Invalid existing install record. Review '+recordFile+' before changing anything.');return;}
  showClients(clients);
  const detected=clients.filter(x=>x.integration==='automatic'&&x.available).map(x=>x.id);
  const choice=await ask(rl,'\n  Register clients (detected, claude, codex, claude,codex or none) ['+(detected.length?'detected':'none')+']: ',detected.length?'detected':'none');
  let hosts;
  try{hosts=parseClientSelection(choice,clients);}
  catch(e){log('  '+e.message);return;}
  const missing=hosts.filter(id=>!clients.find(c=>c.id===id)?.available);
  if(missing.length){log('These client CLIs are not available on PATH: '+missing.join(', ')+'. No changes made.');return;}
  const host=selectedHostFlag(hosts);
  let folder=defaultDir;
  if(installed.status==='installed'){
    folder=installed.record.dir;
    log('  Existing managed installation: '+folder);
  }else{
    folder=path.resolve(await ask(rl,'  Installation folder (Enter for '+defaultDir+'): ',defaultDir));
  }
  const addPath=process.platform==='win32'?
    (await ask(rl,'  Add Helm to your Windows user PATH? [Y/n]: ','Y')).toLowerCase()!=='n':false;
  const args=['install','--host',host,...(installed.status==='installed'?[]:['--dir',folder]),...(!addPath?['--no-path']:[])];
  log('\n── Review changes before approval ──');
  if(call([...args,'--dry-run'])!==0){log('Preview failed: no changes applied.');return;}
  log('Your projects, Git history and unrelated files will not be removed.');
  if(!await confirm(rl,'Apply this plan?')){log('Cancelled.');return;}
  const result=call([...args,'--yes']);
  log(result===0?'Install/registration finished. Restart the selected clients.':'Setup reported an error; inspect the output.');
  if(result===0)manualInstructions(clients,path.join(folder,'server','mcp.mjs'));
}
async function checkOrUpdate(rl,current,apply=false){
  if(current.status!=='installed'){log('No managed installation detected. Use Install first.');return;}
  if(fs.existsSync(path.join(current.record.dir,'.git'))){log('Git checkout: use git pull --ff-only. Managed self-update is blocked.');return;}
  const cmd=path.join(current.record.dir,'bin','helm.mjs');
  const run=(flags)=>spawnSync(process.execPath,[cmd,'update',...flags],{stdio:'inherit'}).status??1;
  if(run(['--check'])!==0||!apply)return;
  if(run(['--dry-run'])!==0)return;
  if(!await confirm(rl,'Download, verify and update Helm?')){log('Update cancelled.');return;}
  const result=run([]);
  log(result===0?'Update finished. Restart connected clients.':'Update failed; preserve and inspect the backup.');
}
async function uninstall(rl){
  log('\n── Review removal ──');
  if(call(['uninstall','--dry-run'])!==0)return;
  if(!await confirm(rl,'Remove the managed Helm installation?')){log('Cancelled.');return;}
  const code=call(['uninstall','--yes']);
  log(code===0?'Uninstall complete.':'Uninstall failed; review output before retrying.');
}
export async function runWizard(){
  if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Guided setup requires an interactive terminal. Scripts can use helm install --host codex --dry-run followed by helm install --host codex.');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  let lastCheckedVersion=null;
  let release=null;
  try{
    while(true){
      const current=doctorReport();
      if(current.installed.status==='installed' && lastCheckedVersion!==current.installed.version){
        lastCheckedVersion=current.installed.version;
        release=await latestStatus(current.installed.version);
      }
      log('\n╭────────────────────────────────────────╮');
      log('│  Helm  ·  Setup & Integration Manager  │');
      log('╰────────────────────────────────────────╯');
      log('  '+(current.installed.status==='installed'?'Installed v'+current.installed.version+' at '+current.installed.record.dir:current.installed.status==='not-installed'?'Not installed':'Installation requires review'));
      if(release?.status==='available') log('  UPDATE AVAILABLE: v'+release.latest+' (requires approval to install)');
      else if(release?.status==='unavailable') log('  Release check unavailable (offline mode is fine).');
      log('  1) Guided install / add another client');
      log('  2) Check for updates');
      log('  3) Preview and apply available update');
      log('  4) Doctor: status and client detection');
      log('  5) Guided uninstall');
      log('  6) IDE / desktop connection instructions');
      log('  q) Quit');
      const choice=await ask(rl,'  Choose [1-6 or q]: ');
      if(choice==='1')await guidedInstall(rl,current);
      else if(choice==='2')await checkOrUpdate(rl,current.installed);
      else if(choice==='3')await checkOrUpdate(rl,current.installed,true);
      else if(choice==='4'){call(['status']);showClients(current.clients);}
      else if(choice==='5')await uninstall(rl);
      else if(choice==='6')manualInstructions(current.clients,path.join(current.installed.status==='installed'?current.installed.record.dir:root,'server','mcp.mjs'));
      else log('Choose 1-6 or q.');
    }
  }catch(e){if(e.cancelled||e.code==='ERR_USE_AFTER_CLOSE'||e.message==='Aborted with Ctrl+D')log('\nSetup closed.');else throw e;}
  finally{rl.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await runWizard();}catch(e){console.error('Helm setup: '+e.message);process.exitCode=1;}
}
