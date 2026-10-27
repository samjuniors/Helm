// Product kit runtime: scaffolding, the safe command runner and the agent orchestration runtime.
// No dependencies. The model decides WHEN and WHY to spawn; this file validates, creates and executes.
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENGINE = path.join(PLUGIN_ROOT, 'engine');
export const KIT_DIRNAME = '.agents';
export const pluginVersion = () => JSON.parse(readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8')).version;
export const SERVER_NAME = 'helm';   // the name this plugin is registered under (rename.mjs changes it)
const err = (m) => { const e = new Error(m); e.user = true; return e; };
const rd = (f) => readFileSync(f, 'utf8');
const sub = (t, vars) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

// ---------- project and kit access ----------
export const kitDirOf = (project) => path.join(project, KIT_DIRNAME, 'product-kit');
export function resolveProject(p, { allowMissingKit = false } = {}) {
  const project = path.resolve(p || process.env.KIT_PROJECT || process.cwd());
  if (!existsSync(project)) throw err(`folder not found: ${project}`);
  if (!allowMissingKit && !existsSync(path.join(kitDirOf(project), 'kit.mjs'))) throw err(`no product kit in ${project}. Run kit_init first (it creates ${KIT_DIRNAME}/product-kit).`);
  return project;
}
export function runKit(project, args, { cwd, timeoutSec = 120, kit } = {}) {
  const r = spawnSync(process.execPath, [kit ?? path.join(kitDirOf(project), 'kit.mjs'), ...args], { cwd: cwd ?? project, encoding: 'utf8', timeout: timeoutSec * 1000, env: { ...process.env, KIT_FROM_MCP: '1' } });
  const out = `${r.stdout ?? ''}${r.stderr ? `${r.stdout ? '\n' : ''}${r.stderr}` : ''}`.trim();
  if (r.error?.code === 'ETIMEDOUT') return { code: 124, out: `${out}\n(timed out after ${timeoutSec}s; the command may still have changed state, run recover)` };
  return { code: r.status ?? 1, out };
}
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const commonDir = (project) => { const r = git(project, ['rev-parse', '--path-format=absolute', '--git-common-dir']); const d = (r.stdout || '').trim(); return d ? d : path.join(project, '.git'); };

// Commands the model may run. ack and decide are deliberately absent: they record the founder's own words.
export const ALLOWED = new Set(['continue', 'recover', 'status', 'next', 'resume', 'validate', 'render', 'doctor', 'claim', 'heartbeat', 'release', 'scaffold', 'done', 'note', 'team', 'checkpoint', 'land', 'sync', 'qa', 'milestone', 'layout', 'reconcile', 'ci', 'install-hook', 'adapt', 'scan']);
const LONG = new Set(['land', 'sync', 'ci', 'milestone', 'qa', 'checkpoint']);
export function kitRun(project, command, args = []) {
  if (!ALLOWED.has(command)) throw err(`"${command}" is not available through the tools. ${['ack', 'decide'].includes(command) ? 'Founder decisions and acknowledgements are recorded by the founder in a terminal (helm ack / decide), with their own words.' : `Allowed: ${[...ALLOWED].join(', ')}`}`);
  if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) throw err('args must be an array of strings');
  if (command === 'milestone' && args[0] === 'close') throw err('milestone close needs the founder\'s own words; the founder runs it: helm milestone close <M> --quote "..."');
  if (args.includes('--quote')) throw err('--quote is for the founder; do not pass it through the tools');
  return runKit(project, [command, ...args], { timeoutSec: LONG.has(command) ? 900 : 180 });
}

// ---------- scaffolding ----------
const DIRS = ['done', 'ack', 'handoffs', 'findings', 'qa', 'briefs', 'capability-requests'];
export function initProject({ path: p, project: name, brief = '', slices = [], gitInit = true }) {
  const root = path.resolve(p || process.cwd());
  mkdirSync(root, { recursive: true });
  const kit = kitDirOf(root);
  if (existsSync(path.join(kit, 'kit.mjs'))) throw err(`a product kit already exists in ${root}. Use kit_run recover / continue.`);
  const projectName = (name || path.basename(root)).trim();
  if (!/^[\w .&'-]{2,60}$/.test(projectName)) throw err('project name: 2 to 60 letters, digits, spaces or . & \' -');
  const isRepo = git(root, ['rev-parse', '--is-inside-work-tree']).stdout?.trim() === 'true';
  if (!isRepo) { if (!gitInit) throw err('not a git repository; pass gitInit true or run git init'); const g = git(root, ['init', '-b', 'main']); if (g.status !== 0) throw err(`git init failed: ${g.stderr}`); }
  mkdirSync(kit, { recursive: true });
  const vars = { PROJECT: projectName, BRIEF: brief.trim() || '(not written yet: the founder describes what is being built here)' };
  for (const f of ['kit.mjs', 'PROTOCOL.md', 'QUALITY_BAR.md', 'LAYOUT.md', 'CAPABILITIES.md']) copyFileSync(path.join(ENGINE, f), path.join(kit, f));
  for (const f of ['MASTER_PROMPT.md', 'README.md']) writeFileSync(path.join(kit, f), sub(rd(path.join(ENGINE, f)), vars));
  writeFileSync(path.join(kit, 'VISION.md'), sub(rd(path.join(ENGINE, 'template', 'VISION.md')), vars));
  const gates = JSON.parse(sub(rd(path.join(ENGINE, 'template', 'gates.json')), vars));
  const ms = JSON.parse(rd(path.join(ENGINE, 'template', 'milestones.json')));
  if (slices.length) {
    const m1 = ms.milestones.find((m) => m.id === 'M1');
    m1.steps = slices.slice(0, 8).map((s, i) => ({ id: `M1.${i + 1}`, title: String(s.title).slice(0, 200), lane: gates.lanes.includes(s.lane) ? s.lane : 'platform', type: 'work', exit: String(s.exit), slice_of: '', defers: s.defers ?? 'everything outside this slice', ...(i === 0 ? { needs: ['G0.1'] } : {}) }));
    m1.founder_test = slices.slice(0, 8).map((s) => String(s.founder_test || s.title));
  }
  writeFileSync(path.join(kit, 'gates.json'), JSON.stringify(gates, null, 2) + '\n');
  writeFileSync(path.join(kit, 'milestones.json'), JSON.stringify(ms, null, 2) + '\n');
  if (!existsSync(path.join(kit, 'kit.config.json'))) copyFileSync(path.join(ENGINE, 'template', 'kit.config.json'), path.join(kit, 'kit.config.json'));
  for (const d of DIRS) { mkdirSync(path.join(kit, d), { recursive: true }); writeFileSync(path.join(kit, d, '.gitkeep'), ''); }
  writeFileSync(path.join(kit, 'origin.json'), JSON.stringify({ origin: 'plugin', pluginVersion: pluginVersion(), createdAt: new Date().toISOString() }, null, 2) + '\n');
  const skill = path.join(root, KIT_DIRNAME, 'skills', 'product-kit', 'SKILL.md');
  mkdirSync(path.dirname(skill), { recursive: true });
  writeFileSync(skill, `---\nname: product-kit\ndescription: Use for this project's roadmap, resuming work (recover, continue), landing steps, QA passes and founder decisions.\n---\n\n1. Read AGENTS.md first; it is binding.\n2. Stopped in the middle? Run \`node ${KIT_DIRNAME}/product-kit/kit.mjs recover\`. Otherwise run \`continue\` and do what it prints. The order of work is the active milestone.\n3. Follow ${KIT_DIRNAME}/product-kit/MASTER_PROMPT.md and PROTOCOL.md.\n`);
  const agentsMd = path.join(root, 'AGENTS.md');
  if (!existsSync(agentsMd)) writeFileSync(agentsMd, `# ${projectName}\n\nInstructions for any coding agent working in this repository. The founder's rules in \`${KIT_DIRNAME}/product-kit/VISION.md\` are binding.\n`);
  const r1 = runKit(root, ['render'], { kit: path.join(kit, 'kit.mjs') });
  const r2 = runKit(root, ['validate'], { kit: path.join(kit, 'kit.mjs') });
  if (r2.code !== 0) throw err(`the new roadmap did not validate:\n${r2.out}`);
  const ad = runKit(root, ['adapt', '--host', 'all', '--mcp', path.join(PLUGIN_ROOT, 'server', 'mcp.mjs'), '--name', SERVER_NAME], { kit: path.join(kit, 'kit.mjs') });
  if (ad.code !== 0) throw err(`could not wire the host files:\n${ad.out}`);
  let committed = false;
  git(root, ['add', '-A']);
  const c = git(root, ['commit', '-q', '-m', 'chore: add product kit']);
  committed = c.status === 0;
  return { root, kit: path.relative(root, kit), validate: r2.out, committed, render: r1.out, adapt: ad.out };
}

export function roadmapAdd({ path: p, milestone, steps }) {
  const project = resolveProject(p);
  const kit = kitDirOf(project);
  const mf = path.join(kit, 'milestones.json'), before = rd(mf);
  const ms = JSON.parse(before);
  const gates = JSON.parse(rd(path.join(kit, 'gates.json')));
  const m = ms.milestones.find((x) => x.id === milestone);
  if (!m) throw err(`no milestone ${milestone}; existing: ${ms.milestones.map((x) => x.id).join(', ')}`);
  if (!Array.isArray(steps) || !steps.length) throw err('steps must be a non-empty array');
  const all = new Set([...gates.gates.flatMap((g) => g.steps.map((s) => s.id)), ...ms.milestones.flatMap((x) => (x.steps ?? []).map((s) => s.id))]);
  m.steps ??= [];
  const problems = [];
  for (const s of steps) {
    if (!/^[A-Za-z0-9]+(\.[A-Za-z0-9]+)+$/.test(s.id ?? '')) problems.push(`bad id "${s.id}" (use something like ${milestone}.4)`);
    else if (all.has(s.id)) problems.push(`id ${s.id} already exists`);
    if (!gates.lanes.includes(s.lane)) problems.push(`${s.id}: lane must be one of ${gates.lanes.join(', ')}`);
    if (!s.title || s.title.length < 5) problems.push(`${s.id}: title too short`);
    if (!s.exit || s.exit.length < 15) problems.push(`${s.id}: exit evidence must say how someone checks it is done (15+ characters)`);
    if (!problems.length) { all.add(s.id); m.steps.push({ id: s.id, title: s.title, lane: s.lane, type: s.type === 'decision' ? 'decision' : 'work', exit: s.exit, slice_of: s.slice_of ?? '', defers: s.defers ?? 'nothing planned', ...(s.deps?.length ? { deps: s.deps } : {}), ...(s.needs?.length ? { needs: s.needs } : {}) }); }
  }
  if (problems.length) throw err(`nothing was added:\n- ${problems.join('\n- ')}`);
  writeFileSync(mf, JSON.stringify(ms, null, 2) + '\n');
  const r = runKit(project, ['render']); const v = runKit(project, ['validate']);
  if (v.code !== 0) { writeFileSync(mf, before); runKit(project, ['render']); throw err(`the roadmap did not validate, so the change was undone:\n${v.out}`); }
  return `Added ${steps.length} step(s) to ${milestone}. ${v.out}\nCommit milestones.json, MILESTONES.md and GATES.md.`;
}

// ---------- orchestration runtime ----------
const PRESETS = {
  claude: { command: 'claude', args: ['-p'], promptVia: 'stdin' },
  codex: { command: 'codex', args: ['exec', '-'], promptVia: 'stdin' },
};
const DEFAULT_POLICY = { approval: 'auto', maxConcurrent: 2, maxPerStep: 3, maxPerDay: 12, timeoutMinutes: 30, roles: ['researcher', 'tester', 'debugger', 'reviewer', 'implementer'], agent: { preset: 'claude' } };
export function loadPolicy(project) {
  let cfg = {};
  try { cfg = JSON.parse(rd(path.join(kitDirOf(project), 'kit.config.json'))); } catch { /* defaults */ }
  const pol = { ...DEFAULT_POLICY, ...(cfg.orchestrator ?? {}) };
  let agent = { ...(PRESETS[pol.agent?.preset] ?? {}), ...pol.agent };
  if (process.env.KIT_AGENT_CMD) { try { agent = { promptVia: 'stdin', args: [], ...JSON.parse(process.env.KIT_AGENT_CMD) }; } catch { throw err('KIT_AGENT_CMD must be JSON like {"command":"claude","args":["-p"],"promptVia":"stdin"}'); } }
  delete agent.preset;
  return { ...pol, agent };
}
const agentsDir = (project) => { const d = path.join(commonDir(project), 'kit', 'agents'); mkdirSync(d, { recursive: true }); return d; };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
export function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
  else { try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } } }
}
export function readRuns(project) {
  const d = agentsDir(project);
  return readdirSync(d).filter((f) => /^run-[\w-]+\.json$/.test(f)).map((f) => { try { return JSON.parse(rd(path.join(d, f))); } catch { return null; } }).filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
const saveRun = (project, run) => writeFileSync(path.join(agentsDir(project), `${run.id}.json`), JSON.stringify(run, null, 2));
export function statusOf(run) {
  if (run.state === 'proposed') return { status: 'awaiting_approval' };
  if (run.state === 'rejected') return { status: 'rejected' };
  if (existsSync(run.exitFile)) { const e = JSON.parse(rd(run.exitFile)); return { status: e.timedOut ? 'timed_out' : e.cancelled ? 'cancelled' : e.code === 0 ? 'finished' : 'failed', exitCode: e.code, note: e.note, endedAt: e.endedAt }; }
  return alive(run.runnerPid) ? { status: 'running' } : { status: 'lost', note: 'the runner is gone and left no exit record' };
}
const tail = (f, n = 15) => { try { return rd(f).split('\n').slice(-n).join('\n').trim(); } catch { return ''; } };
export function describeRun(run) {
  const s = statusOf(run);
  const parts = [`${run.id}  ${run.role} for ${run.step}  ${s.status}${s.exitCode !== undefined ? ` (exit ${s.exitCode})` : ''}  worktree ${run.cwd}`, `why: ${run.reason}`];
  if (s.note) parts.push(`note: ${s.note}`);
  const log = tail(run.logFile); if (log) parts.push(`log tail:\n${log}`);
  return parts.join('\n');
}

export function spawnAgent(project, p) {
  const pol = loadPolicy(project);
  if (process.env.KIT_SPAWNED === '1') throw err('refused: this process was itself started by the orchestration runtime. Spawned agents do not start agents (depth limit 1). Do your own work and report.');
  const { step, role, task, reason } = p;
  if (!step || !role) throw err('step and role are required');
  if (!pol.roles.includes(role)) throw err(`role "${role}" is not allowed here (allowed: ${pol.roles.join(', ')})`);
  if (!reason || reason.trim().length < 25) throw err('reason must explain, in a sentence or more, why a separate agent is worth its cost for this step');
  if (!task || task.trim().length < 20) throw err('task must say exactly what the helper should do (20+ characters)');
  if (!pol.agent?.command) throw err(`no agent command is configured. Set orchestrator.agent in ${KIT_DIRNAME}/product-kit/kit.config.json (for example {"preset":"claude"} or {"command":"codex","args":["exec","-"],"promptVia":"stdin"}) or the KIT_AGENT_CMD environment variable. Until then use the "team" command and open another chat by hand.`);
  const runs = readRuns(project);
  const running = runs.filter((r) => ['running', 'awaiting_approval'].includes(statusOf(r).status));
  if (running.length >= pol.maxConcurrent) throw err(`limit reached: ${running.length} agent run(s) already active (maxConcurrent ${pol.maxConcurrent}). Wait for one (agent_wait) or cancel one.`);
  if (runs.filter((r) => r.step === step).length >= pol.maxPerStep) throw err(`limit reached: ${step} already used ${pol.maxPerStep} helper runs (maxPerStep). Do the rest yourself or ask the founder.`);
  const today = new Date().toISOString().slice(0, 10);
  if (runs.filter((r) => r.createdAt.startsWith(today)).length >= pol.maxPerDay) throw err(`limit reached: ${pol.maxPerDay} runs started today (maxPerDay).`);
  const id = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const agentName = `spawned-${role}-${id.slice(-4)}`;
  const hs = runKit(project, ['helper', 'start', step, role, '--agent', agentName, ...(p.paths?.length ? ['--paths', p.paths.join(',')] : [])]);
  if (hs.code !== 0) throw err(`the kit refused to create the helper:\n${hs.out}`);
  const card = hs.out.replace(/^Helper ready\.\s*/, '');
  const cwd = (card.match(/^Work only in this folder: (.+)$/m) ?? [])[1];
  const branch = (card.match(/^Branch: (\S+)/m) ?? [])[1];
  if (!cwd || !existsSync(cwd)) throw err(`could not find the helper worktree in the kit output:\n${hs.out}`);
  const d = agentsDir(project);
  const run = { id, step, role, agent: agentName, reason: reason.trim(), task: task.trim(), createdAt: new Date().toISOString(), state: pol.approval === 'ask' ? 'proposed' : 'approved', cwd, branch, command: pol.agent.command, args: pol.agent.args ?? [], promptVia: pol.agent.promptVia ?? 'stdin', timeoutMs: Math.round(pol.timeoutMinutes * 60000), logFile: path.join(d, `${id}.log`), promptFile: path.join(d, `${id}.prompt.txt`), exitFile: path.join(d, `${id}.exit.json`), cancelFile: path.join(d, `${id}.cancel`) };
  writeFileSync(run.promptFile, `${card}\n\nTask from the lead: ${run.task}\nWhy you were started: ${run.reason}\n\nWhen finished: write your report, run "node ${KIT_DIRNAME}/product-kit/kit.mjs checkpoint", and stop. Do not merge, push, or run helper land. You were started by a runtime; do not start other agents.\n`);
  saveRun(project, run);
  runKit(project, ['note', step, '--doing', `spawned ${role} ${id}: ${run.reason}`.slice(0, 380), '--next', `agent_wait ${id}, then agent_land`]);
  if (run.state === 'proposed') return { run, text: `Proposed, not started: the founder must approve it in a terminal (the model cannot approve itself):\n  helm approve ${id} --path ${project}\nWorktree ready at ${cwd}.` };
  return { run: startRun(project, run), text: `Started ${role} agent ${id} for ${step} in ${cwd}. Use agent_wait / agent_status, then agent_land when it finishes.` };
}
export function startRun(project, run) {
  const child = spawn(process.execPath, [path.join(PLUGIN_ROOT, 'server', 'runner.mjs'), path.join(agentsDir(project), `${run.id}.json`)], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  run.runnerPid = child.pid; run.state = 'running'; run.startedAt = new Date().toISOString();
  saveRun(project, run);
  return run;
}
export function approveRun(project, id) {
  const run = readRuns(project).find((r) => r.id === id);
  if (!run) throw err(`no run ${id}`);
  if (run.state !== 'proposed') throw err(`${id} is ${run.state}, not awaiting approval`);
  return startRun(project, run);
}
const find = (project, id) => { const r = readRuns(project).find((x) => x.id === id); if (!r) throw err(`no run ${id}`); return r; };
export async function waitRun(project, id, timeoutSec = 60) {
  const t0 = Date.now(); let run = find(project, id);
  while ((Date.now() - t0) / 1000 < Math.min(timeoutSec, 120)) { if (!['running', 'awaiting_approval'].includes(statusOf(run).status)) break; await new Promise((r) => setTimeout(r, 1000)); run = find(project, id); }
  return run;
}
export function cancelRun(project, id) {
  const run = find(project, id);
  const s = statusOf(run);
  if (s.status !== 'running') throw err(`${id} is ${s.status}; nothing to cancel`);
  writeFileSync(run.cancelFile, 'cancel');
  for (let i = 0; i < 20 && !existsSync(run.exitFile); i++) spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},250)']);
  if (!existsSync(run.exitFile)) killTree(run.runnerPid);
  return find(project, id);
}
export function landRun(project, id) {
  const run = find(project, id);
  const s = statusOf(run);
  if (s.status !== 'finished') throw err(`${id} is ${s.status}${s.exitCode !== undefined ? ` (exit ${s.exitCode})` : ''}; only a finished run can be landed. Read the log with agent_status.`);
  if (run.landed) throw err(`${id} was already landed`);
  const wtKit = path.join(run.cwd, KIT_DIRNAME, 'product-kit', 'kit.mjs');
  if (!existsSync(wtKit)) throw err(`the helper worktree has no kit copy (${wtKit}). Commit the kit on the integration branch first.`);
  const cp = runKit(run.cwd, ['checkpoint'], { kit: wtKit, cwd: run.cwd });
  if (cp.code !== 0) throw err(`checkpoint of the helper's work failed, nothing merged:\n${cp.out}`);
  const hl = runKit(project, ['helper', 'land', run.step, run.role]);
  if (hl.code !== 0) throw err(`not merged:\n${hl.out}`);
  run.landed = true; run.landedAt = new Date().toISOString(); saveRun(project, run);
  return hl.out;
}

// ---------- versioned upgrades; user-created roadmap, state and documentation stay untouched ----------
const OWNED = ['kit.mjs', 'PROTOCOL.md', 'QUALITY_BAR.md', 'LAYOUT.md', 'CAPABILITIES.md', 'MASTER_PROMPT.md', 'README.md'];
export function upgradeProject(p, { force = false } = {}) {
  const project = resolveProject(p), kit = kitDirOf(project), marker = path.join(kit, 'origin.json');
  let origin; try { origin = JSON.parse(rd(marker)); } catch { origin = null; }
  if (origin?.origin !== 'plugin') throw err('Refusing to overwrite a kit not created by Helm (origin.json missing). Use its original updater.');
  const current = pluginVersion();
  if (origin.pluginVersion === current && !force) return 'Already at plugin version ' + current + '; nothing to do.';
  const dirty = git(project, ['status', '--porcelain', '--', KIT_DIRNAME]).stdout.trim();
  if (dirty) throw err('Commit changes inside .agents/ before upgrading; the upgrade will not mix with uncommitted work.');
  const gates = JSON.parse(rd(path.join(kit, 'gates.json')));
  const vars = { PROJECT: gates.project ?? path.basename(project), BRIEF: '' };
  const backup = path.join(kit, 'archive', 'pre-upgrade-' + (origin.pluginVersion || 'unknown') + '-' + new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(backup, { recursive: true });
  for (const file of OWNED) {
    const target = path.join(kit, file);
    if (existsSync(target)) copyFileSync(target, path.join(backup, file));
    const source = path.join(ENGINE, file);
    if (existsSync(source)) writeFileSync(target, ['MASTER_PROMPT.md', 'README.md'].includes(file) ? sub(rd(source), vars) : rd(source));
  }
  runKit(project, ['render']);
  const validation = runKit(project, ['validate']);
  if (validation.code !== 0) {
    for (const file of OWNED) if (existsSync(path.join(backup, file))) copyFileSync(path.join(backup, file), path.join(kit, file));
    rmSync(backup, { recursive: true, force: true });
    runKit(project, ['render']);
    throw err('Upgrade failed validation; original engine restored:\n' + validation.out);
  }
  writeFileSync(marker, JSON.stringify({ ...origin, previousVersion: origin.pluginVersion, pluginVersion: current, upgradedAt: new Date().toISOString() }, null, 2) + '\n');
  git(project, ['add', '-A', KIT_DIRNAME]);
  const committed = git(project, ['commit', '-q', '-m', 'chore(helm): upgrade project kit to ' + current]).status === 0;
  return 'Upgraded ' + origin.pluginVersion + ' -> ' + current + '. Engine files backed up to ' + path.relative(project, backup) + '; project roadmap and records preserved. ' + validation.out + (committed ? ' Committed.' : ' Commit manually.');
}
