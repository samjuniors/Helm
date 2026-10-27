#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'helm-init-safe-'));
const env = { ...process.env, GIT_AUTHOR_NAME:'Helm Test', GIT_AUTHOR_EMAIL:'helm@example.invalid', GIT_COMMITTER_NAME:'Helm Test', GIT_COMMITTER_EMAIL:'helm@example.invalid' };
function run(command, args, cwd) { const r=spawnSync(command,args,{cwd,env,encoding:'utf8'}); if(r.status!==0)throw Error(command+' '+args.join(' ')+' failed: '+(r.stderr||r.stdout)); return r.stdout; }
const git=(cwd,...args)=>run('git',args,cwd);
try {
  const dirty=path.join(tmp,'dirty'); mkdirSync(dirty); git(dirty,'init','-q','-b','main');
  writeFileSync(path.join(dirty,'README.md'),'Original user content\n'); git(dirty,'add','README.md'); git(dirty,'commit','-qm','Start project');
  writeFileSync(path.join(dirty,'unfinished.txt'),'Do not commit this user work\n'); writeFileSync(path.join(dirty,'README.md'),'Unfinished changes\n');
  const d=run(process.execPath,[path.join(root,'bin/helm.mjs'),'init',dirty,'--name','Existing app','--brief','Preserve the user files'],dirty);
  assert.match(d,/Not committed: existing changes were preserved/);
  assert.equal(git(dirty,'log','-1','--format=%s').trim(),'Start project');
  assert.ok(git(dirty,'status','--porcelain').includes('unfinished.txt'));
  assert.ok(git(dirty,'diff','--','README.md').includes('Unfinished changes'));
  console.log('PASS: dirty existing repository is not auto-committed');
  const clean=path.join(tmp,'clean'); mkdirSync(clean); git(clean,'init','-q','-b','main');
  const c=run(process.execPath,[path.join(root,'bin/helm.mjs'),'init',clean,'--name','Clean app','--brief','Initialize clean project'],clean);
  assert.match(c,/Committed\./);
  assert.equal(git(clean,'status','--porcelain').trim(),'');
  assert.ok(git(clean,'ls-files','.agents/product-kit/origin.json').includes('origin.json'));
  console.log('PASS: clean repository receives Helm setup commit');
} finally { rmSync(tmp,{recursive:true,force:true}); }
