import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createZipArchive, crc32 } from '../server/zip-release.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'helm-zip-test-'));
try {
  fs.mkdirSync(path.join(dir,'nested'));
  fs.writeFileSync(path.join(dir,'nested','file.md'),'hello zip');
  fs.writeFileSync(path.join(dir,'hello.txt'),'world');
  fs.writeFileSync(path.join(dir,'nested','unicode-κ.txt'),'UTF8');
  const out=path.join(dir,'release.zip');
  createZipArchive(dir,[{path:'hello.txt'},{path:'nested/file.md'},{path:'nested/unicode-κ.txt'}],out);
  const bytes=fs.readFileSync(out);let off=0;
  for(const [name,content] of [['helm/hello.txt','world'],['helm/nested/file.md','hello zip'],['helm/nested/unicode-κ.txt','UTF8']]){
    assert.equal(bytes.readUInt32LE(off),0x04034b50);
    const n=bytes.readUInt16LE(off+26),z=bytes.readUInt32LE(off+18),cs=bytes.readUInt32LE(off+14);
    assert.equal(bytes.subarray(off+30,off+30+n).toString(),name);
    const decoded=zlib.inflateRawSync(bytes.subarray(off+30+n,off+30+n+z));
    assert.equal(decoded.toString(),content);
    assert.equal(cs,crc32(decoded));off+=30+n+z;
  }
  assert.equal(bytes.readUInt32LE(off),0x02014b50);
  assert.throws(()=>createZipArchive(dir,['../evil'],out),/Unsafe/);
  console.log('Portable Windows/Linux/macOS ZIP packaging: PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
