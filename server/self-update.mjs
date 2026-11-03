// Helm managed-install updater: no Git checkout writes, verified GitHub release,
// bounded and safe tar extraction, and the existing backup/rollback updater.
// No external npm dependencies; designed for Node.js 18+.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const API = 'https://api.github.com/repos/samjuniors/Helm/releases/latest';
const MAX_ASSET = 32 * 1024 * 1024;
const MAX_TAR = 128 * 1024 * 1024;
const MAX_ENTRIES = 3000;
const VERSION = /^\d+\.\d+\.\d+$/;

export function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw new Error('invalid release version');
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}

const safePath = (name) => {
  if (!name || name.startsWith('/') || name.includes('\\') || name.includes('\0')) throw new Error('unsafe archive path');
  const parts = name.replace(/\/$/, '').split('/');
  if (parts[0] !== 'package' || parts.some((p) => !p || p === '.' || p === '..' || p === '.git' || p === 'node_modules')) {
    throw new Error('unsafe archive entry: ' + name);
  }
  return parts.slice(1);
};
const octal = (b) => {
  const raw = b.toString('utf8').replace(/\0.*$/, '').trim();
  if (!raw) return 0;
  if (!/^[0-7]+$/.test(raw)) throw new Error('invalid tar size');
  const n = parseInt(raw, 8);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid tar size');
  return n;
};
const tarName = (b) => b.toString('utf8').split('\0')[0];
const paxValues = (data) => {
  const result = {};
  let offset = 0;
  while (offset < data.length) {
    const blank = data.indexOf(0x20, offset);
    if (blank < 0) throw new Error('invalid pax header');
    const len = Number(data.subarray(offset, blank).toString('utf8'));
    if (!Number.isInteger(len) || len < 4 || offset + len > data.length) throw new Error('invalid pax length');
    const row = data.subarray(blank + 1, offset + len - 1).toString('utf8');
    const eq = row.indexOf('=');
    if (eq < 1) throw new Error('invalid pax field');
    result[row.slice(0, eq)] = row.slice(eq + 1);
    offset += len;
  }
  return result;
};

export function unpackNpmTgz(archiveBytes, dest) {
  const input = Buffer.isBuffer(archiveBytes) ? archiveBytes : Buffer.from(archiveBytes);
  let tar;
  try { tar = gunzipSync(input, { maxOutputLength: MAX_TAR }); }
  catch { throw new Error('invalid, oversized, or truncated release TGZ'); }
  if (!tar.length || tar.length % 512 !== 0) throw new Error('invalid tar alignment');
  let offset = 0, total = 0, pendingPath = null;
  let hasPackage = false, hasMcp = false, hasSetup = false, hasUpdater = false;
  const seen = new Set();
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((n) => n === 0)) break;
    const name = tarName(header.subarray(0, 100));
    const prefix = tarName(header.subarray(345, 500));
    const size = octal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156] || 0);
    const fullName = prefix ? prefix + '/' + name : name;
    offset += 512;
    if (size > MAX_TAR || offset + size > tar.length) throw new Error('truncated or oversized tar entry');
    const data = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const attrs = paxValues(data);
      if (attrs.linkpath) throw new Error('archive links are not supported');
      pendingPath = attrs.path || null;
      continue;
    }
    if (type === 'g') continue;
    if (type !== '0' && type !== '\0' && type !== '5') throw new Error('release archive contains an unsafe link or entry type');
    const parts = safePath(pendingPath ?? fullName);
    pendingPath = null;
    if (!parts.length) {
      if (type !== '5') throw new Error('invalid root entry');
      continue;
    }
    const rel = parts.join('/');
    if (seen.has(rel)) throw new Error('duplicate release path: ' + rel);
    seen.add(rel);
    total += 1;
    if (total > MAX_ENTRIES) throw new Error('too many archive entries');
    const target = path.join(dest, ...parts);
    if (type === '5') {
      fs.mkdirSync(target, { recursive: true });
    } else {
      if (size > 16 * 1024 * 1024) throw new Error('oversized release file');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data, { flag: 'wx', mode: 0o644 });
      if (rel === 'package.json') hasPackage = true;
      if (rel === 'server/mcp.mjs') hasMcp = true;
      if (rel === 'setup.mjs') hasSetup = true;
      if (rel === 'update.mjs') hasUpdater = true;
    }
  }
  if (total < 20 || !hasPackage || !hasMcp || !hasSetup || !hasUpdater) throw new Error('release archive is missing required Helm files');
  return total;
}

function validateRelease(release) {
  if (!release || release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error('GitHub did not return a stable Helm release');
  }
  if (release.html_url && !release.html_url.startsWith('https://github.com/samjuniors/Helm/releases/tag/')) {
    throw new Error('unexpected GitHub release location');
  }
  return release.tag_name.slice(1);
}
function validatedAsset(release, name) {
  const asset = release.assets?.find((a) => a.name === name);
  if (!asset) throw new Error('published release is missing ' + name);
  const url = new URL(asset.browser_download_url);
  if (url.origin !== 'https://github.com' ||
      url.pathname !== '/samjuniors/Helm/releases/download/' + release.tag_name + '/' + name ||
      url.search || url.hash) {
    throw new Error('release asset URL is not the official Helm download');
  }
  return url.href;
}

async function getBytes(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('GitHub download HTTP ' + response.status);
  if (response.url && new URL(response.url).protocol !== 'https:') throw new Error('insecure release redirect');
  if (Number(response.headers?.get?.('content-length') || 0) > MAX_ASSET) throw new Error('release asset too large');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_ASSET) throw new Error('release asset too large');
  return data;
}

function installRecord(pluginRoot, home, name) {
  const stateFile = path.join(home, '.' + name, 'install.json');
  let state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  catch { throw new Error('no managed installation record; for ZIP installations use the legacy updater, or use Git for source clones'); }
  if (state.name !== name || typeof state.dir !== 'string' || !state.dir ||
      !['user', 'local', 'project'].includes(state.scope) || !['all', 'claude', 'codex'].includes(state.host)) {
    throw new Error('invalid Helm installation record; refusing to update');
  }
  const installed = path.resolve(state.dir);
  if (fs.realpathSync(installed) !== fs.realpathSync(pluginRoot) ||
      fs.lstatSync(installed).isSymbolicLink() || fs.existsSync(path.join(installed, '.git'))) {
    throw new Error('this is not the managed Helm installation; Git source clones must be updated with Git');
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'));
  if (pkg.name !== '@samjuniors/helm' || !VERSION.test(pkg.version) || !fs.existsSync(path.join(installed, 'server', 'mcp.mjs'))) {
    throw new Error('installed Helm files are incomplete or unrecognized');
  }
  if (state.version !== pkg.version) throw new Error('installation record and package version differ; inspect before updating');
  return { state, pkg, installed };
}

export async function runSelfUpdate({
  args = [], pluginRoot, home = os.homedir(), fetchImpl = globalThis.fetch,
  childEnv = process.env, log = (msg) => console.log(msg),
} = {}) {
  const accepted = new Set(['--check', '--dry-run']);
  if (args.some((x) => !accepted.has(x)) || (args.includes('--check') && args.includes('--dry-run'))) {
    throw new Error('usage: helm update [--check | --dry-run]');
  }
  if (!pluginRoot || !fs.existsSync(path.join(pluginRoot, 'package.json'))) throw new Error('missing Helm source');
  if (fs.existsSync(path.join(pluginRoot, '.git'))) {
    throw new Error('this is a Git source checkout; use git status and git pull --ff-only origin main instead');
  }
  const bins = fs.readdirSync(path.join(pluginRoot, 'bin')).filter((x) => x.endsWith('.mjs'));
  if (bins.length !== 1) throw new Error('cannot determine installed Helm CLI identity');
  const name = bins[0].slice(0, -4);
  const { pkg, installed } = installRecord(pluginRoot, home, name);
  const headers = { 'User-Agent': 'helm-self-update', Accept: 'application/vnd.github+json',
    ...(childEnv.GH_TOKEN || childEnv.GITHUB_TOKEN ? { Authorization: 'Bearer ' + (childEnv.GH_TOKEN || childEnv.GITHUB_TOKEN) } : {}) };
  const manifest = await getBytes(fetchImpl, API, headers);
  const release = JSON.parse(manifest.toString('utf8'));
  const next = validateRelease(release);
  const comparison = compareVersions(next, pkg.version);
  log('Helm installed: v' + pkg.version + ' | Latest published: v' + next);
  if (comparison <= 0) {
    log(comparison === 0 ? 'Helm is already up to date.' : 'Installed Helm is newer than the latest published release; nothing changed.');
    return { status: 'current', version: pkg.version, latest: next };
  }
  validatedAsset(release, 'helm-v' + next + '.tgz');
  validatedAsset(release, 'SHA256SUMS');
  if (args.includes('--check')) {
    log('Update available: v' + next + '. Run helm update --dry-run to preview.');
    return { status: 'available', version: pkg.version, latest: next };
  }
  if (args.includes('--dry-run')) {
    log('DRY RUN: would download and verify the official release, preserve a backup, update the managed Helm copy and test MCP startup.');
    log('Project files, Git repositories, client registration paths and other user files would remain unchanged.');
    return { status: 'preview', version: pkg.version, latest: next };
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'helm-self-update-'));
  try {
    const checksums = (await getBytes(fetchImpl, validatedAsset(release, 'SHA256SUMS'), headers)).toString('utf8');
    const file = 'helm-v' + next + '.tgz';
    const row = checksums.split(/\r?\n/).map((x) => x.match(/^([0-9a-f]{64})  \*?(.+)$/)).find((m) => m && m[2] === file);
    if (!row) throw new Error('release checksum is missing or invalid');
    const archive = await getBytes(fetchImpl, validatedAsset(release, file), headers);
    const digest = crypto.createHash('sha256').update(archive).digest('hex');
    if (digest !== row[1]) throw new Error('SHA-256 verification failed; installed Helm was not changed');
    const unpacked = path.join(temp, 'staged');
    fs.mkdirSync(unpacked);
    const entries = unpackNpmTgz(archive, unpacked);
    const candidate = JSON.parse(fs.readFileSync(path.join(unpacked, 'package.json'), 'utf8'));
    if (candidate.name !== '@samjuniors/helm' || candidate.version !== next ||
        !fs.readFileSync(path.join(unpacked, 'server/mcp.mjs'), 'utf8').includes("const VERSION = '" + next + "';")) {
      throw new Error('verified archive metadata does not match the published release');
    }
    if (!fs.existsSync(path.join(unpacked, 'bin', name + '.mjs'))) throw new Error('release does not contain the registered Helm CLI');
    log('Verified v' + next + ' SHA-256 (' + entries + ' archive entries). Applying guarded update...');
    const child = spawnSync(process.execPath, [path.join(unpacked, 'setup.mjs'), 'update'], {
      cwd: unpacked, env: childEnv, encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024,
    });
    if (child.stdout) log(child.stdout.trimEnd());
    if (child.stderr) log(child.stderr.trimEnd());
    if (child.error || child.status !== 0) throw new Error('guarded updater failed; read its output and inspect its backup before retrying');
    const now = installRecord(pluginRoot, home, name);
    if (now.pkg.version !== next || now.installed !== installed) throw new Error('post-update version/installation verification failed; inspect backup');
    log('Helm v' + next + ' installed. Restart your coding assistant to load the updated MCP server.');
    return { status: 'updated', version: next, previous: pkg.version };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
