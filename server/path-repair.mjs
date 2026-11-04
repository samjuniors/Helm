// Only Helm-owned PATH snippets in user startup files. Never reads or changes secrets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
const BEGIN='# >>> Helm PATH (managed) >>>',END='# <<< Helm PATH (managed) <<<';
const allowed=['.bashrc','.zshrc','.profile',path.join('.config','fish','conf.d','helm.fish')];
export function defaultProfile(home=os.homedir(),shell=process.env.SHELL||''){
  const name=path.basename(shell).toLowerCase();
  return path.join(home,name==='zsh'?'.zshrc':name==='fish'?allowed[3]:name==='bash'?'.bashrc':'.profile');
}
const body=(fish)=> (fish
  ? [BEGIN,'if not contains "$HOME/.helm/bin" $PATH','    set -gx PATH "$HOME/.helm/bin" $PATH','end',END]
  : [BEGIN,'case ":$PATH:" in','  *":$HOME/.helm/bin:"*) ;;','  *) export PATH="$HOME/.helm/bin:$PATH" ;;','esac',END]).join('\n');
export function managePosixPath({home=os.homedir(),shell=process.env.SHELL||'',profile=null,action='add',dryRun=false}={}){
  if(process.platform==='win32')throw Error('POSIX PATH repair does not apply on Windows');
  if(!['add','remove'].includes(action))throw Error('Invalid PATH action');
  const homeDir=path.resolve(home),file=path.resolve(profile||defaultProfile(homeDir,shell));
  if(!allowed.some(rel=>file===path.join(homeDir,rel)))throw Error('Only a known shell profile inside the user home may be changed');
  if(fs.existsSync(file)&&!fs.lstatSync(file).isFile())throw Error('Refusing to touch a non-regular or linked shell profile: '+file);
  const previous=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  const markerPresent=previous.includes(BEGIN)||previous.includes(END);
  const block=body(file.endsWith('.fish'));
  if(markerPresent&&!previous.includes(block))throw Error('Helm PATH section was customized: review '+file+' before repairing');
  if(action==='add'&&previous.includes(block))return {changed:false,profile:file,backup:null};
  if(action==='remove'&&!markerPresent)return {changed:false,profile:file,backup:null};
  const next=action==='add'?(previous+(previous&&!previous.endsWith('\n')?'\n':'')+(previous?'\n':'')+block+'\n')
    :previous.replace(block+'\n','').replace(block,'');
  if(dryRun)return {changed:next!==previous,profile:file,backup:null,preview:true};
  let backup=null;
  if(previous){
    const backupDir=path.join(homeDir,'.helm','backups');fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
    backup=path.join(backupDir,path.basename(file)+'-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex')+'.bak');
    fs.copyFileSync(file,backup);fs.chmodSync(backup,0o600);
  }
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+'.helm-tmp-'+crypto.randomBytes(6).toString('hex');
  try{
    fs.writeFileSync(temp,next,{mode:fs.existsSync(file)?fs.statSync(file).mode:0o600});
    fs.renameSync(temp,file);
  }finally{if(fs.existsSync(temp))fs.rmSync(temp,{force:true});}
  return {changed:true,profile:file,backup};
}
