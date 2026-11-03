// Cross-platform CLI lifecycle acceptance, fully isolated from real host apps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-lifecycle-cli-'));
const home = path.join(temp, 'fake-user-home');
const extracted = path.join(temp, 'release-folder');
const target = path.join(home, '.helm', 'plugin');
const record = path.join(home, '.helm', 'install.json');
const launcher = path.join(home, '.helm', 'bin', process.platform === 'win32' ? 'helm.cmd' : 'helm');
const cleanPath = [path.dirname(process.execPath), ...(process.platform === 'win32' ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin'])].join(path.delimiter);
const env = { ...process.env, HOME:home, USERPROFILE:home, APPDATA:path.join(home,'AppData','Roaming'),
  LOCALAPPDATA:path.join(home,'AppData','Local'), PATH:cleanPath };
const output = (r) => (r.stdout || '') + (r.stderr || '');
const invoke = (dir, args) => spawnSync(process.execPath,[path.join(dir,'bin','helm.mjs'),...(args[0]==='install' ? [...args,'--no-path'] : args)],{
  env, encoding:'utf8', timeout:30000, cwd:temp,
});
const check = (r, title) => assert.equal(r.status,0,title + ': ' + output(r));
let count=0;
const pass=(s)=>{count++;console.log('  PASS '+s)};
try {
  fs.mkdirSync(home,{recursive:true});
  fs.cpSync(root,extracted,{recursive:true,filter:(p)=>{
    const relative=path.relative(root,p);
    return !/(^|[\\/])(\.git|dist|node_modules)([\\/]|$)/.test(relative);
  }});
  const before = fs.readdirSync(home);
  check(invoke(extracted,['install','--dry-run','--host','codex']),'install preview');
  assert.deepEqual(fs.readdirSync(home),before);
  pass('helm install --dry-run cannot alter installation or MCP settings');

  check(invoke(extracted,['install','--host','codex']),'managed install');
  assert.equal(JSON.parse(fs.readFileSync(record,'utf8')).host,'codex');
  assert.equal(JSON.parse(fs.readFileSync(record,'utf8')).version,'0.10.0');
  assert.ok(fs.existsSync(target) && fs.existsSync(launcher));
  pass('helm install creates recorded managed installation and launcher');

  const version=invoke(target,['version']);
  check(version,'installed CLI version');
  assert.match(output(version),/Helm 0\.10\.0/);
  pass('installed launcher source reports correct version');

  check(invoke(target,['install']),'repeated install');
  assert.equal(JSON.parse(fs.readFileSync(record,'utf8')).version,'0.10.0');
  pass('repeated install is idempotent');

  const userFile=path.join(home,'.helm','my-project-notes.txt');
  fs.writeFileSync(userFile,'PRESERVE');
  check(invoke(target,['uninstall','--dry-run']),'uninstall preview');
  assert.ok(fs.existsSync(target) && fs.existsSync(record));
  pass('helm uninstall --dry-run preserves installation');

  const bad=invoke(target,['uninstall','--dir',home,'--yes']);
  assert.notEqual(bad.status,0);
  assert.ok(fs.existsSync(target));
  pass('uninstall refuses arbitrary directory options');

  const remove=spawnSync(launcher,['uninstall','--yes'],{ shell:true, env, encoding:'utf8', timeout:30000, cwd:temp });
  check(remove,'managed uninstall via actual launcher');
  assert.ok(!fs.existsSync(target) && !fs.existsSync(record));
  assert.equal(fs.readFileSync(userFile,'utf8'),'PRESERVE');
  pass('helm uninstall removes only recorded managed files, preserving user notes');

  check(invoke(extracted,['install','--host','codex']),'reinstall');
  assert.ok(fs.existsSync(target) && fs.existsSync(record));
  pass('CLI supports clean install again after uninstall');

  const cloned = path.join(temp,'source-checkout');
  fs.cpSync(extracted,cloned,{recursive:true});
  fs.mkdirSync(path.join(cloned,'.git'),{recursive:true});
  const sourceUpdate=invoke(cloned,['update','--check']);
  assert.notEqual(sourceUpdate.status,0);
  assert.match(output(sourceUpdate),/Git source checkout/);
  assert.ok(fs.existsSync(target));
  pass('source-clone self-update remains refused; no managed install touched');

  console.log(count+'/'+count+' isolated CLI lifecycle checks passed');
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
