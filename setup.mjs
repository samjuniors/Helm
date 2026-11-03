#!/usr/bin/env node
// One front door for this plugin: install, update, uninstall, status.
//   node setup.mjs                  menu (when run in a terminal)
//   node setup.mjs install          copy to a permanent folder (~/.<name>/plugin), register with Claude Code and Codex, add a launcher
//   node setup.mjs update           run from the NEW unzipped version: updates the installed copy (backup, name kept, self-test)
//   node setup.mjs uninstall        unregister, remove the installed copy and launcher. Your projects are never touched.
//   node setup.mjs status           what is installed and registered
// options: --host all|claude|codex  --scope user|project|local  --dir <folder>  --in-place (register THIS folder, copy nothing)
//          --dry-run  --force  --yes (no question)  --purge (uninstall: remove recognized Helm backups only, preserve unrelated files)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { changeWindowsUserPath } from './server/user-path.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
const flag = (k) => argv.includes(`--${k}`);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const die = (m) => { console.error(`setup: ${m}`); process.exit(1); };
const win = process.platform === 'win32';
const q = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
const run = (c, args) => (win ? spawnSync([c, ...args.map(q)].join(' '), { shell: true, encoding: 'utf8' }) : spawnSync(c, args, { encoding: 'utf8' }));
const has = (c) => { const r = run(c, ['--version']); return !r.error && r.status === 0; };
const dry = flag('dry-run');
const manageWindowsPath = win && !flag('no-path');

// the name this build answers to is the name of its bin file (rename.mjs keeps that in step)
const bins = fs.existsSync(path.join(here, 'bin')) ? fs.readdirSync(path.join(here, 'bin')).filter((f) => f.endsWith('.mjs')) : [];
if (bins.length !== 1) die(`expected exactly one file in ${path.join(here, 'bin')}; is this the plugin folder?`);
const NAME = bins[0].replace(/\.mjs$/, '');
const HOME = path.join(os.homedir(), `.${NAME}`);
const STATE = path.join(HOME, 'install.json');
const BIN_DIR = path.join(HOME, 'bin');

const meta = (d) => { try { const j = JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')); return j.name === '@samjuniors/helm' ? j : null; } catch { return null; } };
const isOurs = (d) => !!d && !!meta(d) && fs.existsSync(path.join(d, 'server', 'mcp.mjs'));
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return null; } };
const writeState = (s) => { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); };
const registered = (c, name) => { if (!has(c)) return null; const r = run(c, ['mcp', 'list']); return new RegExp(`(^|\\s)${name}(\\s|:|$)`, 'm').test(`${r.stdout}${r.stderr}`); };
const hostTargets = (name) => name === 'all' ? ['claude', 'codex'] : name === 'none' ? [] : ['claude', 'codex'].includes(name) ? [name] : die('--host must be all, none, claude or codex');
const installedHostTargets = (record) => Array.isArray(record.hosts)
  ? record.hosts.filter((id) => ['claude', 'codex'].includes(id))
  : hostTargets(record.host || 'none');

const shimFiles = () => (win ? [path.join(BIN_DIR, `${NAME}.cmd`)] : [path.join(BIN_DIR, NAME)]);

function writeShims(dir) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const js = path.join(dir, 'bin', `${NAME}.mjs`);
  for (const file of shimFiles()) {
    if (fs.existsSync(file) && !fs.readFileSync(file, 'utf8').includes('HELM-MANAGED-LAUNCHER')) die(`refusing to overwrite an existing non-Helm launcher: ${file}`);
  }
  if (win) fs.writeFileSync(path.join(BIN_DIR, `${NAME}.cmd`), `@echo off\r\nrem HELM-MANAGED-LAUNCHER\r\nset "HELM_CMD_SHIM=%~f0"\r\nnode "${js}" %*\r\nset "HELM_EXIT=%errorlevel%"\r\nif not "%HELM_EXIT%"=="0" exit /b %HELM_EXIT%\r\nif /i not "%~1"=="uninstall" exit /b 0\r\nif /i "%~2"=="--dry-run" exit /b 0\r\nif /i "%~3"=="--dry-run" exit /b 0\r\nif /i "%~4"=="--dry-run" exit /b 0\r\nif exist "${STATE}" exit /b 0\r\n(goto) 2>nul & del "%~f0" >nul\r\n`);
  else { const f = path.join(BIN_DIR, NAME); fs.writeFileSync(f, `#!/bin/sh\n# HELM-MANAGED-LAUNCHER\nexec node "${js}" "$@"\n`); fs.chmodSync(f, 0o755); }
}
const onPath = () => (process.env.PATH ?? '').split(path.delimiter).some((p) => path.resolve(p) === path.resolve(BIN_DIR));
function pathHelp() {
  if (onPath()) return `Type "${NAME}" in any terminal.`;
  return win
    ? `Open a new PowerShell terminal after installation to type "${NAME}". If it remains unavailable, add ${BIN_DIR} to your user Path (Windows Environment Variables > Path > New). Or run: "${path.join(BIN_DIR, `${NAME}.cmd`)}" <command>`
    : `To type just "${NAME}" in any terminal:  echo 'export PATH="${BIN_DIR}:$PATH"' >> ~/.zshrc  (or ~/.bashrc), then open a new terminal. Until then use:  ${path.join(BIN_DIR, NAME)} <command>`;
}

function install() {
  if (Number(process.versions.node.split('.')[0]) < 18) die('Node 18 or newer is required (check: node -v).');
  if (!has('git')) console.log('Note: git was not found. The kit needs git in your projects (https://git-scm.com).');
  const cur = readState();
  if (cur && isOurs(cur.dir)) {
    if (opt('dir', cur.dir) !== cur.dir) die('Helm already has a managed installation. Custom paths cannot be changed using install; review your existing setup first.');
    if (opt('scope', cur.scope) !== cur.scope) die('Cannot silently change scope of an existing client registration. Review/remove the old registration first.');
    const selected = hostTargets(opt('host', 'all'));
    const owned = new Set(installedHostTargets(cur));
    const added = [];
    console.log(`Existing managed Helm ${meta(cur.dir).version}: ${cur.dir}. No plugin files will be copied or overwritten.`);
    for (const host of selected) {
      if (!has(host)) { console.log(`  ${host}: CLI unavailable; skipped (no registration written).`); continue; }
      const exists = registered(host, NAME);
      if (exists === true) {
        if (!owned.has(host)) die(`${host} already has an unrecognized ${NAME} registration; refusing to take ownership or overwrite it. Review it manually.`);
        console.log(`  ${host}: existing Helm registration left unchanged.`);
        continue;
      }
      console.log(`  ${host}: ${dry ? 'would add' : 'adding'} an absent MCP registration (no other entries modified).`);
      if (!dry) {
        const r = spawnSync(process.execPath, [path.join(cur.dir, 'install.mjs'), '--host', host, '--scope', cur.scope], { stdio: 'inherit' });
        if (r.status !== 0) die(`${host} registration failed. Previous clients and plugin files were preserved.`);
        added.push(host);
      }
    }
    if (manageWindowsPath && !dry && !cur.inPlace) {
      try {
        const result = changeWindowsUserPath(BIN_DIR, 'add');
        if (result.changed) {
          writeState({ ...cur, hosts: [...new Set([...owned, ...added])], pathManaged: true });
          console.log(`Added ${BIN_DIR} to Windows user PATH. Open a new PowerShell terminal.`);
        }
      } catch (e) { console.warn(`Could not update Windows user PATH: ${e.message}\n${pathHelp()}`); }
    }
    if (!dry && added.length) writeState({ ...readState(), hosts: [...new Set([...owned, ...added])], configuredAt: new Date().toISOString() });
    if (dry) console.log('  Preview only. Nothing was changed.');
    else console.log('  Setup finished. Restart newly connected clients, then run helm doctor.');
    return;
  }
  if (cur && !isOurs(cur.dir)) die('An existing install record references a missing or invalid Helm folder. Review ~/.helm/install.json; refusing to overwrite.');
  const inPlace = flag('in-place');
  const target = inPlace ? here : path.resolve(opt('dir', path.join(HOME, 'plugin')));
  if (!inPlace && (target === here || target.startsWith(here + path.sep) || here.startsWith(target + path.sep) || target === path.parse(target).root || target === os.homedir())) die('Source and target must be separate, safe directories.');
  if (!inPlace && fs.existsSync(target) && fs.readdirSync(target).length) die(`${target} exists and is not a plugin folder. Pick another with --dir.`);
  if (!meta(here)) die('this source folder is not a Helm package');
  if (!dry) {
    for (const f of shimFiles()) if (fs.existsSync(f) && !fs.readFileSync(f, 'utf8').includes('HELM-MANAGED-LAUNCHER')) die(`refusing to overwrite existing non-Helm launcher: ${f}`);
    {
      const targets = hostTargets(opt('host', 'all'));
      for (const c of targets) if (['claude', 'codex'].includes(c) && registered(c, NAME) === true) die(`MCP server ${NAME} is already registered in ${c} without an install record. Refusing to replace it. Inspect registration first, or explicitly use --force.`);
    }
  }
  console.log(`${dry ? '[dry run] ' : ''}Install ${NAME} ${meta(here).version}\n  plugin folder: ${target}${inPlace ? ' (this folder, nothing copied)' : ''}\n  launcher:      ${shimFiles()[0]}\n  hosts:         ${opt('host', 'all')} (Claude Code and Codex, whichever are installed)`);
  if (manageWindowsPath && !inPlace) console.log(`  Windows user PATH: ${dry ? 'would add' : 'will add'} ${BIN_DIR} (existing PATH entries preserved; opt out with --no-path).`);
  if (!dry && !inPlace) {
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(here, target, { recursive: true, filter: (f) => { const rel = path.relative(here, f); return !(/(^|[\\/])(node_modules|\.git|dist)([\\/]|$)/.test(rel) || /-backup-/.test(rel) || rel === 'tests/package-lock.json'); } });
  }
  const args = [path.join(inPlace ? here : (dry ? here : target), 'install.mjs'), '--host', opt('host', 'all'), '--scope', opt('scope', 'user'), ...(dry ? ['--dry-run'] : [])];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) die('registration did not complete (see above). Nothing else was changed; fix it and run install again.');
  if (dry) { console.log(`\n[dry run] nothing was changed. The real run registers ${path.join(target, 'server', 'mcp.mjs')} (the permanent copy), not the path shown above.`); return; }
  writeShims(target);
  const newState = { name: NAME, dir: target, inPlace, scope: opt('scope', 'user'), host: opt('host', 'all'), hosts: hostTargets(opt('host', 'all')).filter((id) => has(id) && registered(id, NAME) === true), installedAt: new Date().toISOString(), version: meta(target).version };
  writeState(newState);
  if (manageWindowsPath && !inPlace) {
    try {
      const added = changeWindowsUserPath(BIN_DIR, 'add');
      if (added.changed) writeState({ ...newState, pathManaged: true });
      console.log(added.changed ? `Added ${BIN_DIR} to Windows user PATH; open a new terminal to use ${NAME}.` : `Windows user PATH already contains ${BIN_DIR}.`);
    } catch (e) { console.warn(`Unable to update Windows user PATH automatically: ${e.message}\n${pathHelp()}`); }
  }
  console.log(`\nInstalled ${NAME} ${meta(target).version}.\nNext:\n 1. Restart Claude Code / Codex so they load it. Check in Codex: codex mcp list\n 2. ${pathHelp()}\n 3. In a project: ${NAME} init . --name "My App" --brief "..."   (new product)   or   ${NAME} adopt .   (existing project, clean git tree)\n 4. For future releases: run helm update --check, helm update --dry-run, then helm update. Antigravity is wired per project by init/adopt.`);
}

function update() {
  const cur = readState();
  if (!cur || !isOurs(cur.dir)) die(`nothing is installed yet (no record at ${STATE}). Run: node setup.mjs install`);
  if (path.resolve(here) === path.resolve(cur.dir)) die('this folder IS the installed copy. Unzip the NEW version somewhere else and run its setup there, then choose update.');
  const args = [path.join(here, 'update.mjs'), '--into', cur.dir, ...(dry ? ['--dry-run'] : []), ...(flag('force') ? ['--force'] : [])];
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
  if (dry) return;
  if (meta(cur.dir)) { writeShims(cur.dir); writeState({ ...cur, version: meta(cur.dir).version, updatedAt: new Date().toISOString() }); }
  console.log(`\nUpdated. Registrations did not change (they point at ${cur.dir}). Restart your tools. Your projects need nothing, except projects the plugin created: run "${NAME} upgrade-project" in them if the release notes say so.`);
}

async function confirm(prompt) {
  if (flag('yes')) return true;
  if (!process.stdin.isTTY) die('this changes your computer; add --yes to confirm when not in a terminal.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`${prompt} Type yes to continue: `)).trim().toLowerCase(); rl.close(); return a === 'yes';
}
const safeToDelete = (d) => {
  try { return !!d && path.resolve(d) === path.resolve(path.join(HOME, 'plugin')) && isOurs(d) && !fs.lstatSync(d).isSymbolicLink() && !fs.existsSync(path.join(d, '.git')); } catch { return false; }
};

async function uninstall() {
  const cur = readState();
  if (!cur) { console.log(`Nothing to uninstall: no install record at ${STATE}. (If you registered it by hand: claude mcp remove ${NAME} and codex mcp remove ${NAME}.)`); return; }
  if (cur.name !== NAME || typeof cur.dir !== 'string' || !['user','local','project'].includes(cur.scope) || !['all','claude','codex','none'].includes(cur.host)) die('Invalid install record; refusing to remove anything.');
  const rm = !cur.inPlace && safeToDelete(cur.dir);
  console.log(`${dry ? '[dry run] ' : ''}Uninstall ${cur.name}:\n  unregister from Claude Code and Codex (if registered)\n  ${rm ? `delete the plugin folder ${cur.dir}` : `keep the folder ${cur.dir} (${cur.inPlace ? 'it was installed in place' : 'not recognised as ours, so it is not deleted'})`}\n  delete the launcher and the install record\n  ${flag('purge') ? `remove only recognised Helm update backups in ${HOME} (not unrelated files)` : 'keep update backups (add --purge to delete them)'}\nNot touched: your projects, their .agents/ folders, git history, AGENTS.md. Those are yours.`);
  if (dry) return;
  if (!(await confirm('Remove it?'))) { console.log('Cancelled. Nothing was changed.'); return; }
  const registeredHosts = installedHostTargets(cur);
  for (const [c, args] of [['claude', ['mcp', 'remove', cur.name, '--scope', cur.scope]], ['codex', ['mcp', 'remove', cur.name]]]) {
    if (!registeredHosts.includes(c)) continue;
    if (!has(c)) { console.log(`${c}: not installed here, skipped.`); continue; }
    const r = run(c, args); console.log(`${c}: ${r.status === 0 ? 'unregistered' : 'was not registered (or already removed)'}.`);
  }
  try { process.chdir(os.homedir()); } catch { /* ignore */ }
  if (rm) { fs.rmSync(cur.dir, { recursive: true, force: true }); console.log(`Deleted ${cur.dir}.`); }
  for (const f of shimFiles()) {
    if (!fs.existsSync(f)) continue;
    if (fs.readFileSync(f, 'utf8').includes('HELM-MANAGED-LAUNCHER')) {
      // A running Windows .cmd cannot safely be unlinked mid-execution; the
      // launcher self-deletes after this Node process finishes successfully.
      const activeLauncher = win && process.env.HELM_CMD_SHIM
        && path.resolve(process.env.HELM_CMD_SHIM) === path.resolve(f);
      if (activeLauncher) console.log(`Launcher ${f} will remove itself after uninstall finishes.`);
      else fs.rmSync(f, { force: true });
    }
    else console.log(`Kept custom launcher ${f}; it was not created by this Helm installer.`);
  }
  if (win && cur.pathManaged === true) {
    try {
      const removed = changeWindowsUserPath(BIN_DIR, 'remove');
      if (removed.changed) console.log(`Removed Helm's PATH entry from Windows user PATH; reopen your terminal.`);
    } catch (e) { console.warn(`Could not remove Helm's user PATH entry automatically: ${e.message}\nYou can remove ${BIN_DIR} manually from your user PATH.`); }
  }
  fs.rmSync(STATE, { force: true });
  try { fs.rmdirSync(BIN_DIR); } catch { /* not empty or gone */ }
  if (flag('purge') && path.basename(HOME) === `.${NAME}` && path.dirname(HOME) === os.homedir()) {
    for (const entry of fs.readdirSync(HOME)) {
      if (!/^plugin-backup-\d+\.\d+\.\d+-\d{4}-/.test(entry)) continue;
      const backup = path.join(HOME, entry);
      if (fs.lstatSync(backup).isSymbolicLink() || !isOurs(backup) || fs.existsSync(path.join(backup, '.git'))) continue;
      fs.rmSync(backup, { recursive: true, force: true });
    }
  }
  try { fs.rmdirSync(HOME); } catch { console.log(`Kept ${HOME} (backups or other files remain).`); }
  console.log(`\nUninstalled. Restart Claude Code and Codex. Antigravity: a project's .agents/mcp_config.json still lists the server; delete that entry (or run: ${NAME} adapt) if you want it gone. Remove ${BIN_DIR} from your PATH if you added it.`);
}

function status() {
  const cur = readState();
  if (!cur) { console.log(`${NAME} is not installed on this computer (no record at ${STATE}).\nInstall: node setup.mjs install`); return; }
  const ok = isOurs(cur.dir);
  console.log(`${NAME} ${ok ? meta(cur.dir).version : '(folder missing or damaged)'} installed at ${cur.dir}${cur.inPlace ? ' (in place)' : ''}\nSince ${cur.installedAt?.slice(0, 10)}${cur.updatedAt ? `, updated ${cur.updatedAt.slice(0, 10)}` : ''}`);
  for (const [label, c] of [['Claude Code', 'claude'], ['Codex', 'codex']]) { const r = registered(c, cur.name); console.log(`${label.padEnd(12)} ${r === null ? 'not installed on this computer' : r ? 'registered' : 'NOT registered (run: node setup.mjs install --force)'}`); }
  console.log(`Launcher     ${shimFiles().every((f) => fs.existsSync(f)) ? shimFiles()[0] : 'missing'}\n${pathHelp()}`);
  console.log(`This folder is ${meta(here)?.version}${meta(here) && ok && meta(here).version !== meta(cur.dir).version ? ` (differs from the installed one: run node setup.mjs update here, or helm update in your managed installation)` : ''}.`);
}

async function menu() {
  const { runWizard } = await import('./wizard.mjs');
  await runWizard();
}

const help = () => console.log(`${NAME} setup\n  node setup.mjs install | update | uninstall | status | wizard (no argument: guided wizard)\n  --host all|claude|codex|none  --scope user|project|local  --dir <folder>  --in-place\n  --dry-run  --force  --yes  --purge  --no-path (Windows: do not modify user PATH)\nWindows: double-click setup.cmd. Mac/Linux: ./setup.sh`);
if (flag('help') || cmd === 'help') help();
else if (cmd === 'install') install();
else if (cmd === 'update') update();
else if (cmd === 'uninstall') await uninstall();
else if (cmd === 'status') status();
else if (cmd === 'wizard' || (!cmd && process.stdin.isTTY)) await menu();
else help();
