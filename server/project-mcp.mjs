// Only Helm-owned per-project Codex MCP blocks are edited.
import fs from 'node:fs';
import path from 'node:path';
export function codexProjectFile(projectDir) { return path.join(path.resolve(projectDir), '.codex', 'config.toml'); }
function names(name) {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(name)) throw new Error('unsafe MCP server name');
  return { header: '[mcp_servers.' + name + ']', marker: '# HELM-MANAGED-MCP:' + name };
}
export function projectCodexStatus(projectDir, name = 'helm') {
  const file = codexProjectFile(projectDir), {header,marker} = names(name);
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const index = text.indexOf(header);
  if (index < 0) return {status:'absent',file};
  return {status: text.slice(0,index).trimEnd().endsWith(marker) ? 'managed' : 'foreign',file};
}
export function registerProjectCodex(projectDir, server, node = process.execPath, name = 'helm', {dryRun = false} = {}) {
  const {status,file} = projectCodexStatus(projectDir,name);
  if (status === 'foreign') throw new Error('Codex project already defines '+name+'; will not overwrite its configuration');
  if (status === 'managed') return {status:'already-managed',file};
  if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) throw new Error('project folder does not exist');
  if (!path.isAbsolute(server) || !path.isAbsolute(node)) throw new Error('MCP executable and server must use absolute paths');
  if (dryRun) return {status:'would-register',file};
  const {header,marker} = names(name), existing = fs.existsSync(file) ? fs.readFileSync(file,'utf8') : '';
  const block = marker+'\n'+header+'\ncommand = '+JSON.stringify(node)+'\nargs = ['+JSON.stringify(server)+']\n';
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,existing+(existing && !existing.endsWith('\n')?'\n':'')+(existing?'\n':'')+block);
  return {status:'registered',file};
}
export function unregisterProjectCodex(projectDir, name = 'helm', {dryRun = false} = {}) {
  const {status,file}=projectCodexStatus(projectDir,name);
  if(status==='foreign')throw new Error('Codex project registration is not Helm-managed; leave it unchanged');
  if(status==='absent')return {status:'already-absent',file};
  const text=fs.readFileSync(file,'utf8'),{header,marker}=names(name);
  const needle=marker+'\n'+header+'\n';
  let at=text.indexOf(needle);
  if(at<0||(at!==0&&text[at-1]!=='\n'))throw new Error('managed Codex block is malformed; review it manually');
  const after=at+needle.length;
  let end=text.indexOf('\n[',after);
  if(end<0)end=text.length;
  // A Helm marker is not permission to destroy user changes inside the block.
  // We own exactly command and a single args entry; reject other keys or values.
  const rows=text.slice(after,end).trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let valid=false;
  if(rows.length===2 && rows[0].startsWith('command = ') && rows[1].startsWith('args = ')){
    try{
      const command=JSON.parse(rows[0].slice('command = '.length));
      const args=JSON.parse(rows[1].slice('args = '.length));
      valid=typeof command==='string'&&path.isAbsolute(command)&&
        Array.isArray(args)&&args.length===1&&typeof args[0]==='string'&&
        path.isAbsolute(args[0])&&args[0].replaceAll('\\','/').endsWith('/server/mcp.mjs');
    }catch{valid=false;}
  }
  if(!valid)throw new Error('Helm-managed Codex block was customized; refusing to remove custom project settings');
  if(dryRun)return {status:'would-unregister',file};
  const next=text.slice(0,at)+text.slice(end===text.length?end:end+1);
  fs.writeFileSync(file,next.replace(/^\n/,''));
  return {status:'unregistered',file};
}
