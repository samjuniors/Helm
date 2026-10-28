#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=mkdtempSync(path.join(os.tmpdir(),'helm-041-upgrade-'));
try{
 const old=path.join(temp,'installed');mkdirSync(old);
 for(const file of ['package.json','server/mcp.mjs']){const to=path.join(old,file);mkdirSync(path.dirname(to),{recursive:true});cpSync(path.join(root,file),to)}
 const p=JSON.parse(readFileSync(path.join(old,'package.json'),'utf8'));
 p.version='0.4.0';writeFileSync(path.join(old,'package.json'),JSON.stringify(p));
 mkdirSync(path.join(old,'bin'));writeFileSync(path.join(old,'bin','helm.mjs'),'// existing Helm CLI');
 const update=spawnSync(process.execPath,[path.join(root,'update.mjs'),'--into',old],{cwd:root,encoding:'utf8'});
 assert.equal(update.status,0,update.stderr||update.stdout);
 assert.equal(JSON.parse(readFileSync(path.join(old,'package.json'))).version,'0.4.1');
 assert.equal(readFileSync(path.join(old,'.plugin-name'),'utf8').trim(),'helm');
 console.log('PASS: existing Helm 0.4.0 upgrades to 0.4.1 and preserves identity');
 const repeat=spawnSync(process.execPath,[path.join(root,'update.mjs'),'--into',old],{cwd:root,encoding:'utf8'});
 assert.equal(repeat.status,0,repeat.stderr);assert.match(repeat.stdout,/Already at/);
 console.log('PASS: repeated upgrade is a no-op');
}finally{rmSync(temp,{recursive:true,force:true})}
