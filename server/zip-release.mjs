// Portable ZIP writer for npm-pack file lists (no zip executable or PowerShell required).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const lut=Array.from({length:256},(_,n)=>{let v=n;for(let i=0;i<8;i++)v=(v&1)?(0xedb88320^(v>>>1)):(v>>>1);return v>>>0;});
export function crc32(data){let v=0xffffffff;for(const b of data)v=lut[(v^b)&0xff]^(v>>>8);return (v^0xffffffff)>>>0;}
export function createZipArchive(root,entries,destination,prefix='helm'){
  if(!/^[a-z][a-z0-9-]*$/.test(prefix))throw Error('Invalid ZIP prefix');
  if(entries.length>65535)throw Error('Too many release entries');
  const body=[],central=[];let offset=0;const seen=new Set();
  for(const item of entries){
    const relative=String(typeof item==='string'?item:item.path).replaceAll('\\','/');
    if(!relative||relative.startsWith('/')||relative.split('/').some(x=>!x||x==='.'||x==='..')||/^[a-z]:/i.test(relative))throw Error('Unsafe ZIP member: '+relative);
    if(seen.has(relative))throw Error('Duplicate ZIP member: '+relative);seen.add(relative);
    const file=path.resolve(root,relative);
    if(!file.startsWith(path.resolve(root)+path.sep))throw Error('Unsafe ZIP path: '+relative);
    if(fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('Release member must be a regular file: '+relative);
    const name=Buffer.from(prefix+'/'+relative,'utf8'),content=fs.readFileSync(file),packed=zlib.deflateRawSync(content,{level:9});
    if(name.length>65535||content.length>0xffffffff||packed.length>0xffffffff)throw Error('ZIP member too large: '+relative);
    const checksum=crc32(content),local=Buffer.alloc(30),cd=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);
    local.writeUInt16LE(8,8);local.writeUInt16LE(0,10);local.writeUInt16LE(33,12);
    local.writeUInt32LE(checksum,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(name.length,26);
    cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(0x0314,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x0800,8);
    cd.writeUInt16LE(8,10);cd.writeUInt16LE(0,12);cd.writeUInt16LE(33,14);cd.writeUInt32LE(checksum,16);
    cd.writeUInt32LE(packed.length,20);cd.writeUInt32LE(content.length,24);cd.writeUInt16LE(name.length,28);
    cd.writeUInt32LE((0o100644<<16)>>>0,38);cd.writeUInt32LE(offset,42);
    body.push(local,name,packed);central.push(cd,name);offset+=local.length+name.length+packed.length;
    if(offset>0xffffffff)throw Error('ZIP archive larger than 4 GiB');
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  fs.writeFileSync(destination,Buffer.concat([...body,...central,end]));
}
