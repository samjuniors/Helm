#!/usr/bin/env node
// helm command line: set up a project, print MCP configuration for your tool, and run the founder-only commands.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PLUGIN_ROOT, initProject, kitDirOf, resolveProject, readRuns, describeRun, approveRun, cancelRun, statusOf, upgradeProject, pluginVersion } from '../server/runtime.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, pos = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; flags[k] = v; } else pos.push(rest[i]); }
const server = path.join(PLUGIN_ROOT, 'server', 'mcp.mjs');
const project = () => resolveProject(flags.path || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const die = (m) => { console.error(`helm: ${m}`); process.exit(1); };

try {
  if (cmd === 'init') {
    const r = initProject({ path: pos[0] || '.', project: flags.name, brief: typeof flags.brief === 'string' ? flags.brief : '' });
    console.log(`Kit created in ${r.root}/${r.kit}. ${r.validate}${r.committed ? ' Committed.' : ' Not committed (set git user.name/email).'}\nNext: read TODO-MAP.md in the plugin folder, fill ${r.kit}/VISION.md, then run your agent and say "continue".`);
  } else if (cmd === 'print-config') {
    const host = flags.host || 'all', abs = server;
    const s = {
      claude: `# Claude Code (project or user): run once\nclaude mcp add helm -- node ${JSON.stringify(abs)}\n# or install the whole plugin (hook, commands, sub-agents, skill): see README.md`,
      codex: `# Codex: add to ~/.codex/config.toml\n[mcp_servers.helm]\ncommand = "node"\nargs = [${JSON.stringify(abs)}]`,
      vscode: `# VS Code: .vscode/mcp.json\n${JSON.stringify({ servers: { 'helm': { type: 'stdio', command: 'node', args: [abs] } } }, null, 2)}`,
      cursor: `# Cursor: .cursor/mcp.json\n${JSON.stringify({ mcpServers: { 'helm': { command: 'node', args: [abs] } } }, null, 2)}`,
    };
    console.log((host === 'all' ? Object.values(s) : [s[host] ?? die(`host must be one of ${Object.keys(s).join(', ')}`)]).join('\n\n') + '\n\nNOT VERIFIED: these file formats are from memory of each tool\'s documentation; if your tool rejects one, check its MCP page. The server speaks standard MCP over stdio.');
  } else if (cmd === 'runs') {
    const runs = readRuns(project()); console.log(runs.length ? runs.map(describeRun).join('\n\n---\n') : 'no runs yet');
  } else if (cmd === 'approve') {
    const r = approveRun(project(), pos[0]); console.log(`Started ${r.id}. The agent is running in ${r.cwd}.`);
  } else if (cmd === 'watch') {
    const p = project(); const once = !!flags.once; const every = Math.max(1, Number(flags.interval) || 2) * 1000;
    const tail = (f, n) => { try { return readFileSync(f, 'utf8').trim().split('\n').slice(-n).join('\n'); } catch { return ''; } };
    const frame = () => {
      const r = spawnSync(process.execPath, [path.join(kitDirOf(p), 'kit.mjs'), 'recover', '--hook'], { cwd: p, encoding: 'utf8' });
      const runs = readRuns(p).slice(-8);
      const rows = runs.map((x) => { const s = statusOf(x); const el = x.startedAt ? `${Math.round(((s.endedAt ? new Date(s.endedAt) : Date.now()) - new Date(x.startedAt)) / 1000)}s` : '-'; return `${x.id.padEnd(18)} ${x.role.padEnd(11)} ${x.step.padEnd(8)} ${s.status.padEnd(18)} ${el.padStart(6)}  ${x.landed ? 'landed' : ''}`; });
      const live = runs.filter((x) => statusOf(x).status === 'running').map((x) => `--- ${x.role} ${x.step} log ---\n${tail(x.logFile, 3)}`);
      return `${once ? '' : '\x1b[2J\x1b[H'}helm watch  ${new Date().toLocaleTimeString()}  ${p}  (Ctrl+C to stop)\n\n${(r.stdout || r.stderr || '').trim()}\n\nHelper agent runs (newest last):\n${rows.length ? rows.join('\n') : '  none yet'}${live.length ? `\n\n${live.join('\n')}` : ''}\n`;
    };
    if (once) console.log(frame()); else { console.log(frame()); setInterval(() => process.stdout.write(frame()), every); await new Promise(() => {}); }
  } else if (cmd === 'cancel') {
    console.log(describeRun(cancelRun(project(), pos[0])));
  } else if (cmd === 'upgrade-project') {
    console.log(upgradeProject(flags.path || process.cwd(), { force: !!flags.force }));
  } else if (cmd === 'version') {
    console.log('Helm ' + pluginVersion());
  } else if (cmd === 'download') {
    const r = spawnSync(process.execPath, [path.join(PLUGIN_ROOT, 'download.mjs'), ...rest], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  } else if (cmd === 'hook-recover') {
    const p = flags.path || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!existsSync(path.join(kitDirOf(path.resolve(p)), 'kit.mjs'))) { console.log('helm: no kit in this folder. To start one, ask: "set up the product kit for <name>" (tool kit_init).'); process.exit(0); }
    const r = spawnSync(process.execPath, [path.join(kitDirOf(path.resolve(p)), 'kit.mjs'), 'recover', '--hook'], { cwd: p, encoding: 'utf8' });
    console.log((r.stdout || r.stderr || '').trim());
  } else if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`helm\n  init [dir] --name NAME --brief TEXT   create the kit in a project\n  print-config [--host claude|codex|vscode|cursor]   MCP config for your tool\n  version | download [--version X.Y.Z] | upgrade-project [--path DIRECTORY]\n  watch [--once] [--interval 2]   live view: where you are, helper runs and their logs\n  runs | approve <runId> | cancel <runId>   helper agent runs (approve is founder-only)\n  ack <KEY> --quote "..." | decide <ID> --quote "..." | milestone close <M> --quote "..."   founder-only, run in a terminal\n  anything else is passed to the project's kit.mjs (continue, recover, status, ...)`);
  } else {
    const p = project();
    const r = spawnSync(process.execPath, [path.join(kitDirOf(p), 'kit.mjs'), cmd, ...rest], { cwd: p, stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
} catch (e) { die(e.user ? e.message : e.stack); }
