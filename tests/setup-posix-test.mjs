// Tests for setup.mjs: install, update, uninstall, status. Uses a fake HOME and stub claude/codex programs. POSIX only (Windows is not covered here).
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, cpSync, chmodSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = readdirSync(path.join(root, 'bin')).find((f) => f.endsWith('.mjs')).replace(/\.mjs$/, '');
const tmp = mkdtempSync(path.join(os.tmpdir(), 'st-'));
const home = path.join(tmp, 'home'), stubs = path.join(tmp, 'stubs'), logs = path.join(tmp, 'logs'); for (const d of [home, stubs, logs]) mkdirSync(d);
const stub = `#!/bin/sh
b=$(basename "$0"); echo "$@" >> "$STUB_LOGS/$b.log"; reg="$STUB_LOGS/$b.reg"; touch "$reg"
[ "$1" = "--version" ] && { echo "$b 1.0"; exit 0; }
[ "$1" = "mcp" ] || exit 0
act="$2"; shift 2; name=""
while [ $# -gt 0 ]; do case "$1" in --scope) shift 2;; --) break;; *) [ -z "$name" ] && name="$1"; shift;; esac; done
case "$act" in
  add) grep -qx "$name" "$reg" && { echo "already exists"; exit 1; }; echo "$name" >> "$reg"; echo "Added $name"; exit 0;;
  remove) grep -qx "$name" "$reg" || exit 1; grep -vx "$name" "$reg" > "$reg.t"; mv "$reg.t" "$reg"; exit 0;;
  list) sed 's/$/: node server/' "$reg"; exit 0;;
esac
exit 0
`;
for (const b of ['claude', 'codex']) { writeFileSync(path.join(stubs, b), stub); chmodSync(path.join(stubs, b), 0o755); }
const envWith = { ...process.env, HOME: home, USERPROFILE: home, STUB_LOGS: logs, PATH: `${stubs}:${process.env.PATH}`, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const envBare = { ...envWith, PATH: process.env.PATH };
const setup = (dir, args, env = envWith, input) => spawnSync(process.execPath, [path.join(dir, 'setup.mjs'), ...args], { env, encoding: 'utf8', input, cwd: tmp });
let n = 0, failed = 0, last = '';
const ok = (c, m) => { n++; if (c) console.log(`  PASS ${m}`); else { failed++; console.log(`  FAIL ${m}\n      ${last.slice(0, 600).replace(/\n/g, ' | ')}`); } };
const o = (r) => { last = `${r.stdout}${r.stderr}`; return last; };
const reg = (b) => (existsSync(path.join(logs, `${b}.reg`)) ? readFileSync(path.join(logs, `${b}.reg`), 'utf8').split('\n').filter(Boolean) : []);
const adds = (b) => (existsSync(path.join(logs, `${b}.log`)) ? readFileSync(path.join(logs, `${b}.log`), 'utf8').split('\n').filter((l) => l.startsWith('mcp add')).length : 0);
const H = path.join(home, `.${NAME}`);
const fresh = (name) => { const d = path.join(tmp, name); cpSync(root, d, { recursive: true, filter: (f) => !/node_modules/.test(f) }); return d; };
const src = fresh('src');

console.log('1. before anything is installed');
let r = setup(src, ['status']); ok(r.status === 0 && /not installed on this computer/.test(o(r)), 'status says nothing is installed');
r = setup(src, ['uninstall', '--yes']); ok(r.status === 0 && /Nothing to uninstall/.test(o(r)), 'uninstall with nothing installed is harmless');
r = setup(src, ['install', '--dry-run']); ok(r.status === 0 && /dry run/i.test(o(r)) && !existsSync(H) && reg('claude').length === 0, 'install --dry-run shows the plan and changes nothing');

console.log('2. install');
r = setup(src, ['install']); const t1 = o(r);
ok(r.status === 0 && /Installed/.test(t1), 'install succeeds');
ok(existsSync(path.join(H, 'plugin', 'server', 'mcp.mjs')) && existsSync(path.join(H, 'plugin', 'setup.mjs')) && !existsSync(path.join(H, 'plugin', 'tests', 'node_modules')), 'the plugin is copied to a permanent folder under the home directory');
ok(reg('claude').includes(NAME) && reg('codex').includes(NAME), 'it registered with Claude Code and Codex under its own name');
const shim = path.join(H, 'bin', NAME);
ok(existsSync(shim) && (statSync(shim).mode & 0o111) !== 0, 'a launcher was created and is executable');
r = spawnSync(shim, ['version'], { env: envWith, encoding: 'utf8' }); ok(r.status === 0 && /Helm \d+\.\d+\.\d+/.test(o(r)), 'the launcher runs the installed copy');
ok(JSON.parse(readFileSync(path.join(H, 'install.json'), 'utf8')).dir === path.join(H, 'plugin'), 'an install record says where it lives');
r = setup(src, ['install']); ok(r.status === 0 && /Already installed/.test(o(r)) && adds('claude') === 1, 'installing twice does nothing the second time');
r = setup(src, ['status']); ok(/registered/.test(o(r)) && !/NOT registered/.test(last) && /Launcher/.test(last), 'status shows both registered and the launcher');

console.log('3. update from a newer folder');
const nw = fresh('newer'); const pj = JSON.parse(readFileSync(path.join(nw, 'package.json'), 'utf8')); pj.version = '9.9.9'; writeFileSync(path.join(nw, 'package.json'), JSON.stringify(pj, null, 2)); const mcpPath=path.join(nw,'server/mcp.mjs'); const mcpSource=readFileSync(mcpPath,'utf8'); writeFileSync(mcpPath,mcpSource.replace("const VERSION = '0.10.0';","const VERSION = '9.9.9';")); writeFileSync(path.join(nw, 'NEW_MARKER.txt'), 'x');
r = setup(nw, ['update', '--dry-run']); ok(r.status === 0 && JSON.parse(readFileSync(path.join(H, 'plugin', 'package.json'), 'utf8')).version !== '9.9.9', 'update --dry-run changes nothing');
r = setup(nw, ['update']); const t2 = o(r);
ok(r.status === 0 && /Updated and verified helm 9\.9\.9/.test(t2) && JSON.parse(readFileSync(path.join(H, 'plugin', 'package.json'), 'utf8')).version === '9.9.9' && existsSync(path.join(H, 'plugin', 'NEW_MARKER.txt')), 'update puts the newer files into the installed copy and the self-test passes');
ok(readdirSync(H).some((f) => /backup/.test(f)), 'update kept a backup of the previous version');
ok(adds('claude') === 1 && adds('codex') === 1 && reg('claude').length === 1, 'registrations were not touched by the update');
ok(JSON.parse(readFileSync(path.join(H, 'install.json'), 'utf8')).version === '9.9.9', 'the install record has the new version');
r = setup(path.join(H, 'plugin'), ['update']); ok(r.status !== 0 && /IS the installed copy/.test(o(r)), 'update run from the installed folder itself is refused with an explanation');
r = setup(src, ['update']); ok(r.status !== 0 && /refusing downgrade/.test(o(r)), 'updating from an older folder is refused');

console.log('4. uninstall');
r = setup(src, ['uninstall'], envWith, ''); ok(r.status !== 0 && /--yes/.test(o(r)) && existsSync(path.join(H, 'plugin')) && reg('claude').includes(NAME), 'without a terminal and without --yes it refuses and changes nothing');
r = setup(src, ['uninstall', '--dry-run']); ok(r.status === 0 && existsSync(path.join(H, 'plugin')) && /Not touched: your projects/.test(o(r)), 'uninstall --dry-run lists the plan and changes nothing');
const proj = path.join(tmp, 'myproj'); mkdirSync(path.join(proj, '.agents/x'), { recursive: true }); writeFileSync(path.join(proj, '.agents/x/keep.txt'), 'mine');
r = setup(src, ['uninstall', '--yes']); const t3 = o(r);
ok(r.status === 0 && reg('claude').length === 0 && reg('codex').length === 0, 'uninstall unregistered it from Claude Code and Codex');
ok(!existsSync(path.join(H, 'plugin')) && !existsSync(shim) && !existsSync(path.join(H, 'install.json')), 'the installed copy, the launcher and the record are gone');
ok(readdirSync(H).some((f) => /backup/.test(f)) && /update backups/.test(t3), 'update backups are kept unless asked');
ok(existsSync(path.join(src, 'setup.mjs')) && existsSync(path.join(proj, '.agents/x/keep.txt')), 'the folder you ran it from and your project files are untouched');
r = setup(src, ['status']); ok(/not installed on this computer/.test(o(r)), 'status agrees it is gone');

console.log('5. reinstall, purge, in place, and refusing to delete what is not ours');
r = setup(src, ['install']); ok(r.status === 0 && reg('claude').includes(NAME), 'it installs again cleanly after an uninstall');
r = setup(src, ['uninstall', '--yes', '--purge']); ok(r.status === 0 && !existsSync(H), '--purge also removes the backups and the whole hidden folder');
const inp = fresh('inplace');
r = setup(inp, ['install', '--in-place']); ok(r.status === 0 && JSON.parse(readFileSync(path.join(H, 'install.json'), 'utf8')).dir === inp && !existsSync(path.join(H, 'plugin')), '--in-place registers this folder and copies nothing');
r = setup(inp, ['uninstall', '--yes']); ok(r.status === 0 && existsSync(path.join(inp, 'setup.mjs')) && reg('claude').length === 0, 'uninstalling an in-place install unregisters it but never deletes your folder');
const notours = path.join(tmp, 'notours'); mkdirSync(notours); writeFileSync(path.join(notours, 'precious.txt'), 'x');
mkdirSync(H, { recursive: true }); writeFileSync(path.join(H, 'install.json'), JSON.stringify({ name: NAME, dir: notours, inPlace: false, scope: 'user' }));
r = setup(src, ['uninstall', '--yes']); ok(r.status !== 0 && existsSync(path.join(notours, 'precious.txt')) && /Invalid install record/.test(o(r)), 'a damaged install record is refused and cannot delete unrelated files');
const homeDirGuard = { name: NAME, dir: home, inPlace: false, scope: 'user' }; mkdirSync(H, { recursive: true }); writeFileSync(path.join(H, 'install.json'), JSON.stringify(homeDirGuard));
r = setup(src, ['uninstall', '--yes']); ok(existsSync(home), 'and never your home folder');

console.log('6. neither tool installed');
rmSync(H, { recursive: true, force: true });
r = setup(src, ['install'], envBare); const t4 = o(r); ok(r.status === 0 && /not installed or not on PATH/.test(t4) && existsSync(path.join(H, 'plugin', 'server', 'mcp.mjs')), 'with neither tool present it still installs the plugin and prints the command to run later');
r = setup(src, ['status'], envBare); ok(/not installed on this computer/.test(o(r)), 'status reports the tools as absent instead of failing');
r = setup(src, ['uninstall', '--yes'], envBare); ok(r.status === 0 && !existsSync(path.join(H, 'plugin')), 'uninstall works without the tools too');

console.log(`\n${n - failed}/${n} checks passed`); rmSync(tmp, { recursive: true, force: true }); process.exit(failed ? 1 : 0);
