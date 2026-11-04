// Project-scoped MCP registration. Keep global settings and third-party entries untouched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const START='# >>> Helm project MCP (managed) >>>',END='# <<< Helm project MCP (managed) <<<';
const jsonConfig=(project)=>path.join(project,'.mcp.json');
const tomlConfig=(project)=>path.join(project,'.codex','config.toml');
function contents(file){
  if(!fs.existsSync(file))return null;
  if(!fs.lstatSync(file).isFile())throw Error('Refusing to modify linked or non-file configuration: '+file);
  return fs.readFileSync(file,'utf8');
}
function backup(file,home){
  if(!fs.existsSync(file))return null;
  const dir=path.join(home,'.helm','backups');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const dest=path.join(dir,crypto.createHash('sha256').update(file).digest('hex').slice(0,12)+'-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.bak');
  fs.copyFileSync(file,dest);fs.chmodSync(dest,0o600);return dest;
}
function atomicWrite(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.helm-tmp-'+crypto.randomBytes(5).toString('hex');
  try{fs.writeFileSync(temp,value,{mode:fs.existsSync(file)?fs.statSync(file).mode:0o600});fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.rmSync(temp,{force:true});}
}
const isManaged=(record,nodePath,serverPath)=>record&&(record.command===nodePath||record.command==='node')&&Array.isArray(record.args)&&record.args.length===1&&record.args[0]===serverPath&&Object.keys(record).every(k=>['command','args'].includes(k));
const codexBlock=(nodePath,serverPath)=>START+'\n[mcp_servers.helm]\ncommand = '+JSON.stringify(nodePath)+'\nargs = ['+JSON.stringify(serverPath)+']\n'+END;
export function manageProjectMcp({projectDir=process.cwd(),action='install',host='all',dryRun=false,serverPath,nodePath=process.execPath,home=os.homedir()}={}){
  if(!['install','uninstall'].includes(action))throw Error('Invalid project MCP action');
  if(!['all','claude','codex'].includes(host))throw Error('Project MCP host must be all, claude or codex');
  const project=path.resolve(projectDir),server=path.resolve(serverPath||'');
  if(!fs.existsSync(project)||!fs.statSync(project).isDirectory()||fs.lstatSync(project).isSymbolicLink())throw Error('Project must be an existing real directory');
  if(!path.isAbsolute(nodePath)||!serverPath||!fs.existsSync(server))throw Error('Expected an absolute Node and existing Helm server path');
  const targets=host==='all'?['claude','codex']:[host],planned=[];
  // Preflight every file before touching any of them.
  for(const target of targets){
    if(target==='claude'){
      const file=jsonConfig(project),previous=contents(file);let data;
      try{data=previous?JSON.parse(previous):{};}catch{throw Error('Invalid .mcp.json; fix it manually before connecting Helm');}
      if(!data||Array.isArray(data)||typeof data!=='object'||(data.mcpServers&&(typeof data.mcpServers!=='object'||Array.isArray(data.mcpServers))))throw Error('Invalid .mcp.json structure');
      data.mcpServers??={};
      const existing=data.mcpServers.helm;
      if(existing&&!isManaged(existing,nodePath,server))throw Error('Existing custom Claude Helm registration; refusing to overwrite/remove it');
      if(action==='install'&&(!existing||existing.command!==nodePath))data.mcpServers.helm={command:nodePath,args:[server]};
      if(action==='uninstall'&&existing){delete data.mcpServers.helm;if(!Object.keys(data.mcpServers).length)delete data.mcpServers;}
      const next=(action==='uninstall'&&!existing)?previous:JSON.stringify(data,null,2)+'\n';
      const changed=action==='install'?(!existing||existing.command!==nodePath):Boolean(existing);
      planned.push({target,file,previous,next,changed});
    }else{
      const file=tomlConfig(project),previous=contents(file),content=previous||'',block=codexBlock(nodePath,server);
      const s=content.indexOf(START),e=content.indexOf(END);
      if((s>=0)!==(e>=0))throw Error('Partial Helm Codex markers: review manually');
      if(s>=0&&(content.slice(s,e+END.length)!==block||content.indexOf(START,s+1)>=0||content.indexOf(END,e+1)>=0))throw Error('Customized Helm Codex block: refusing to change it');
      // "adapt" in older Helm versions created an unmarked Codex block.
      // Upgrade/remove only an exact, trailing Helm entry for this very server.
      const legacyForms=['node',nodePath].map(command=>'[mcp_servers.helm]\ncommand = '+JSON.stringify(command)+'\nargs = ['+JSON.stringify(server)+']');
      let legacyAt=-1;
      if(s<0){
        const trimmed=content.trimEnd();
        for(const entry of legacyForms){
          if(trimmed.endsWith(entry)){
            const startAt=trimmed.length-entry.length;
            if(startAt===0||trimmed[startAt-1]==='\n')legacyAt=startAt;
          }
        }
        if(legacyAt<0&&/\[\s*mcp_servers\.(?:helm|"helm"|'helm')\s*\]/i.test(content))
          throw Error('Existing custom Codex Helm registration; refusing to overwrite it');
      }
      let next,changed=false;
      if(s>=0){
        changed=action==='uninstall';
        next=action==='install'?content:content.slice(0,s)+content.slice(e+END.length).replace(/^\n/,'');
      }else if(legacyAt>=0){
        changed=true;
        const left=content.slice(0,legacyAt).replace(/\s*$/,'');
        next=action==='install'?(left?left+'\n\n':'')+block+'\n':(left?left+'\n':'');
      }else{
        changed=action==='install';
        next=action==='install'?content+(content&&!content.endsWith('\n')?'\n':'')+(content?'\n':'')+block+'\n':content;
      }
      planned.push({target,file,previous,next,changed});
    }
  }
  if(dryRun)return {project,dryRun:true,changes:planned.map(({target,file,changed})=>({target,file,changed}))};
  const done=[],backups=[];
  try{
    for(const p of planned){if(!p.changed)continue;
      const b=backup(p.file,home);if(b)backups.push(b);
      if(p.previous===null&&p.next==='')continue;
      atomicWrite(p.file,p.next);done.push(p);
    }
  }catch(e){
    for(const p of done.reverse()){try{if(p.previous===null)fs.rmSync(p.file,{force:true});else atomicWrite(p.file,p.previous);}catch{/* keep backup for manual restoration */}}
    throw Error('Project MCP registration failed; previous files restored where possible. '+e.message);
  }
  return {project,dryRun:false,changes:planned.map(({target,file,changed})=>({target,file,changed})),backups};
}
