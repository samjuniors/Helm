#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(path.join(os.tmpdir(),'helm-rename-'));
try{
 const dst=path.join(tmp,'copy');mkdirSync(dst);
 for(const item of ['bin','rename.mjs'])cpSync(path.join(root,item),path.join(dst,item),{recursive:true});
 let r=spawnSync(process.execPath,[path.join(dst,'rename.mjs'),'--name','helm','--dry-run'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(existsSync(path.join(dst,'.plugin-name')),false);
 r=spawnSync(process.execPath,[path.join(dst,'rename.mjs'),'--name','helm'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(readFileSync(path.join(dst,'.plugin-name'),'utf8'),'helm\n');
 console.log('Rename existing-name marker and dry-run: 2/2 PASS');
}finally{rmSync(tmp,{recursive:true,force:true})}
