#!/usr/bin/env node
// helm command line: set up a project, print MCP configuration for your tool, and run the founder-only commands.
import path from 'node:path';
import { runSelfUpdate } from '../server/self-update.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scanProject, guard, consult, writeState, adoptProject, agreeConsult, writeRules } from '../server/advisor.mjs';
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
    writeRules(r.root, { commit: r.committed });
    console.log(`Kit created in ${r.root}/${r.kit}. ${r.validate}${r.committed ? ' Committed.' : r.commitSkipped ? ' Not committed: existing changes were preserved; review and commit Helm files yourself.' : ' Not committed (check git user.name/email).'}\nNext: read TODO-MAP.md in the plugin folder, fill ${r.kit}/VISION.md, then run your agent and say "continue".`);
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
  } else if (cmd === 'upgrade-project') {
    console.log(upgradeProject(flags.path || process.cwd(), { force: !!flags.force }));
  } else if (cmd === 'scan') {
    const target = path.resolve(pos[0] || flags.path || process.env.CLAUDE_PROJECT_DIR || process.cwd());
    console.log(scanProject(target));
    if (existsSync(path.join(kitDirOf(target), 'kit.mjs'))) {
      console.log('\n--- the kit\'s own scan: hints for milestone M0 and suggested checks ---');
      const r = spawnSync(process.execPath, [path.join(kitDirOf(target), 'kit.mjs'), 'scan', ...(flags['write-config'] ? ['--write-config'] : [])], { cwd: target, stdio: 'inherit' });
      process.exit(r.status ?? 0);
    }
    console.log('\nNo kit in this folder (that is fine for scanning). Before changing anything: "guard baseline". To manage the work as a roadmap: "init".');
  } else if (cmd === 'guard') {
    const r = guard(flags.path || process.cwd(), { action: pos[0] || 'check', only: typeof flags.only === 'string' ? flags.only.split(',').map((x) => x.trim()).filter(Boolean) : undefined, checks: typeof flags.checks === 'string' ? flags.checks.split(',').map((x) => x.trim()).filter(Boolean) : undefined });
    console.log(r.text); process.exit(r.code);
  } else if (cmd === 'consult') {
    const sub = pos[0] || 'list';
    if (sub === 'agree') { console.log(agreeConsult(flags.path || process.cwd(), pos[1], flags.quote)); }
    else {
      if (!['show', 'list'].includes(sub)) die('consult records are written by your agent through the kit_consult tool. From the terminal: consult list | consult show [id] | consult agree [id] --quote "your words" (only you can agree)');
      console.log(consult(flags.path || process.cwd(), { action: sub, id: pos[1] }));
    }
  } else if (cmd === 'rules') {
    const r = writeRules(pos[0] || flags.path || process.cwd(), { commit: !!flags.commit });
    console.log(r.changed ? `Wrote the helm rules block into ${r.file}${flags.commit ? ' and committed it' : '. Commit it'}. Codex and Antigravity read AGENTS.md.` : 'AGENTS.md already has the current helm rules.');
  } else if (cmd === 'state') {
    const show = pos[0] === 'show'; const r = writeState((show ? pos[1] : pos[0]) || flags.path || process.cwd(), { dryRun: show });
    console.log(show ? r.text : `${r.changed ? 'Wrote' : 'No change in'} ${r.file}. Commit it.\n\n${r.text}`);
  } else if (cmd === 'adopt') {
    console.log(adoptProject(pos[0] || flags.path || process.cwd(), { name: flags.name, brief: flags.brief }));
  } else if (cmd === 'version') {
    console.log('Helm ' + pluginVersion());
  } else if (cmd === 'update') {
    await runSelfUpdate({ args: rest, pluginRoot: PLUGIN_ROOT });
  } else if (cmd === 'download') {
    const r = spawnSync(process.execPath, [path.join(PLUGIN_ROOT, 'download.mjs'), ...rest], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  } else if (cmd === 'cancel') {
    console.log(describeRun(cancelRun(project(), pos[0])));
  } else if (cmd === 'hook-recover') {
    const p = flags.path || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    if (!existsSync(path.join(kitDirOf(path.resolve(p)), 'kit.mjs'))) { console.log('helm: no kit in this folder. To start one, ask: "set up the product kit for <name>" (tool kit_init).'); process.exit(0); }
    const r = spawnSync(process.execPath, [path.join(kitDirOf(path.resolve(p)), 'kit.mjs'), 'recover', '--hook'], { cwd: p, encoding: 'utf8' });
    console.log((r.stdout || r.stderr || '').trim());
  } else if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`helm\n  init [dir] --name NAME --brief TEXT   create the kit in a project\n  print-config [--host claude|codex|vscode|cursor]   MCP config for your tool\n  upgrade-project [--path P] [--force]   bring a project's copy of the engine up to this plugin version (keeps your records)\n  scan [folder]   read-only look at any project, with or without the kit (--write-config saves suggested checks when the kit is present)\n  guard baseline|check|status [--path P] [--only web,api] [--checks "cmd1,cmd2"]   record, then re-run the project's checks; non-zero exit on a regression\n  consult list|show [id]   read the records your agent kept; consult agree [id] --quote \"...\" records YOUR agreement (agents cannot)\n  adopt [folder] [--name N] [--brief B]   bring an existing or half-built project under the kit on branch kit/integration; never edits your code\n  rules [folder] [--commit]   add or refresh the helm rules block in AGENTS.md (init and adopt do this for you)\n  state [show] [folder]   write docs/STATE.md: parts (frontend, backend, ...), checks, last guard, roadmap\n  version | download [--version X.Y.Z]\n  update [--check | --dry-run]   securely update a managed Helm installation from GitHub Releases\n  watch [--once] [--interval 2]   live view: where you are, helper runs and their logs\n  runs | approve <runId> | cancel <runId>   helper agent runs (approve is founder-only)\n  ack <KEY> --quote "..." | decide <ID> --quote "..." | milestone close <M> --quote "..."   founder-only, run in a terminal\n  anything else is passed to the project's kit.mjs (continue, recover, status, ...)`);
  } else {
    const p = project();
    const r = spawnSync(process.execPath, [path.join(kitDirOf(p), 'kit.mjs'), cmd, ...rest], { cwd: p, stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
} catch (e) { die(e.user ? e.message : e.stack); }
