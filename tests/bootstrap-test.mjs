// Bootstrap acceptance: isolated Unix install without public network or real MCP clients.
// Windows parses PowerShell syntax; actual hosted-release PowerShell bootstrap is also
// smoke tested separately on a disposable environment before publication.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bootSh=path.join(root,'scripts','bootstrap.sh');
const bootPs=path.join(root,'scripts','bootstrap.ps1');
assert.ok(fs.existsSync(bootSh)&&fs.existsSync(bootPs));
let count=0;
const pass=(name)=>{count++;console.log('  PASS '+name)};
const output=(r)=>(r.stdout||'')+(r.stderr||'');
if (process.platform === 'win32') {
  const cmd=[
    "$tokens=$null;$parseErrors=$null;",
    "$null=[System.Management.Automation.Language.Parser]::ParseFile(",
    "'"+bootPs.replace(/'/g,"''")+"', [ref]$tokens,[ref]$parseErrors);",
    "if($parseErrors.Count){$parseErrors|ForEach-Object{Write-Error $_.Message};exit 1}",
  ].join('');
  const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,'Bootstrap PowerShell syntax failed: '+output(r));
  pass('PowerShell bootstrap parses on Windows');
} else {
  const lint=spawnSync('sh',['-n',bootSh],{encoding:'utf8',timeout:10000});
  assert.equal(lint.status,0,'Shell bootstrap syntax failed: '+output(lint));
  pass('POSIX bootstrap passes shell syntax check');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'helm-bootstrap-fixture-'));
  try {
    const home=path.join(temp,'home');
    const bin=path.join(temp,'bin');
    const fixtures=path.join(temp,'release-fixtures');
    fs.mkdirSync(home,{recursive:true});fs.mkdirSync(bin);fs.mkdirSync(fixtures);
    const archive=spawnSync('npm',['pack','--ignore-scripts','--pack-destination',fixtures],{
      cwd:root,encoding:'utf8',timeout:25000,
    });
    assert.equal(archive.status,0,'npm pack failed '+output(archive));
    const pkg=path.join(fixtures,'samjuniors-helm-0.10.0.tgz');
    const releaseFile=path.join(fixtures,'helm-v0.10.0.tgz');
    fs.renameSync(pkg,releaseFile);
    const digest=crypto.createHash('sha256').update(fs.readFileSync(releaseFile)).digest('hex');
    fs.writeFileSync(path.join(fixtures,'SHA256SUMS'),digest+'  helm-v0.10.0.tgz\n');
    fs.writeFileSync(path.join(fixtures,'release.json'),JSON.stringify({
      tag_name:'v0.10.0',draft:false,prerelease:false,
      assets:[{name:'helm-v0.10.0.tgz'},{name:'SHA256SUMS'}],
    }));
    const fakeCurl=[
      '#!/bin/sh',
      'out=',
      'url=',
      'next=',
      'for arg in "$@"; do',
      '  if [ "$next" = 1 ]; then out="$arg"; next=; fi',
      '  if [ "$arg" = "-o" ]; then next=1; fi',
      '  case "$arg" in https://*) url="$arg" ;; esac',
      'done',
      'case "$url" in',
      '  */releases/latest) src="$HELM_FIXTURE_DIR/release.json" ;;',
      '  */SHA256SUMS) src="$HELM_FIXTURE_DIR/SHA256SUMS" ;;',
      '  */helm-v0.10.0.tgz) src="$HELM_FIXTURE_DIR/helm-v0.10.0.tgz" ;;',
      '  *) echo "Unexpected curl URL" >&2; exit 1 ;;',
      'esac',
      'test -n "$out" || exit 1',
      'cp "$src" "$out"',
    ].join('\n')+'\n';
    fs.writeFileSync(path.join(bin,'curl'),fakeCurl,{mode:0o755});
    const env={...process.env,HOME:home,USERPROFILE:home,HELM_FIXTURE_DIR:fixtures,
      PATH:[bin,path.dirname(process.execPath),'/usr/bin','/bin'].join(path.delimiter)};
    const run=(args)=>spawnSync('sh',[bootSh,...args],{env,encoding:'utf8',timeout:30000,cwd:temp});
    const preview=run(['--dry-run','--host','codex']);
    assert.equal(preview.status,0,'Bootstrap preview failed '+output(preview));
    assert.ok(!fs.existsSync(path.join(home,'.helm','install.json')));
    pass('POSIX first-time bootstrap preview changes nothing');
    const installed=run(['--host','codex']);
    assert.equal(installed.status,0,'POSIX first-time install failed '+output(installed));
    const plugin=path.join(home,'.helm','plugin');
    const state=JSON.parse(fs.readFileSync(path.join(home,'.helm','install.json'),'utf8'));
    assert.equal(state.version,'0.10.0');
    assert.equal(state.host,'codex');
    assert.ok(fs.existsSync(path.join(plugin,'server','mcp.mjs')));
    pass('POSIX bootstrap verifies the release and installs managed Helm');
    const launcher=path.join(home,'.helm','bin','helm');
    const v=spawnSync(launcher,['version'],{env,encoding:'utf8',timeout:10000});
    assert.equal(v.status,0,'Installed launcher failed '+output(v));
    assert.match(output(v),/Helm 0\.10\.0/);
    pass('POSIX installed launcher works');
    const remove=spawnSync(launcher,['uninstall','--yes'],{env,encoding:'utf8',timeout:20000});
    assert.equal(remove.status,0,'Installed CLI uninstall failed '+output(remove));
    assert.ok(!fs.existsSync(plugin) && !fs.existsSync(launcher));
    pass('POSIX bootstrap-installed Helm uninstalls cleanly');
  } finally {
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
console.log(count+'/'+count+' bootstrap acceptance checks passed');
