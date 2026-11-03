// Advisor: scan, parts, regression guard, state doc, adopt and consult records. No dependencies.
// scan, guard and consult never edit the product. Their records live in <git common dir>/kit/helm (local, never committed).
// state writes docs/STATE.md; adopt and consult plan write kit files, on a branch / through the kit's own validation, and undo on failure.
// The host model does the thinking (interview, options, research, recommendation); this file gathers evidence, enforces the
// structure and refuses to call something safe, verified or agreed when it was not.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { kitDirOf, resolveProject, roadmapAdd, initProject, runKit, PLUGIN_ROOT, SERVER_NAME } from './runtime.mjs';

const err = (m) => { const e = new Error(m); e.user = true; return e; };
const rd = (f) => readFileSync(f, 'utf8');
const gitRun = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const isRepo = (cwd) => gitRun(cwd, ['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';
const CLI = `node "${path.join(PLUGIN_ROOT, 'bin', `${SERVER_NAME}.mjs`)}"`;
const nowStamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage', '.venv', 'venv', '__pycache__', 'target', '.turbo', '.cache', '.gradle', 'bin', 'obj']);
const SRC_EXT = /\.(?:[cm]?[jt]sx?|py|rs|go|java|kt|rb|php|cs|swift|vue|svelte|css|scss|html|sql)$/i;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|\.test-d\.ts$|(^|\/)tests?\.[cm]?[jt]sx?$|(^|\/)(tests?|__tests__|e2e|spec)\/|(^|\/)test_[^/]+\.py$|_test\.(go|py)$|Test\.java$|_spec\.rb$/;
const SECRETS = [['AWS access key', /AKIA[0-9A-Z]{16}/], ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/], ['GitHub token', /gh[pousr]_[A-Za-z0-9]{30,}/], ['API key (sk-)', /sk-[A-Za-z0-9_-]{20,}/], ['Slack token', /xox[abprs]-[A-Za-z0-9-]{10,}/]];
const MAX_FILES = 20000, MAX_READ = 3000;

function listFiles(root) {
  if (isRepo(root)) {
    const r = gitRun(root, ['ls-files', '-co', '--exclude-standard']);
    const all = r.stdout.split('\n').filter(Boolean).filter((f) => !f.split('/').some((p) => SKIP_DIRS.has(p)));
    return Object.assign(all.slice(0, MAX_FILES), { total: all.length });
  }
  const out = [];
  const walk = (d, depth) => {
    if (depth > 6 || out.length >= MAX_FILES) return;
    for (const n of readdirSync(d)) {
      if (SKIP_DIRS.has(n) || n.startsWith('.git')) continue;
      const f = path.join(d, n); let st; try { st = statSync(f); } catch { continue; }
      if (st.isDirectory()) walk(f, depth + 1); else out.push(path.relative(root, f).split(path.sep).join('/'));
    }
  };
  walk(root, 0);
  return Object.assign(out, { total: out.length });
}
const loadJson = (f) => { try { return JSON.parse(rd(f)); } catch { return null; } };
const hasBin = (n) => { const r = spawnSync(n, ['--version'], { encoding: 'utf8' }); return !r.error && r.status === 0; };
let pyCache; const pyBin = () => (pyCache ??= hasBin('python') ? 'python' : hasBin('python3') ? 'python3' : 'python');

// ---------- parts: frontend, backend, data, library ... found by their manifests ----------
const MANIFEST = { 'package.json': 'node', 'pyproject.toml': 'python', 'requirements.txt': 'python', 'setup.py': 'python', 'Cargo.toml': 'rust', 'go.mod': 'go', 'pom.xml': 'java', 'build.gradle': 'java', 'build.gradle.kts': 'java', Gemfile: 'ruby', 'composer.json': 'php' };
const FRONT = ['react', 'next', 'vue', 'nuxt', 'svelte', '@sveltejs/kit', '@angular/core', 'vite', 'solid-js', 'astro', 'remix', '@remix-run/react', 'gatsby'];
const BACK = ['express', 'fastify', 'koa', '@nestjs/core', 'hono', 'apollo-server', '@apollo/server', 'trpc', '@trpc/server', 'fastapi', 'flask', 'django', 'sanic', 'tornado', 'aiohttp', 'spring-boot', 'quarkus', 'micronaut', 'ktor', 'vertx'];
const DATA = ['prisma', '@prisma/client', 'drizzle-orm', 'knex', 'typeorm', 'sequelize', 'mongoose', 'sqlalchemy', 'alembic', 'psycopg2', 'pymongo'];
const MOBILE = ['react-native', 'expo', 'android'];
const DESKTOP = ['electron', '@tauri-apps/api'];
const read = (f) => { try { return rd(f); } catch { return ''; } };
export function detectParts(root, files = listFiles(root)) {
  const by = new Map();
  for (const f of files) {
    const segs = f.split('/'); if (segs.length > 5) continue;
    const base = segs.at(-1); const kind = MANIFEST[base] ?? (/\.(csproj|sln)$/.test(base) ? 'dotnet' : null); if (!kind) continue;
    const dir = segs.slice(0, -1).join('/') || '.';
    if (/(^|\/)(examples?|fixtures?|vendor|third_party|docs?|tests?|__tests__|e2e)(\/|$)/.test(dir)) continue;
    const p = by.get(dir) ?? { dir, kinds: [], manifests: [] }; if (!p.kinds.includes(kind)) p.kinds.push(kind); p.manifests.push(base); by.set(dir, p);
  }
  const parts = [...by.values()].sort((a, b) => (a.dir === '.' ? -1 : b.dir === '.' ? 1 : a.dir.localeCompare(b.dir)));
  if (!parts.some((p) => p.dir === '.') && files.some((f) => !f.includes('/') && SRC_EXT.test(f))) parts.unshift({ dir: '.', kinds: [], manifests: [] });
  const rootPkg = loadJson(path.join(root, 'package.json'));
  const hasWs = !!(rootPkg && (Array.isArray(rootPkg.workspaces) || rootPkg.workspaces?.packages));
  const wsRe = hasWs ? workspaceGlobs(root).map(globRe) : [];
  for (const p of parts) {
    p._others = parts.filter((q) => q.dir !== '.' && q.dir !== p.dir).map((q) => q.dir);
    p.member = p.dir !== '.' && p.kinds.includes('node') && wsRe.some((re) => re.test(p.dir));
    const abs = path.join(root, p.dir); const pre = p.dir === '.' ? '' : `${p.dir}/`;
    const owned = (f) => (pre ? f.startsWith(pre) : !parts.some((q) => q.dir !== '.' && f.startsWith(`${q.dir}/`)));
    const mine = files.filter(owned);
    p.files = mine.filter((f) => SRC_EXT.test(f) && !TEST_FILE.test(f) && !/\.(css|scss|html|sql)$/i.test(f)).length;
    p.tests = mine.filter((f) => TEST_FILE.test(f)).length;
    const pkg = p.kinds.includes('node') ? loadJson(path.join(abs, 'package.json')) : null;
    const pytxt = p.kinds.includes('python') ? ['pyproject.toml', 'requirements.txt', 'setup.py', 'requirements-dev.txt'].map((n) => read(path.join(abs, n))).join('\n').toLowerCase() : '';
    const jtxt = p.kinds.includes('java') ? ['pom.xml', 'build.gradle', 'build.gradle.kts'].map((n) => read(path.join(abs, n))).join('\n').toLowerCase() : '';
    const deps = new Set([...Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies }), ...(pytxt.match(/[a-z][a-z0-9_.-]+/g) ?? []), ...(jtxt.match(/spring-boot|quarkus|micronaut|ktor|vertx/g) ?? []), ...(/com\.android\.|androidx/.test(jtxt) ? ['android'] : [])]);
    const has = (list) => list.filter((d) => deps.has(d));
    p.stack = [...has([...FRONT, ...BACK, ...DATA, ...MOBILE, ...DESKTOP, 'typescript', 'tailwindcss', 'vitest', 'jest', 'playwright', 'pytest'])];
    const nm = path.basename(p.dir === '.' ? root : p.dir).toLowerCase();
    let role = 'other', why = 'no strong signal';
    if (has(MOBILE).length) [role, why] = ['mobile', `depends on ${has(MOBILE)[0]}`];
    else if (has(DESKTOP).length) [role, why] = ['desktop', `depends on ${has(DESKTOP)[0]}`];
    else if (has(FRONT).length && !has(BACK).length) [role, why] = ['frontend', `depends on ${has(FRONT)[0]}`];
    else if (has(BACK).length) [role, why] = ['backend', `depends on ${has(BACK)[0]}`];
    else if (has(DATA).length) [role, why] = ['data', `depends on ${has(DATA)[0]}`];
    else if (/^(web|client|frontend|ui|app|site|www)$/.test(nm)) [role, why] = ['frontend', `folder name "${nm}"`];
    else if (/^(api|server|backend|service|services|worker)$/.test(nm)) [role, why] = ['backend', `folder name "${nm}"`];
    else if (/^(packages?|libs?|shared|common|core)$/.test(nm) || pkg?.main || pkg?.exports) [role, why] = ['library', pkg?.main ? 'has a "main" entry' : pkg?.exports ? 'has an "exports" entry' : `folder name "${nm}"`];
    p.role = role; p.roleWhy = why;
    p.workspaceRoot = p.dir === '.' && hasWs;
  }
  for (const p of parts) if (p.workspaceRoot) p._members = parts.filter((q) => q.member).map((q) => q.dir);
  return parts;
}

// ---------- which commands can prove the product still works ----------
const MUTATING = /--write\b|--fix\b|--fix-[a-z]+|\s-w(\s|$)|--unsafe|\bformat\b(?!.*--check)/;
const mutating = (script) => typeof script === 'string' && MUTATING.test(script);
function workspaceGlobs(root) {
  const pkg = loadJson(path.join(root, 'package.json')); const g = [];
  if (Array.isArray(pkg?.workspaces)) g.push(...pkg.workspaces); else if (Array.isArray(pkg?.workspaces?.packages)) g.push(...pkg.workspaces.packages);
  for (const l of read(path.join(root, 'pnpm-workspace.yaml')).split('\n')) { const m = l.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/); if (m && !/^packages:/.test(l)) g.push(m[1]); }
  return g.filter((x) => typeof x === 'string' && !x.startsWith('!'));
}
const globRe = (g) => new RegExp(`^${g.replace(/^\.\//, '').replace(/\/+$/, '').split('/').map((seg) => (seg === '**' ? '.*' : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))).join('/')}$`);

const otherDirs = (files, root, part) => (part._others ?? []);
function partChecks(root, part, files) {
  const abs = path.join(root, part.dir); const has = (f) => existsSync(path.join(abs, f)); const found = [];
  const add = (kind, cmd, source) => found.push({ part: part.dir, kind, cmd, source: `${part.dir === '.' ? '' : `${part.dir}/`}${source}` });
  if (part.kinds.includes('node')) {
    const pkg = loadJson(path.join(abs, 'package.json')) ?? {}; const lk = (f) => has(f) || existsSync(path.join(root, f));
    const pm = lk('pnpm-lock.yaml') ? 'pnpm' : lk('yarn.lock') ? 'yarn' : (lk('bun.lockb') || lk('bun.lock')) ? 'bun' : 'npm';
    const run = pm === 'bun' ? 'bun run' : `${pm} run`; const sc = pkg.scripts ?? {};
    // a workspace root's script often delegates ("--filter web lint"): look at the members' scripts of the same name too
    const kids = part.workspaceRoot ? workspaceGlobs(root).map(globRe) : [];
    const memberScript = (n) => (part.workspaceRoot ? (part._members ?? []).map((m) => loadJson(path.join(root, m, 'package.json'))?.scripts?.[n]) : []);
    for (const [k, names] of Object.entries({ lint: ['lint'], typecheck: ['typecheck', 'type-check', 'tsc'], test: ['test'], build: ['build'] })) {
      const n = names.find((x) => sc[x]); if (!n) continue;
      const cmd = k === 'test' ? (pm === 'bun' ? 'bun run test' : `${pm} test`) : `${run} ${n}`;
      const bad = [sc[n], ...memberScript(n)].find(mutating);
      if (k === 'lint' && bad) { found.skipped = [...(found.skipped ?? []), { part: part.dir, cmd, why: `rewrites files: ${String(bad).slice(0, 50)}` }]; continue; }
      add(k, cmd, `package.json scripts.${n}`);
    }
    void kids;
  }
  if (part.kinds.includes('python')) {
    const txt = ['pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'setup.py'].map((n) => read(path.join(abs, n))).join('\n');
    const pre = part.dir === '.' ? '' : `${part.dir}/`;
    const mine = files.filter((f) => (pre ? f.startsWith(pre) : !otherDirs(files, root, part).some((d) => f.startsWith(`${d}/`))));
    const isT = (f) => /(^|\/)test_[^/]+\.py$|_test\.py$/.test(f);
    const lkp = (f) => has(f) || existsSync(path.join(root, f));
    const runner = lkp('uv.lock') ? 'uv run ' : lkp('poetry.lock') ? 'poetry run ' : '';
    const py = runner ? 'python' : pyBin();
    if (/pytest/.test(txt) || has('pytest.ini') || (has('tox.ini') && /pytest/.test(read(path.join(abs, 'tox.ini'))))) add('test', `${runner}${py} -m pytest -q`, 'pytest found in the Python project files');
    else if (mine.some(isT)) {
      // unittest only descends into packages: a tests/ folder without __init__.py needs -s
      const dirs = [...new Set(mine.filter(isT).map((f) => path.posix.dirname(f.slice(pre.length))))];
      const sd = dirs.length === 1 && dirs[0] !== '.' && !has(`${dirs[0]}/__init__.py`) ? ` -s ${dirs[0]}` : '';
      add('test', `${runner}${py} -m unittest discover${sd}`, 'test_*.py files found (unittest)');
    }
  }
  if (part.kinds.includes('rust')) add('test', 'cargo test', 'Cargo.toml');
  if (part.kinds.includes('go')) add('test', 'go test ./...', 'go.mod');
  if (part.kinds.includes('java')) {
    if (has('pom.xml')) add('test', has('mvnw') ? `${process.platform === 'win32' ? 'mvnw.cmd' : './mvnw'} -q test` : 'mvn -q test', 'pom.xml');
    else add('test', has('gradlew') ? `${process.platform === 'win32' ? 'gradlew.bat' : './gradlew'} test` : 'gradle test', 'build.gradle');
  }
  if (part.kinds.includes('ruby')) { if (has('spec')) add('test', 'bundle exec rspec', 'spec/ folder'); else if (has('Rakefile')) add('test', 'bundle exec rake test', 'Rakefile'); }
  if (part.kinds.includes('php') && (loadJson(path.join(abs, 'composer.json'))?.scripts?.test)) add('test', 'composer test', 'composer.json scripts.test');
  if (part.kinds.includes('dotnet')) add('test', 'dotnet test', '*.sln / *.csproj');
  return found;
}
// Every detected check, per part. Parts whose checks are already run by a workspace root are marked covered and left out of the guard.
export function detectChecks(root, parts, files) {
  files ??= listFiles(root); parts ??= detectParts(root, files);
  const all = []; const skipped = [];
  for (const p of parts) { const f = partChecks(root, p, files); all.push(...f); skipped.push(...(f.skipped ?? [])); }
  const rootRuns = parts.some((p) => p.workspaceRoot) && all.some((c) => c.part === '.' && ['test', 'build'].includes(c.kind));
  const member = new Set(parts.filter((p) => p.member).map((p) => p.dir));
  for (const c of all) c.covered = rootRuns && c.part !== '.' && member.has(c.part);
  return Object.assign(all, { skipped });
}
function projectChecks(root, override, only) {
  const out = (list, source) => ({ list, source });
  if (Array.isArray(override) && override.length) return out(override.map((c) => ({ cmd: String(c), part: '.' })), 'passed in this call');
  const cfg = loadJson(path.join(kitDirOf(root), 'kit.config.json')) ?? {};
  if (Array.isArray(cfg.guard?.checks) && cfg.guard.checks.length) return out(cfg.guard.checks.map((c) => ({ cmd: String(c.cmd ?? c), part: String(c.cwd ?? '.') })), 'kit.config.json "guard.checks"');
  if (Array.isArray(cfg.checks) && cfg.checks.length) return out(cfg.checks.map((c) => ({ cmd: String(c), part: '.' })), 'kit.config.json "checks"');
  const d = detectChecks(root).filter((c) => !c.covered);
  let list = d.map((c) => ({ cmd: c.cmd, part: c.part }));
  const src = d.length ? 'detected from the project files (suggestion; put the real ones in kit.config.json "checks")' : 'none found';
  if (only?.length) { const want = only.map((x) => String(x).replace(/\/+$/, '')); list = list.filter((c) => want.includes(c.part)); }
  return out(list, src);
}
const keyOf = (c) => `${c.part ?? '.'}::${c.cmd}`;

// ---------- one analysis shared by scan and state ----------
function analyze(root, { deep = true } = {}) {
  const files = listFiles(root); const repo = isRepo(root);
  const parts = detectParts(root, files); const checks = detectChecks(root, parts, files);
  const tests = files.filter((f) => TEST_FILE.test(f));
  const src = files.filter((f) => SRC_EXT.test(f) && !TEST_FILE.test(f) && !/\.(css|scss|html|sql)$/i.test(f));
  const commits = repo ? Number(gitRun(root, ['rev-list', '--count', 'HEAD']).stdout.trim()) || 0 : 0;
  const ci = existsSync(path.join(root, '.github/workflows')) ? readdirSync(path.join(root, '.github/workflows')).filter((f) => /\.ya?ml$/.test(f)) : [];
  const kit = existsSync(path.join(kitDirOf(root), 'kit.mjs'));
  const ratio = src.length ? tests.length / src.length : 0;
  let stage, path_;
  if (!src.length) { stage = 'empty (nothing built yet)'; path_ = `start from the idea: ${CLI} init (or kit_init) with the product name and a brief, then /kit-consult with kind "build" so it interviews you, compares options and turns the answer into milestones.`; }
  else if (kit) { stage = 'managed (the kit is installed)'; path_ = `resume: kit_run recover, then continue. Refresh docs/STATE.md with ${CLI} state after each milestone.`; }
  else if (src.length < 15 && commits < 10) { stage = 'early (a small codebase with little history)'; path_ = `adopt it now while it is small: ${CLI} adopt (needs a clean git tree), then /kit-consult to plan the rest.`; }
  else if (ratio < 0.1 && !ci.length) { stage = 'half-built (real code, little protection)'; path_ = `${CLI} adopt first, then write tests around what you will touch BEFORE changing it (ask /kit-consult kind "improve"), because the guard proves little until then.`; }
  else { stage = 'established (tests or CI exist)'; path_ = `${CLI} adopt, then guard baseline, then audit against VISION.md and add the missing work as steps.`; }
  const R = { skipped: checks.skipped ?? [], files, repo, parts, checks, tests, src, commits, ci, kit, ratio, stage, nextPath: path_, hits: [], todo: 0, big: [], scanned: 0 };
  if (deep) {
    const sizes = [];
    for (const f of src.slice(0, MAX_READ)) {
      let st; try { st = statSync(path.join(root, f)); } catch { continue; }
      if (st.size > 400000) continue;
      let t; try { t = rd(path.join(root, f)); } catch { continue; }
      R.scanned++; sizes.push([f, t.split('\n').length]);
      R.todo += (t.match(/\b(TODO|FIXME|HACK|XXX)\b/g) ?? []).length;
      if (R.hits.length < 8) t.split('\n').forEach((line, i) => { for (const [n, re] of SECRETS) if (re.test(line) && R.hits.length < 8) R.hits.push(`${f}:${i + 1} looks like ${n}`); });
    }
    R.big = sizes.sort((a, b) => b[1] - a[1]).slice(0, 5);
  }
  return R;
}

// ---------- scan: one read-only command for any folder, kit or not ----------
export function scanProject(p, { brief = false } = {}) {
  const root = path.resolve(p || process.cwd());
  if (!existsSync(root)) throw err(`folder not found: ${root}`);
  const A = analyze(root); const L = []; const out = (x = '') => L.push(x);
  const has = (f) => existsSync(path.join(root, f));
  out(`Scan of ${root}`);
  out('Read-only: nothing was run, installed or written. [V] = read from the files just now. [I] = inference from a heuristic, treat as a lead, not a fact.');
  if (A.repo) {
    const br = gitRun(root, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim() || '(no commits yet)';
    const dirty = gitRun(root, ['status', '--porcelain']).stdout.split('\n').filter(Boolean).length;
    const remote = gitRun(root, ['remote']).stdout.trim() || 'none';
    out(`[V] Git: branch ${br}, ${A.commits} commit(s), remote ${remote}, ${dirty} uncommitted change(s), ${A.files.total ?? A.files.length} file(s)${dirty ? '. Commit or stash before any big change so it can be undone.' : ''}`);
  } else out(`[V] Not a git repository (${A.files.length} file(s)). Guard, consult and adopt need git; run "git init" and commit first, so every change can be undone.`);
  if ((A.files.total ?? 0) > MAX_FILES) out(`[V] NOTE: only the first ${MAX_FILES} of ${A.files.total} files were listed; counts below are a sample.`);
  out(`[I] Stage: ${A.stage}. Suggested path: ${A.nextPath}`);
  const ext = {}; for (const f of A.files) { const m = f.match(/\.([A-Za-z0-9]+)$/); if (m && SRC_EXT.test(f)) ext[m[1].toLowerCase()] = (ext[m[1].toLowerCase()] ?? 0) + 1; }
  out(`[V] Source files by type: ${Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ') || 'none recognised'}`);
  if (A.parts.length) {
    out(`[V] Parts found (${A.parts.length}). Roles are [I]:`);
    for (const pt of A.parts) {
      const cs = A.checks.filter((c) => c.part === pt.dir);
      out(`    ${pt.dir.padEnd(14)} ${(pt.kinds.join('+') || 'files only').padEnd(8)} ${pt.role.padEnd(9)} src ${String(pt.files).padStart(4)}  tests ${String(pt.tests).padStart(3)}  ${pt.workspaceRoot ? 'workspace root; ' : ''}${cs.length ? (cs.every((c) => c.covered) ? 'checks run by the workspace root' : `checks: ${cs.map((c) => c.cmd).join(', ')}`) : 'NO check found'}  (${pt.roleWhy})`);
    }
  }
  const usable = A.checks.filter((c) => !c.covered);
  out(usable.length ? `[V] The guard will run ${usable.length} command(s), each in its own part folder: ${usable.map((c) => `${c.cmd}${c.part === '.' ? '' : ` [${c.part}]`}`).join('; ')}. Toolchains for non-Node stacks are not checked here.` : '[V] No test, lint, typecheck or build command found anywhere. Without one nothing can prove a change did not break the product: give the agent your real command first (kit.config.json "checks").');
  if (A.skipped.length) out(`[I] Not run by the guard because the script would rewrite your files: ${[...new Map(A.skipped.map((x) => [x.cmd, x])).values()].map((x) => `${x.cmd} (${x.why})`).join('; ')}. Give the guard a read-only check (for example a lint --check command) in kit.config.json "checks" if you want one.`);
  const noCheck = A.parts.filter((pt) => pt.files > 0 && !A.checks.some((c) => c.part === pt.dir) && !pt.member);
  if (noCheck.length) out(`[I] Parts with source files and no check: ${noCheck.map((x) => x.dir).join(', ')}. A change there cannot be verified by the guard.`);
  out(`[V] Tests: ${A.tests.length} test file(s) for ${A.src.length} source file(s)${A.src.length ? ` (${A.ratio.toFixed(2)} per source file)` : ''}`);
  if (A.src.length >= 10 && A.ratio < 0.1) out('[I] Low test coverage by file count: a green guard proves little here. Expect to add tests around anything you change.');
  out(`[V] CI: ${A.ci.length ? A.ci.join(', ') : 'no workflow in .github/workflows'}`);
  out(`[V] Largest source files: ${A.big.map(([f, n]) => `${f} (${n} lines)`).join(', ') || 'none'}; TODO/FIXME/HACK markers: ${A.todo} (read ${A.scanned} of ${A.src.length} source files)`);
  if (A.big[0] && A.big[0][1] > 600) out(`[I] ${A.big[0][0]} is very large; changes there are the most likely to break something unrelated.`);
  const envTracked = A.files.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !/\.(example|sample|template)$/.test(f));
  const ign = has('.gitignore') ? rd(path.join(root, '.gitignore')) : '';
  out(`[V] Hygiene: .gitignore ${has('.gitignore') ? 'present' : 'missing'}${A.parts.some((x) => x.kinds.includes('node')) ? (ign.includes('node_modules') ? ', ignores node_modules' : ', does NOT mention node_modules') : ''}; ${envTracked.length ? `env file(s) present and not ignored: ${envTracked.join(', ')}` : 'no .env file in the tracked set'}; ${A.hits.length ? `possible secrets (values not shown): ${A.hits.join('; ')}` : 'no secret-looking text in the source files read'}`);
  if (A.repo && !brief) {
    const log = gitRun(root, ['log', '--since=90.days', '--name-only', '--pretty=format:']).stdout.split('\n').filter((f) => f && A.files.includes(f));
    const count = {}; for (const f of log) count[f] = (count[f] ?? 0) + 1;
    const churn = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (churn.length) {
      out(`[V] Most changed files, last 90 days: ${churn.map(([f, n]) => `${f} (${n})`).join(', ')}`);
      const bare = churn.filter(([f]) => SRC_EXT.test(f) && !TEST_FILE.test(f) && !A.tests.some((t) => path.basename(t).replace(/\.(test|spec)(?=\.)/, '').replace(/^test_/, '') === path.basename(f)));
      if (bare.length) out(`[I] Frequently changed with no test file of the same name: ${bare.map(([f]) => f).join(', ')}. These are the likeliest places for a regression to hide.`);
    }
  }
  out(`[V] Docs: ${has('README.md') ? 'README.md' : 'no README.md'}${has('docs') ? ', docs/' : ''}${has('docs/STATE.md') ? ' (STATE.md present)' : ''}${has('AGENTS.md') ? ', AGENTS.md' : ''}${has('CLAUDE.md') ? ', CLAUDE.md' : ''}; kit: ${A.kit ? 'installed' : 'not installed'}`);
  if (A.repo) { const b = loadJson(guardFile(root, 'baseline.json')); out(`[V] Regression baseline: ${b ? `recorded at ${b.sha.slice(0, 8)} on ${b.createdAt.slice(0, 16).replace('T', ' ')}` : 'none yet. Record one BEFORE changing anything (guard baseline).'}`); }
  return L.join('\n');
}

// ---------- state folder ----------
function stateDir(root, sub) {
  const r = gitRun(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const common = (r.stdout || '').trim();
  if (r.status !== 0 || !common) throw err(`${root} is not a git repository. Run "git init" and make a first commit; guard and consult keep their records inside .git and need it to undo changes.`);
  const d = path.join(common, 'kit', 'helm', sub); mkdirSync(d, { recursive: true }); return d;
}
const guardFile = (root, name) => { try { return path.join(stateDir(root, 'guard'), name); } catch { return path.join(root, '.git', 'kit', 'helm', 'guard', name); } };

// ---------- guard: prove the product still works ----------
function runOne(root, c, timeoutSec) {
  const t0 = Date.now(); const cwd = path.join(root, c.part ?? '.');
  if (!existsSync(cwd)) return { cmd: c.cmd, part: c.part ?? '.', status: 'error', exit: null, ms: 0, tail: `folder ${c.part} does not exist` };
  const r = spawnSync(c.cmd, { cwd, shell: true, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, CI: '1' } });
  const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-12).join('\n');
  const status = r.error?.code === 'ETIMEDOUT' ? 'timeout' : r.error ? 'error' : r.status === 0 ? 'pass' : 'fail';
  return { cmd: c.cmd, part: c.part ?? '.', status, exit: r.status, ms: Date.now() - t0, tail: status === 'pass' ? '' : (status === 'error' ? `${r.error?.message ?? ''}\n${text}` : text).slice(-1500) };
}
export function guard(p, { action = 'check', checks, only, timeoutSec = 600 } = {}) {
  const root = path.resolve(p || process.cwd());
  if (!existsSync(root)) throw err(`folder not found: ${root}`);
  const bf = path.join(stateDir(root, 'guard'), 'baseline.json'), lf = path.join(stateDir(root, 'guard'), 'last.json');
  const head = gitRun(root, ['rev-parse', 'HEAD']);
  if (head.status !== 0) throw err('this repository has no commit yet. Make a first commit so there is a state to return to.');
  const sha = head.stdout.trim();
  const lbl = (r) => `${r.part && r.part !== '.' ? `[${r.part}] ` : ''}${r.cmd}`;
  if (action === 'status') {
    const b = loadJson(bf), l = loadJson(lf);
    return { code: 0, verdict: 'STATUS', text: b ? `Baseline: ${b.checks.map((c) => `${lbl(c)} ${c.status}`).join('; ')} (at ${b.sha.slice(0, 8)}, ${b.createdAt.slice(0, 16).replace('T', ' ')}${b.dirty ? ', recorded with uncommitted changes' : ''}). HEAD is ${sha.slice(0, 8)}.\nLast check: ${l ? `${l.verdict}${l.partial ? ' (partial)' : ''} at ${l.at.slice(0, 16).replace('T', ' ')}` : 'none yet'}.` : 'No baseline yet. Run guard baseline before changing anything.' };
  }
  const onlyN = Array.isArray(only) && only.length ? only.map((x) => String(x).replace(/\/+$/, '') || '.') : null;
  const { list, source } = projectChecks(root, checks, action === 'baseline' ? null : onlyN);
  const run = (action === 'baseline' ? list : onlyN ? list.filter((c) => onlyN.includes(c.part ?? '.')) : list);
  if (!run.length) throw err(onlyN ? `none of the checks belongs to ${onlyN.join(', ')}. Parts with checks: ${[...new Set(projectChecks(root, checks).list.map((c) => c.part))].join(', ') || 'none'}.` : 'no checks to run. Pass "checks" (for example ["npm test"]) or set "checks" in kit.config.json. A guard with nothing to run proves nothing, so it will not pretend.');
  const dirty = gitRun(root, ['status', '--porcelain']).stdout.split('\n').filter(Boolean).length;
  const porcelain = () => new Set(gitRun(root, ['status', '--porcelain']).stdout.split('\n').filter(Boolean));
  const before = porcelain();
  const results = run.map((c) => runOne(root, c, timeoutSec));
  const touchedByChecks = [...porcelain()].filter((l) => !before.has(l)).map((l) => l.slice(3));
  const lines = (rs) => rs.map((r) => `  ${r.status.toUpperCase().padEnd(7)} ${lbl(r)}  (${Math.round(r.ms / 1000)}s${r.exit !== null && r.exit !== undefined && r.status !== 'pass' ? `, exit ${r.exit}` : ''})`).join('\n');
  if (action === 'baseline') {
    writeFileSync(bf, JSON.stringify({ sha, createdAt: new Date().toISOString(), dirty: dirty > 0, source, checks: results.map(({ cmd, part, status, exit, ms }) => ({ cmd, part, status, exit, ms })) }, null, 2));
    const failing = results.filter((r) => r.status !== 'pass');
    if (touchedByChecks.length) lines.warn = touchedByChecks;
    return { code: 0, verdict: 'BASELINE', text: `Baseline recorded at ${sha.slice(0, 8)}. Checks: ${source}.\n${lines(results)}\n${failing.length ? `Already failing before any change: ${failing.map(lbl).join(', ')}. These are not counted as regressions, and they are not fixed either.\n` : ''}${dirty ? `WARNING: ${dirty} uncommitted change(s) were present, so this baseline is not a clean state you can return to. Commit first and record it again.\n` : ''}${failing.some((f) => f.exit === 127 || /not found|cannot find module|no module named|command not found|not recognized|is not recognized as an internal or external command/i.test(f.tail)) ? 'Hint: a check failed because a tool or dependency is missing (not because of your code). Install the project\'s dependencies, then record the baseline again, or it will protect nothing.\n' : ''}${touchedByChecks.length ? `WARNING: running the checks changed ${touchedByChecks.length} file(s): ${touchedByChecks.slice(0, 8).join(', ')}. They are not read-only; review with git status.\n` : ''}Next: make the change, then run guard check.` };
  }
  const b = loadJson(bf);
  if (!b) throw err('there is no baseline. Run guard baseline BEFORE changing anything; without it "nothing broke" cannot be shown, only hoped.');
  const was = Object.fromEntries(b.checks.map((c) => [keyOf(c), c.status]));
  const regress = results.filter((r) => was[keyOf(r)] === 'pass' && r.status !== 'pass');
  const stillBad = results.filter((r) => was[keyOf(r)] && was[keyOf(r)] !== 'pass' && r.status !== 'pass');
  const fixed = results.filter((r) => was[keyOf(r)] && was[keyOf(r)] !== 'pass' && r.status === 'pass');
  const fresh = results.filter((r) => !(keyOf(r) in was));
  const scope = (c) => !onlyN || onlyN.includes(c.part ?? '.');
  const gone = b.checks.filter((c) => scope(c) && !results.some((r) => keyOf(r) === keyOf(c)));
  const notRun = onlyN ? b.checks.filter((c) => !scope(c)) : [];
  const diff = gitRun(root, ['diff', '--name-status', b.sha]).stdout.split('\n').filter(Boolean);
  const removed = diff.filter((l) => /^D/.test(l)).map((l) => l.split('\t').pop());
  const touched = diff.length + gitRun(root, ['ls-files', '--others', '--exclude-standard']).stdout.split('\n').filter(Boolean).length;
  const testsNow = listFiles(root).filter((f) => TEST_FILE.test(f)).length;
  let verdict = 'SAFE';
  if (regress.length) verdict = 'REGRESSION'; else if (gone.length || !results.some((r) => r.status === 'pass')) verdict = 'UNVERIFIED';
  const partial = notRun.length > 0;
  const notes = [];
  if (gone.length) notes.push(`checks that ran at baseline were not run now: ${gone.map(lbl).join(', ')}; "safe" cannot be claimed`);
  if (partial) notes.push(`PARTIAL: only ${onlyN.join(', ')} was checked; ${notRun.map(lbl).join(', ')} was not. Run a full check before calling the work safe or done`);
  if (fresh.length) notes.push(`new check(s) not in the baseline: ${fresh.map(lbl).join(', ')} (counted only if they pass)`);
  if (stillBad.length) notes.push(`failing before and still failing (not caused by this work): ${stillBad.map(lbl).join(', ')}`);
  if (fixed.length) notes.push(`failing before, passing now: ${fixed.map(lbl).join(', ')}`);
  if (removed.length) notes.push(`${removed.length} tracked file(s) removed since the baseline: ${removed.slice(0, 12).join(', ')}${removed.length > 12 ? ', ...' : ''}. Confirm each removal was intended`);
  if (touchedByChecks.length) notes.push(`WARNING: running the checks itself changed ${touchedByChecks.length} file(s): ${touchedByChecks.slice(0, 8).join(', ')}${touchedByChecks.length > 8 ? ', ...' : ''}. A check that writes to your tree (formatters with --write, snapshots, build output not in .gitignore) is not read-only; review with git status and undo with git restore if unintended`);
  if (b.dirty) notes.push('the baseline was recorded with uncommitted changes, so it may already include earlier damage');
  if (verdict === 'SAFE' && testsNow === 0) { verdict = 'SAFE-BUT-UNPROVEN'; notes.push('the project has no test files, so the checks that passed can only catch build, lint or type errors, not changed behaviour'); }
  const parts = {}; for (const r of results) parts[r.part] = parts[r.part] === 'fail' || r.status !== 'pass' ? 'fail' : 'pass';
  writeFileSync(lf, JSON.stringify({ at: new Date().toISOString(), verdict, partial, sha, regressions: regress.map(lbl), parts }, null, 2));
  const detail = regress.map((r) => `--- ${lbl(r)} (${r.status}) last output ---\n${r.tail}`).join('\n');
  return { code: verdict === 'REGRESSION' ? 1 : 0, verdict, text: `Guard check against baseline ${b.sha.slice(0, 8)} (${touched} file(s) changed since):\n${lines(results)}\nVERDICT: ${verdict}${partial ? ' (partial)' : ''}${regress.length ? ` — ${regress.map(lbl).join(', ')} passed before and does not now. Stop. Fix it or undo the last change (git restore / git revert) before anything else.` : ''}${notes.length ? `\nNotes:\n- ${notes.join('\n- ')}` : ''}${detail ? `\n${detail}` : ''}\nWhat this proves: only what the checks above cover. ${testsNow} test file(s) exist.` };
}

// ---------- state doc: docs/STATE.md, per part, rewritten between markers, your own text kept ----------
const MARK_A = '<!-- helm:state:begin -->', MARK_B = '<!-- helm:state:end -->';
export function writeState(p, { dryRun = false } = {}) {
  const root = path.resolve(p || process.cwd());
  if (!existsSync(root)) throw err(`folder not found: ${root}`);
  const A = analyze(root, { deep: false }); const L = [];
  const last = A.repo ? loadJson(guardFile(root, 'last.json')) : null, base = A.repo ? loadJson(guardFile(root, 'baseline.json')) : null;
  L.push(MARK_A, '# Product state', '', `Updated ${nowStamp()} by \`${SERVER_NAME} state\`. Everything between the two helm markers is rewritten each time; text outside them is yours and is kept. Roles are inferred from dependencies and folder names, so correct them in your own notes if wrong.`, '', `Stage (inferred): ${A.stage}.`, '');
  L.push('## Parts', '', '| Part | Kind | Role (inferred) | Source files | Test files | Checks | Last guard |', '|---|---|---|---|---|---|---|');
  for (const pt of A.parts) {
    const cs = A.checks.filter((c) => c.part === pt.dir);
    L.push(`| ${pt.dir} | ${pt.kinds.join('+') || 'files only'} | ${pt.role} | ${pt.files} | ${pt.tests} | ${cs.length ? (cs.every((c) => c.covered) ? 'run by workspace root' : cs.map((c) => `\`${c.cmd}\``).join(', ')) : 'none'} | ${last?.parts?.[pt.dir] ?? 'not run'} |`);
  }
  if (!A.parts.length) L.push('| (no source files yet) | | | | | | |');
  L.push('', `Guard: ${base ? `baseline at ${base.sha.slice(0, 8)} (${base.createdAt.slice(0, 10)})` : 'no baseline recorded'}; last check: ${last ? `${last.verdict}${last.partial ? ' (partial)' : ''}, ${last.at.slice(0, 16).replace('T', ' ')}` : 'none'}.`, '');
  const mf = path.join(kitDirOf(root), 'milestones.json');
  L.push('## Roadmap', '');
  if (A.kit && existsSync(mf)) {
    const ms = loadJson(mf)?.milestones ?? []; const done = (id) => existsSync(path.join(kitDirOf(root), 'done', `${id}.json`));
    for (const m of ms) { const ids = [...(m.uses ?? []), ...(m.steps ?? []).map((s) => s.id)]; const n = ids.filter(done).length; L.push(`- ${m.id} ${m.title}: ${n}/${ids.length} steps done${n === ids.length && ids.length ? ' (steps done; the founder still accepts the milestone)' : ''}`); }
    if (!ms.length) L.push('- no milestones yet');
  } else L.push(`- no kit installed (run \`${SERVER_NAME} adopt\` for an existing project or \`${SERVER_NAME} init\` for a new one)`);
  let cons = [];
  if (A.repo) { try { const d = stateDir(root, 'consults'); cons = readdirSync(d).filter((f) => /^c-[\w-]+\.json$/.test(f)).sort().map((f) => loadJson(path.join(d, f))).filter(Boolean).slice(-8); } catch { /* none */ } }
  L.push('', '## Decisions in progress (from this computer\'s consult records)', '');
  if (cons.length) for (const c of cons) L.push(`- ${c.id} [${c.kind}, ${c.stage}] ${c.request.slice(0, 90)}${c.recommendation ? `. Recommended: ${c.recommendation.choice}${c.agreement ? ' (founder agreed)' : ' (not yet agreed)'}` : ''}`); else L.push('- none recorded');
  L.push('', MARK_B);
  const block = L.join('\n');
  const f = path.join(root, 'docs', 'STATE.md'); let cur = existsSync(f) ? rd(f) : null, next;
  if (cur === null) next = `${block}\n`;
  else if (cur.includes(MARK_A) && cur.includes(MARK_B)) next = cur.slice(0, cur.indexOf(MARK_A)) + block + cur.slice(cur.indexOf(MARK_B) + MARK_B.length);
  else next = `${cur.replace(/\n*$/, '\n\n')}${block}\n`;
  if (!dryRun) { mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, next); }
  return { file: path.relative(root, f), changed: next !== cur, text: block };
}

// ---------- rules block in AGENTS.md: the standing instructions Codex and Antigravity read (they have no hooks or slash commands) ----------
const RULES_A = '<!-- helm:rules:begin -->', RULES_B = '<!-- helm:rules:end -->';
const RULES = [RULES_A, '## Helm rules (tools: kit_scan, kit_guard, kit_consult, kit_state, kit_adopt)',
  '- Before changing how an existing product behaves: kit_scan, then kit_guard baseline if none is recorded. A project with no baseline cannot show that nothing broke.',
  '- Asked for a feature, a fix, a comparison or research: open kit_consult. Interview only where an answer would change the recommendation (3 questions at most, then wait). Grade every claim Verified (with a source), Stable, Inference or Unknown. Give two or more options, each with its risk to what already works, and the strongest argument against your own recommendation. Look up anything current instead of remembering it; if you cannot, grade it Unknown.',
  '- Do not plan or build until the founder has recorded agreement in a terminal (consult agree). You cannot do that for them. After that, kit_consult plan puts the steps in the roadmap.',
  '- After each step run kit_guard check (the full check, not --only). A REGRESSION means stop: fix it or undo the step before anything else. Report each refinement round with kit_consult round and obey CONTINUE, DONE or STOP.',
  '- After each milestone run kit_state and commit docs/STATE.md.',
  '- Never say something is safe, verified, current, agreed or finished unless you checked it in this session.', RULES_B].join('\n');
export function writeRules(p, { commit = false } = {}) {
  const root = path.resolve(p || process.cwd()); const f = path.join(root, 'AGENTS.md');
  const cur = existsSync(f) ? rd(f) : null; let next;
  if (cur === null) next = `${RULES}\n`;
  else if (cur.includes(RULES_A) && cur.includes(RULES_B)) next = cur.slice(0, cur.indexOf(RULES_A)) + RULES + cur.slice(cur.indexOf(RULES_B) + RULES_B.length);
  else next = `${cur.replace(/\n*$/, '\n\n')}${RULES}\n`;
  const changed = next !== cur; if (changed) writeFileSync(f, next);
  if (changed && commit) { gitRun(root, ['add', 'AGENTS.md']); gitRun(root, ['commit', '-q', '-m', 'docs: add helm rules to AGENTS.md']); }
  return { changed, file: 'AGENTS.md' };
}

// ---------- adopt: bring an existing, half-built or finished project under the kit without touching its code ----------
export function adoptProject(p, { name, brief = '' } = {}) {
  const root = path.resolve(p || process.cwd());
  if (!existsSync(root)) throw err(`folder not found: ${root}`);
  if (!isRepo(root)) throw err('not a git repository. For a brand-new product use init. For existing files: git init, commit everything, then adopt.');
  if (gitRun(root, ['rev-parse', 'HEAD']).status !== 0) throw err('no commit yet. Commit the existing files first so adopt can never lose them.');
  if (existsSync(path.join(kitDirOf(root), 'kit.mjs'))) throw err('the kit is already installed here. Use recover / continue, and state to refresh docs/STATE.md.');
  const dirty = gitRun(root, ['status', '--porcelain']).stdout.split('\n').filter(Boolean);
  if (dirty.length) throw err(`${dirty.length} uncommitted change(s). Commit or stash them first: adopt works on a separate branch and must start from a state you can return to.\n  ${dirty.slice(0, 6).join('\n  ')}`);
  const A = analyze(root, { deep: false });
  const L = [];
  const from = gitRun(root, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  const target = 'kit/integration';
  if (from !== target) {
    const ex = gitRun(root, ['rev-parse', '--verify', '--quiet', target]).status === 0;
    const sw = gitRun(root, ex ? ['switch', target] : ['switch', '-c', target]);
    if (sw.status !== 0) throw err(`could not switch to ${target}: ${sw.stderr}`);
  }
  L.push(`Branch: ${target} (your code on ${from} is untouched; to undo everything, switch back to ${from} and delete ${target}).`);
  const r = initProject({ path: root, project: name || path.basename(root), brief });
  L.push(`Kit installed (${r.validate.split('\n')[0] || 'validated'}). AGENTS.md now carries the helm rules for Codex and Antigravity.`);
  const sc = runKit(root, ['scan', '--write-config']); const ly = runKit(root, ['layout', 'init']);
  L.push(`Scan wrote the detected checks to kit.config.json: ${sc.code === 0 ? 'ok' : `failed (${sc.out.split('\n')[0]})`}. Layout: ${ly.code === 0 ? 'today\'s top-level files recorded as in place' : `failed (${ly.out.split('\n')[0]})`}.`);
  writeRules(root);
  gitRun(root, ['add', '-A']); gitRun(root, ['commit', '-q', '-m', 'chore: adopt product kit (detected checks, layout, rules)']);
  try { const g = guard(root, { action: 'baseline' }); L.push(g.text.split('\n').slice(0, 8).join('\n')); } catch (e) { if (!e.user) throw e; L.push(`No baseline recorded: ${e.message}`); }
  try { const s = writeState(root); gitRun(root, ['add', '-A']); gitRun(root, ['commit', '-q', '-m', 'docs: add STATE.md']); L.push(`Wrote ${s.file} (parts, roles, checks, roadmap).`); } catch (e) { if (!e.user) throw e; L.push(`State not written: ${e.message}`); }
  L.push(`\nStage (inferred): ${A.stage}.`, `Parts: ${A.parts.map((x) => `${x.dir} (${x.role})`).join(', ') || 'none found'}.`, '\nNext, in order:', '1. Tell the agent: "audit this repository against VISION.md: what exists, what is missing, what is risky; then add the missing work as steps". Write VISION.md first if it is still the template.', `2. For each thing you want built or fixed: /kit-consult (interview, options, recommendation). After you agree, record it: ${CLI} consult agree --quote "<your words>".`, '3. continue. Each step is checked by the guard before it counts.');
  return L.join('\n');
}

// ---------- consult: interview, evidence, options, recommendation, plan, bounded refinement ----------
const KINDS = ['feature', 'fix', 'compare', 'research', 'improve', 'build'];
const GRADES = ['Verified', 'Stable', 'Inference', 'Unknown'];
const MAX_ROUNDS_DEFAULT = 3;
const cdir = (root) => stateDir(root, 'consults');
const cfile = (root, id) => path.join(cdir(root), `${id}.json`);
const needStr = (v, n, what) => { if (typeof v !== 'string' || v.trim().length < n) throw err(`${what} is required (${n}+ characters)`); return v.trim(); };
const arr = (v, what, min = 1) => { if (!Array.isArray(v) || v.length < min) throw err(`${what} must be a list with at least ${min} item(s)`); return v; };
const needAgree = (root) => (loadJson(path.join(kitDirOf(root), 'kit.config.json'))?.consult?.requireAgreement) !== false;
function load(root, id) {
  if (!id) { const l = readdirSync(cdir(root)).filter((f) => /^c-[\w-]+\.json$/.test(f)).sort().pop(); if (!l) throw err('no consult yet. Start one with action "open".'); id = l.replace(/\.json$/, ''); }
  const rec = loadJson(cfile(root, id)); if (!rec) throw err(`no consult ${id}`); return rec;
}
const save = (root, rec) => { rec.updatedAt = new Date().toISOString(); writeFileSync(cfile(root, rec.id), JSON.stringify(rec, null, 2)); };
function render(rec) {
  const L = [`# Consult ${rec.id} (${rec.kind}): ${rec.request}`, `Opened ${rec.createdAt.slice(0, 16).replace('T', ' ')}; stage: ${rec.stage}; refinement rounds used: ${rec.rounds.filter((r) => r.counted).length}/${rec.maxRounds}${rec.agreement ? `; founder agreed ${rec.agreement.at.slice(0, 10)}: "${rec.agreement.quote}"` : ''}`];
  rec.interview.forEach((r, i) => { L.push(`\n## Interview round ${i + 1}`); r.questions.forEach((q, j) => L.push(`- Q: ${q.q}\n  Changes the recommendation if: ${q.changes}\n  A: ${r.answers?.[j]?.a ?? '(not answered)'}`)); if (r.assumptions?.length) L.push(`  Assumed instead of asking: ${r.assumptions.join('; ')}`); });
  if (rec.evidence.length) { L.push('\n## Evidence'); rec.evidence.forEach((e) => L.push(`- [${e.grade}] ${e.claim}${e.source ? ` (source: ${e.source})` : ''}`)); }
  if (rec.options.length) {
    L.push('\n## Options'); rec.options.forEach((o) => L.push(`- **${o.name}**: ${o.summary}\n  + ${o.pros.join('; ')}\n  - ${o.cons.join('; ')}\n  Risk to what exists today: ${o.risk_to_existing}`));
    const crit = [...new Set(rec.options.flatMap((o) => (o.facts ?? []).map((f) => f.criterion)))];
    if (crit.length) { L.push('\n| Criterion | ' + rec.options.map((o) => o.name).join(' | ') + ' |', '|---|' + rec.options.map(() => '---').join('|') + '|'); for (const c of crit) L.push(`| ${c} | ` + rec.options.map((o) => { const f = (o.facts ?? []).find((x) => x.criterion === c); return f ? `${f.value} [${f.grade ?? 'Unknown'}${f.source ? `: ${f.source}` : ''}]` : 'unknown'; }).join(' | ') + ' |'); }
  }
  if (rec.recommendation) { const r = rec.recommendation; L.push(`\n## Recommendation\nChoice: ${r.choice}\nWhy: ${r.why}\nStrongest argument against it: ${r.counterargument}\nVerdict: ${r.verdict}\nWhat would change it: ${r.would_change_if}\nRegression risks: ${r.regression_risks.join('; ')}`); }
  if (rec.plan) L.push(`\n## Plan\nMilestone ${rec.plan.milestone}${rec.plan.created ? ' (new)' : ''}: ${rec.plan.steps.join(', ')}`);
  if (rec.rounds.length) { L.push('\n## Refinement rounds'); rec.rounds.forEach((r, i) => L.push(`- Entry ${i + 1}${r.counted ? '' : ' (not counted)'}: guard ${r.guard}, open high ${r.open_high}, open medium ${r.open_medium} -> ${r.decision}${r.notes ? ` (${r.notes})` : ''}`)); }
  return L.join('\n');
}
// Founder only: reachable from the command line, never from the tool.
export function agreeConsult(p, id, quote) {
  const root = path.resolve(p || process.cwd()); const rec = load(root, id);
  if (!rec.recommendation) throw err('there is no recommendation to agree to yet.');
  rec.agreement = { quote: needStr(quote, 5, '--quote (your own words, so there is a record that you decided)'), at: new Date().toISOString() };
  rec.stage = 'agreed'; save(root, rec);
  return `Recorded your agreement to consult ${rec.id} ("${rec.recommendation.choice}"). The agent may now plan and build it.`;
}
function planInto(root, rec, a) {
  const project = resolveProject(root);
  const kit = kitDirOf(project), mf = path.join(kit, 'milestones.json'), before = rd(mf);
  const ms = JSON.parse(before); const gates = JSON.parse(rd(path.join(kit, 'gates.json')));
  let mid = a.milestone, created = false;
  if (mid) { if (!ms.milestones.some((m) => m.id === mid)) throw err(`no milestone ${mid}; existing: ${ms.milestones.map((m) => m.id).join(', ')}. To create a new one leave "milestone" out and give milestone_title, purpose, can_test and founder_test.`); }
  else {
    const title = needStr(a.milestone_title, 5, 'milestone_title'), purpose = needStr(a.purpose, 15, 'purpose'), can = needStr(a.can_test, 15, 'can_test (what the founder can try when this milestone is done)');
    const ft = arr(a.founder_test, 'founder_test').map((t) => needStr(t, 10, 'each founder_test line'));
    const n = Math.max(0, ...ms.milestones.map((m) => Number((m.id.match(/^M(\d+)$/) ?? [])[1]) || 0)) + 1; mid = `M${n}`;
    ms.milestones.push({ id: mid, title, purpose, can_test: can, steps: [], founder_test: ft, skips: Array.isArray(a.skips) && a.skips.length ? a.skips.map(String) : ['Anything outside this plan.'], uses: [] });
    writeFileSync(mf, JSON.stringify(ms, null, 2) + '\n'); created = true;
  }
  const used = new Set([...gates.gates.flatMap((g) => g.steps.map((s) => s.id)), ...ms.milestones.flatMap((m) => (m.steps ?? []).map((s) => s.id))]);
  let k = (ms.milestones.find((m) => m.id === mid).steps ?? []).length;
  const GUARD = 'The guard check shows no regression (kit_guard check is not REGRESSION).';
  const steps = arr(a.steps, 'steps').map((s) => {
    let id = s.id; if (!id) { do { k++; id = `${mid}.${k}`; } while (used.has(id)); used.add(id); }
    const exit = String(s.exit ?? ''); return { ...s, id, exit: /guard/i.test(exit) ? exit : `${exit.replace(/\s*$/, '')}${exit ? ' ' : ''}${GUARD}` };
  });
  let res;
  try { res = roadmapAdd({ path: project, milestone: mid, steps }); }
  catch (e) { if (created) { writeFileSync(mf, before); runKit(project, ['render']); } throw e; }
  rec.plan = { milestone: mid, created, steps: steps.map((s) => s.id) }; rec.stage = 'planned'; save(root, rec);
  return `${created ? `Created milestone ${mid}. ` : ''}${res}`;
}
export function consult(p, a = {}) {
  const root = path.resolve(p || process.cwd());
  if (!existsSync(root)) throw err(`folder not found: ${root}`);
  const action = a.action;
  if (action === 'list') {
    const d = cdir(root); const fs = readdirSync(d).filter((f) => /^c-[\w-]+\.json$/.test(f)).sort();
    return fs.length ? fs.map((f) => { const r = loadJson(path.join(d, f)); return `${r.id}  ${r.kind.padEnd(8)} ${r.stage.padEnd(14)} ${r.request.slice(0, 80)}`; }).join('\n') : 'no consults yet';
  }
  if (action === 'open') {
    const request = needStr(a.request, 10, 'request (what the founder asked for, in their words)');
    const kind = KINDS.includes(a.kind) ? a.kind : 'feature';
    const id = `c-${Date.now().toString(36)}`;
    const rec = { id, kind, request, createdAt: new Date().toISOString(), stage: 'opened', maxRounds: Number(a.max_rounds) > 0 ? Math.min(Number(a.max_rounds), 8) : MAX_ROUNDS_DEFAULT, interview: [], evidence: [], options: [], recommendation: null, agreement: null, plan: null, rounds: [] };
    save(root, rec);
    const hasBase = !!loadJson(guardFile(root, 'baseline.json'));
    return `Consult ${id} opened (${kind}).\n\n${scanProject(root, { brief: true })}\n\nHow to run this, in order:\n1. Objective: restate it in one sentence from the request, and say which hidden assumption it rests on. First test whether the underlying problem warrants a change at all; "do nothing" is a valid option.${kind === 'build' ? ' For kind "build" (a product from an idea): who it is for, the smallest first release, and what is deliberately left out; the options are different first releases or stacks.' : ''}\n2. Interview only if an answer would change the recommendation: action "ask" with at most 3 questions, each saying what the answer changes. Otherwise state your assumption (action "answer" with assumptions) and go on. Stop and wait after asking.\n3. Evidence: action "evidence". Grade every claim Verified (checked this session; needs a source), Stable, Inference or Unknown. For anything current (prices, versions, APIs, laws, a competitor's features) search the web or spawn a researcher; if you cannot, grade it Unknown, never from memory.\n4. Options: action "options", at least two, each with its risk to what exists today. For a comparison, add facts per criterion for each product, with grade and source.\n5. Recommend: action "recommend" with the strongest counterargument, a verdict and what would change it.\n6. ${hasBase ? 'A regression baseline exists.' : 'Before changing anything run kit_guard baseline (none recorded yet).'} After the founder agrees: action "plan" turns the recommendation into milestone steps, you build, kit_guard check after each step, and "round" reports each refinement. The server decides when to stop.`;
  }
  const rec = load(root, a.id);
  if (action === 'show') return render(rec);
  if (action === 'agree') throw err(`only the founder can record agreement, in a terminal (so an agent cannot agree with itself): ${CLI} consult agree ${rec.id} --quote "<your words>"`);
  if (action === 'ask') {
    const last = rec.interview.at(-1);
    if (last && !last.answers) throw err('the last round of questions has not been answered yet. Wait for the founder; do not ask more or answer for them.');
    if (rec.interview.length >= 3) throw err('three interview rounds are already used. Proceed on stated assumptions (action "answer" with assumptions) and say plainly what you assumed.');
    const qs = arr(a.questions, 'questions').slice(0, 3).map((q) => ({ q: needStr(q?.q, 8, 'each question'), changes: needStr(q?.changes, 15, 'for each question, "changes" (which answer would change the recommendation, and how)') }));
    rec.interview.push({ at: new Date().toISOString(), questions: qs }); rec.stage = 'interviewing'; save(root, rec);
    return `Ask the founder exactly these, in one message, then stop and wait for the answers:\n${qs.map((q, i) => `${i + 1}. ${q.q}`).join('\n')}\nThen record them with action "answer".`;
  }
  if (action === 'answer') {
    let r = rec.interview.at(-1);
    const assumptions = (a.assumptions ?? []).map(String).filter(Boolean);
    if (!r || r.answers) { if (!assumptions.length) throw err('there is no open question round. To go on without asking, pass "assumptions" (what you are assuming and why).'); r = { at: new Date().toISOString(), questions: [], answers: [] }; rec.interview.push(r); }
    else { const ans = arr(a.answers, 'answers', r.questions.length); r.answers = r.questions.map((q, i) => ({ q: q.q, a: needStr(ans[i]?.a ?? (typeof ans[i] === 'string' ? ans[i] : ''), 1, `answer ${i + 1}`) })); }
    if (assumptions.length) r.assumptions = assumptions;
    rec.stage = 'interviewed'; save(root, rec); return 'Recorded. Next: evidence, then options.';
  }
  if (action === 'evidence') {
    const items = arr(a.items, 'items').map((e) => {
      const grade = GRADES.includes(e?.grade) ? e.grade : null; if (!grade) throw err(`each item needs grade: ${GRADES.join(' | ')}`);
      const claim = needStr(e.claim, 8, 'each claim'); const source = typeof e.source === 'string' ? e.source.trim() : '';
      if (grade === 'Verified' && source.length < 3) throw err(`"${claim.slice(0, 40)}": Verified needs a source (a file path, a command and its result, or a URL). If you did not check it, grade it Inference or Unknown.`);
      return { claim, grade, ...(source ? { source } : {}) };
    });
    rec.evidence.push(...items); rec.stage = 'evidence'; save(root, rec);
    const c = Object.fromEntries(GRADES.map((g) => [g, rec.evidence.filter((e) => e.grade === g).length]));
    return `Recorded ${items.length}. Evidence so far: ${GRADES.map((g) => `${c[g]} ${g}`).join(', ')}.${c.Unknown ? ' Say plainly in the recommendation which Unknowns could change it.' : ''}`;
  }
  if (action === 'options') {
    const opts = arr(a.options, 'options', 2).map((o) => ({
      name: needStr(o?.name, 2, 'each option name'), summary: needStr(o?.summary, 10, `option "${o?.name}" summary`),
      pros: arr(o.pros, `option "${o.name}" pros`).map(String), cons: arr(o.cons, `option "${o.name}" cons`).map(String),
      risk_to_existing: needStr(o.risk_to_existing, 10, `option "${o.name}" risk_to_existing (what could this break in what already works?)`),
      ...(Array.isArray(o.facts) ? { facts: o.facts.map((f) => ({ criterion: needStr(f?.criterion, 2, 'fact criterion'), value: String(f?.value ?? 'unknown'), grade: GRADES.includes(f?.grade) ? f.grade : 'Unknown', ...(f?.source ? { source: String(f.source) } : {}) })) } : {}),
    }));
    rec.options = opts; rec.stage = 'options'; save(root, rec); return `Recorded ${opts.length} options. Next: recommend (with the strongest counterargument).`;
  }
  if (action === 'recommend') {
    if (rec.options.length < 2) throw err('record at least two options first (action "options"); "do nothing" counts as one.');
    if (!rec.evidence.length) throw err('record evidence first (action "evidence"), graded.');
    const choice = needStr(a.choice, 2, 'choice');
    if (choice.toLowerCase() !== 'none' && !rec.options.some((o) => o.name === choice)) throw err(`choice must be one of: ${rec.options.map((o) => o.name).join(', ')} (or "none")`);
    rec.recommendation = { choice, why: needStr(a.why, 20, 'why'), counterargument: needStr(a.counterargument, 30, 'counterargument (the strongest specific argument against your own recommendation)'), verdict: needStr(a.verdict, 15, 'verdict'), would_change_if: needStr(a.would_change_if, 15, 'would_change_if (what finding would flip the verdict)'), regression_risks: arr(a.regression_risks, 'regression_risks').map(String) };
    rec.agreement = null; rec.stage = 'recommended'; save(root, rec);
    const base = loadJson(guardFile(root, 'baseline.json'));
    return `Recommendation recorded.\nPresent it to the founder: choice, why, the counterargument, the verdict and what would change it. Do not plan or build until the founder agrees.\n${needAgree(root) ? `The founder records agreement in a terminal, which an agent cannot do for them: ${CLI} consult agree ${rec.id} --quote "<their words>". Tell them to run it, then continue.` : 'This project does not require a recorded agreement (kit.config.json consult.requireAgreement is false): wait for a clear yes in the chat.'}\nAfter that: ${base ? 'a baseline exists (check it is recent with kit_guard status)' : 'run kit_guard baseline first'}; action "plan" adds the steps to the roadmap (it adds the guard check to every exit); build; kit_guard check after each step; then action "round". Limit: ${rec.maxRounds} refinement rounds.`;
  }
  if (action === 'plan') {
    if (!rec.recommendation) throw err('no recommendation recorded yet.');
    if (rec.recommendation.choice.toLowerCase() === 'none') throw err('the recommendation was "none": there is nothing to plan.');
    if (needAgree(root) && !rec.agreement) throw err(`the founder has not agreed yet. They record it in a terminal: ${CLI} consult agree ${rec.id} --quote "<their words>"`);
    return planInto(root, rec, a);
  }
  if (action === 'round') {
    if (!rec.recommendation) throw err('no recommendation recorded yet; rounds only count after the founder agreed to build.');
    if (needAgree(root) && !rec.agreement) throw err(`the founder has not agreed yet, so nothing should be built. They record it in a terminal: ${CLI} consult agree ${rec.id} --quote "<their words>"`);
    const last = loadJson(guardFile(root, 'last.json'));
    const changed = gitRun(root, ['status', '--porcelain']).stdout.split('\n').filter(Boolean).map((l) => l.slice(3).replace(/^.* -> /, ''));
    const newer = last && changed.some((f) => { try { return statSync(path.join(root, f)).mtimeMs > Date.parse(last.at); } catch { return false; } });
    const guardV = !last ? 'NOT RUN' : newer ? 'STALE' : last.partial ? 'PARTIAL' : last.verdict;
    const high = Math.max(0, Number(a.open_high) || 0), med = Math.max(0, Number(a.open_medium) || 0);
    const counted = ['SAFE', 'SAFE-BUT-UNPROVEN'].includes(guardV);
    const used = rec.rounds.filter((r) => r.counted).length;
    let decision;
    if (guardV === 'REGRESSION') decision = 'STOP: the guard shows a regression. Fix or undo it before anything else; this does not count as progress.';
    else if (['NOT RUN', 'UNVERIFIED', 'STALE', 'PARTIAL'].includes(guardV)) decision = `CONTINUE only after a fresh, full guard check that can verify (last result: ${guardV}${guardV === 'STALE' ? ': files changed after it ran' : ''}${guardV === 'PARTIAL' ? ': it checked only part of the project' : ''}). Run kit_guard check.`;
    else if (!high && !med) decision = `DONE: guard ${guardV}, no open high or medium findings. Report what was built, what was not verified, and the guard output.`;
    else if (used + 1 >= rec.maxRounds) decision = `STOP at the round limit (${rec.maxRounds}). Report plainly what is still open: ${high} high, ${med} medium. Do not claim it is finished.`;
    else decision = `CONTINUE: round ${used + 1} of ${rec.maxRounds} is recorded, ${rec.maxRounds - used - 1} left. Fix the open findings, run kit_guard check, ask a reviewer (agent_spawn) for the next list.`;
    rec.rounds.push({ at: new Date().toISOString(), counted, guard: guardV, open_high: high, open_medium: med, decision: decision.split(':')[0], notes: String(a.notes ?? '').slice(0, 200) });
    rec.stage = /^DONE/.test(decision) ? 'done' : /^STOP/.test(decision) ? 'stopped' : 'building'; save(root, rec);
    return decision;
  }
  throw err('action must be one of: open, ask, answer, evidence, options, recommend, plan, round, show, list');
}
