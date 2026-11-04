import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { managePosixPath, defaultProfile } from '../server/path-repair.mjs';
if(process.platform==='win32') {
  console.log('POSIX shell repair skipped on Windows: Windows registry PATH tests cover this host');
} else {
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'helm-path-test-'));
  try {
    const bash=defaultProfile(home,'/bin/bash');
    assert.equal(bash,path.join(home,'.bashrc'));
    fs.writeFileSync(bash,'# keep custom settings\n');
    const preview=managePosixPath({home,shell:'bash',dryRun:true});
    assert.equal(preview.changed,true);
    assert.equal(fs.readFileSync(bash,'utf8'),'# keep custom settings\n');
    const added=managePosixPath({home,shell:'bash'});
    assert.equal(added.changed,true);
    assert.ok(fs.readFileSync(bash,'utf8').includes('# >>> Helm PATH'));
    assert.equal(managePosixPath({home,shell:'bash'}).changed,false);
    const removed=managePosixPath({home,shell:'bash',action:'remove'});
    assert.equal(removed.changed,true);
    assert.ok(fs.readFileSync(bash,'utf8').startsWith('# keep custom settings\n'));
    const fish=managePosixPath({home,shell:'fish'});
    assert.ok(fs.readFileSync(fish.profile,'utf8').includes('set -gx PATH'));
    const zsh=managePosixPath({home,shell:'zsh'});
    fs.writeFileSync(zsh.profile,fs.readFileSync(zsh.profile,'utf8').replace('export PATH=','export PATH=/unexpected'));
    assert.throws(()=>managePosixPath({home,shell:'zsh',action:'remove'}),/customized/);
    assert.throws(()=>managePosixPath({home,profile:path.join(home,'mine')}),/known shell profile/);
    console.log('POSIX PATH repair, preview, backups, idempotence and customized-file refusal: PASS');
  }finally{fs.rmSync(home,{recursive:true,force:true});}
}
