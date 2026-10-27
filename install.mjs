#!/usr/bin/env node
// Registers the helm MCP server with the agent tools installed on THIS computer, after proving the server starts.
//   node install.mjs                      Claude Code + Codex (whichever are installed)
//   node install.mjs --host claude        only Claude Code
//   node install.mjs --name my-name       register under another name
//   node install.mjs --scope project      Claude Code: this project only (default: user = all projects)
//   node install.mjs --dry-run            show the commands, change nothing
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(here, 'server', 'mcp.mjs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const host = opt('host', 'all'), scope = opt('scope', 'user'), dry = argv.includes('--dry-run');
const NAME = opt('name', 'helm');   // the name your tools show for this server
if (!/^[a-z][a-z0-9-]{1,30}$/.test(NAME)) { console.error('--name must be lowercase letters, digits and dashes'); process.exit(1); }
const win = process.platform === 'win32';
const q = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const run = (cmd, args) => (win ? spawnSync([cmd, ...args.map(q)].join(' '), { shell: true, encoding: 'utf8' }) : spawnSync(cmd, args, { encoding: 'utf8' }));
const has = (cmd) => { const r = run(cmd, ['--version']); return !r.error && r.status === 0; };
if (!['all', 'claude', 'codex'].includes(host)) { console.error('--host must be all, claude or codex'); process.exit(1); }
if (!['user', 'project', 'local'].includes(scope)) { console.error('--scope must be user, project or local'); process.exit(1); }

// 1. prove the server starts here (Node works, files are in place)
const t = spawnSync(process.execPath, [server], { input: [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'install', version: '1' } } }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }].map((m) => JSON.stringify(m)).join('\n') + '\n', encoding: 'utf8', timeout: 8000 });
let tools = 0; try { tools = JSON.parse(t.stdout.trim().split('\n')[1]).result.tools.length; } catch { /* fall through */ }
if (tools < 9) { console.error(`Self-test FAILED: the server did not list its tools (${t.stderr || t.stdout || 'no output'}). Check that Node 18+ is installed: node -v`); process.exit(1); }
console.log(`Self-test OK: the server starts and lists ${tools} tools (${server}).`);

// 2. register with each tool
const targets = [];
if (host === 'all' || host === 'claude') targets.push({ name: 'Claude Code', cmd: 'claude', args: ['mcp', 'add', '--scope', scope, NAME, '--', 'node', server], remove: ['mcp', 'remove', NAME, '--scope', scope] });
if (host === 'all' || host === 'codex') targets.push({ name: 'Codex (CLI, desktop app and IDE extension share this)', cmd: 'codex', args: ['mcp', 'add', NAME, '--', 'node', server], remove: ['mcp', 'remove', NAME] });
let failed = false;
for (const x of targets) {
  const shown = `${x.cmd} ${x.args.map(q).join(' ')}`;
  if (dry) { console.log(`[dry run] ${x.name}: ${shown}`); continue; }
  if (!has(x.cmd)) { console.log(`${x.name}: "${x.cmd}" is not installed or not on PATH, so nothing was registered. When it is, run:\n  ${shown}`); continue; }
  let r = run(x.cmd, x.args);
  if (r.status !== 0 && /already exists|already configured/i.test(`${r.stderr}${r.stdout}`)) { run(x.cmd, x.remove); r = run(x.cmd, x.args); }
  if (r.status === 0) console.log(`${x.name}: registered. ${(r.stdout || '').trim().split('\n')[0]}`);
  else { failed = true; console.log(`${x.name}: the command failed:\n  ${shown}\n${(r.stderr || r.stdout || '').trim().slice(0, 400)}`); }
}
console.log(`\nAntigravity (app, IDE or agy CLI) is set up per project, not here: in a project run  node bin/helm.mjs init . --name "My App"  (new) or  node .agents/product-kit/kit.mjs adapt --host antigravity --mcp "${server}"  (existing). Then reopen it and refresh Settings > Customizations > Installed MCP Servers.\nClaude Code plugin extras (session hook, /kit-* commands, sub-agents): inside Claude Code run\n  /plugin marketplace add ${here}\n  /plugin install helm@helm-local\n\nThen restart the tool and ask: "list your helm tools" (you should see 9).`);
process.exit(failed ? 1 : 0);
