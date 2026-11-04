// Portable, dependency-free ZIP32 STORE writer for exact npm package file lists.
// Archives include dotfiles and use fixed timestamps for reproducible builds.
import fs from 'node:fs';
import path from 'node:path';
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
export function createReleaseZip(root, files, output){
  if(!Array.isArray(files)||!files.length)throw Error('no files to package');
  if(files.length>65535)throw Error('ZIP32 entry limit exceeded');
  const locals=[],centrals=[];let offset=0;
  const sorted=[...files].sort((a,b)=>a.localeCompare(b));
  const seen=new Set();
  for(const relative of sorted){
    if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('unsafe package path');
    const parts=relative.replaceAll('\\','/').split('/');
    if(parts.some(p=>!p||p==='.'||p==='..'||p.includes(':')))throw Error('unsafe package entry: '+relative);
    const key=parts.join('/');
    if(seen.has(key))throw Error('duplicate ZIP path '+key);
    seen.add(key);
    const data=fs.readFileSync(path.join(root,...parts));
    const name=Buffer.from('helm/'+key,'utf8');
    if(name.length>65535||data.length>0xffffffff)throw Error('ZIP32 entry too large');
    const crc=crc32(data),size=data.length;
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);
    local.writeUInt16LE(0,8);local.writeUInt16LE(0,10);local.writeUInt16LE(0x21,12);
    local.writeUInt32LE(crc,14);local.writeUInt32LE(size,18);local.writeUInt32LE(size,22);local.writeUInt16LE(name.length,26);
    locals.push(local,name,data);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(0x0314,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);
    central.writeUInt16LE(0,10);central.writeUInt16LE(0,12);central.writeUInt16LE(0x21,14);
    central.writeUInt32LE(crc,16);central.writeUInt32LE(size,20);central.writeUInt32LE(size,24);
    central.writeUInt16LE(name.length,28);central.writeUInt32LE(0o100644<<16,38);
    central.writeUInt32LE(offset,42);
    centrals.push(central,name);
    offset+=local.length+name.length+size;
    if(offset>0xffffffff)throw Error('ZIP32 offset limit exceeded');
  }
  const centralBytes=centrals.reduce((n,b)=>n+b.length,0);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);
  end.writeUInt32LE(centralBytes,12);end.writeUInt32LE(offset,16);
  if(offset+centralBytes>0xffffffff)throw Error('ZIP32 central directory too large');
  fs.writeFileSync(output,Buffer.concat([...locals,...centrals,end]));
  return {files:files.length,bytes:offset+centralBytes+end.length};
}
