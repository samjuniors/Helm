import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manageProjectMcp } from '../server/project-mcp.mjs';
const home=fs.mkdtempSync(path.join(os.tmpdir(),'helm-project-mcp-'));
try {
  const project=path.join(home,'one'),server=path.join(home,'server.mjs');
  fs.mkdirSync(project);fs.writeFileSync(server,'// server');
  const claude=path.join(project,'.mcp.json'),codex=path.join(project,'.codex','config.toml');
  fs.mkdirSync(path.dirname(codex));
  fs.writeFileSync(claude,JSON.stringify({mcpServers:{thirdparty:{command:'do-not-touch'}}}));
  fs.writeFileSync(codex,'model = "test"\n');
  const input={projectDir:project,serverPath:server,home};
  const before=fs.readFileSync(claude,'utf8');
  assert.equal(manageProjectMcp({...input,dryRun:true}).changes.length,2);
  assert.equal(fs.readFileSync(claude,'utf8'),before);
  manageProjectMcp(input);
  const m=JSON.parse(fs.readFileSync(claude,'utf8'));
  assert.equal(m.mcpServers.helm.command,process.execPath);
  assert.deepEqual(m.mcpServers.helm.args,[server]);
  assert.equal(m.mcpServers.thirdparty.command,'do-not-touch');
  assert.match(fs.readFileSync(codex,'utf8'),/mcp_servers\.helm/);
  assert.ok(manageProjectMcp(input).changes.every(z=>!z.changed));
  manageProjectMcp({...input,action:'uninstall'});
  assert.equal(JSON.parse(fs.readFileSync(claude,'utf8')).mcpServers.thirdparty.command,'do-not-touch');
  assert.doesNotMatch(fs.readFileSync(codex,'utf8'),/mcp_servers\.helm/);
  fs.writeFileSync(claude,JSON.stringify({mcpServers:{helm:{command:'other',args:[]}}}));
  assert.throws(()=>manageProjectMcp(input),/custom Claude/);
  assert.ok(fs.existsSync(path.join(home,'.helm','backups')));
  // Existing Helm-generated project adapters used unmarked Codex and "node".
  const old=path.join(home,'legacy');fs.mkdirSync(old);fs.mkdirSync(path.join(old,'.codex'));
  fs.writeFileSync(path.join(old,'.mcp.json'),JSON.stringify({mcpServers:{helm:{command:'node',args:[server]}}}));
  fs.writeFileSync(path.join(old,'.codex','config.toml'),'model = "original"\n\n[mcp_servers.helm]\ncommand = "node"\nargs = ['+JSON.stringify(server)+']\n');
  const migrated=manageProjectMcp({...input,projectDir:old});
  assert.equal(migrated.changes.filter(x=>x.changed).length,2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(old,'.mcp.json'),'utf8')).mcpServers.helm.command,process.execPath);
  assert.match(fs.readFileSync(path.join(old,'.codex','config.toml'),'utf8'),/Helm project MCP \(managed\)/);
  manageProjectMcp({...input,projectDir:old,action:'uninstall'});
  assert.doesNotMatch(fs.readFileSync(path.join(old,'.codex','config.toml'),'utf8'),/mcp_servers\.helm/);
  assert.match(fs.readFileSync(path.join(old,'.codex','config.toml'),'utf8'),/model = "original"/);
  const custom=path.join(home,'custom');fs.mkdirSync(path.join(custom,'.codex'),{recursive:true});
  fs.writeFileSync(path.join(custom,'.codex','config.toml'),'[mcp_servers.helm]\ncommand = "python"\nargs = ["other"]\n');
  assert.throws(()=>manageProjectMcp({...input,projectDir:custom,host:'codex'}),/custom Codex/);

  // Symlinked directories and dangling linked config files must never be followed.
  const linked=path.join(home,'linked'),outside=path.join(home,'outside');
  fs.mkdirSync(linked);fs.mkdirSync(outside);
  fs.symlinkSync(outside,path.join(linked,'.codex'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>manageProjectMcp({...input,projectDir:linked,host:'codex'}),/linked or non-directory/);
  assert.equal(fs.readdirSync(outside).length,0);
  const dangling=path.join(home,'dangling');fs.mkdirSync(dangling);
  fs.symlinkSync(path.join(home,'missing-mcp.json'),path.join(dangling,'.mcp.json'),'file');
  assert.throws(()=>manageProjectMcp({...input,projectDir:dangling,host:'claude'}),/linked or non-file/);

  console.log('Project MCP scoped installation, uninstall, backup and conflict guards: PASS');
}finally{fs.rmSync(home,{recursive:true,force:true});}
