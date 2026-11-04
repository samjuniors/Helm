// Idempotent per-user shell profile changes. Never modifies /etc or other users.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const START = '# >>> HELM MANAGED PATH >>>';
const END = '# <<< HELM MANAGED PATH <<<';
const BLOCK = START+'\nexport PATH="$HOME/.helm/bin:$PATH"\n'+END;
export function shellProfiles(home = os.homedir(), shell = process.env.SHELL || '') {
  const names=['.profile'];
  if (/zsh(?:$|[\\/])/.test(shell)) names.push('.zprofile');
  else if (/bash(?:$|[\\/])/.test(shell)) names.push('.bashrc');
  return names.map(name=>path.join(home,name));
}
export function modifyShellProfile(file, action, {dryRun=false}={}) {
  if(!['add','remove'].includes(action))throw new Error('invalid profile operation');
  if(fs.existsSync(file) && (!fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()))
    throw new Error('refusing to modify a symlink or non-file shell profile: '+file);
  const before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(action==='add'){
    if(before.includes(START)||before.includes(END)){
      if(before.includes(BLOCK)) return {changed:false,owned:true,file};
      throw new Error('existing Helm PATH block has been edited; review '+file);
    }
    if(before.includes('.helm/bin')||before.includes('.helm\\bin'))return {changed:false,owned:false,file};
    if(!dryRun){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,before+(before && !before.endsWith('\n')?'\n':'')+'\n'+BLOCK+'\n');}
    return {changed:true,owned:true,file};
  }
  if(!before.includes(BLOCK))return {changed:false,owned:false,file};
  if(!dryRun)fs.writeFileSync(file,before.replace('\n'+BLOCK+'\n','\n').replace(BLOCK+'\n',''));
  return {changed:true,owned:false,file};
}
export function ensureShellPath({home=os.homedir(),shell=process.env.SHELL||'',dryRun=false}={}){
  const results=shellProfiles(home,shell).map(file=>modifyShellProfile(file,'add',{dryRun}));
  return {files:results.filter(x=>x.owned).map(x=>x.file),changed:results.filter(x=>x.changed).map(x=>x.file)};
}
export function removeShellPath(files,{home=os.homedir(),dryRun=false}={}){
  const root=path.resolve(home);
  const safe=Array.isArray(files)?files.filter(f=>typeof f==='string'&&path.dirname(path.resolve(f))===root&&['.profile','.zprofile','.bashrc'].includes(path.basename(f))):[];
  return safe.map(file=>modifyShellProfile(file,'remove',{dryRun}));
}
