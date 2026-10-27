#!/usr/bin/env node
// Product kit MCP server (stdio, JSON-RPC 2.0, no dependencies).
// The model decides when and why to spawn an agent; the runtime validates, creates and executes it.
import readline from 'node:readline';
import { initProject, roadmapAdd, kitRun, resolveProject, ALLOWED, loadPolicy, spawnAgent, readRuns, statusOf, describeRun, waitRun, cancelRun, landRun } from './runtime.mjs';

const VERSION = '0.3.0';
const INSTRUCTIONS = `Product kit: a milestone roadmap, a multi-agent protocol, git sync, QA and recovery for any project.
Start: if the project has no .agents/product-kit folder, call kit_init (ask the founder for a name and a short brief first). Then kit_run recover, then kit_run continue, and do what it prints.
Spawning helpers is YOUR decision: before coding a step, weigh whether a researcher, tester, debugger or reviewer working at the same time is worth the cost; write the decision in the handoff. If yes, call agent_spawn with a role, a concrete task and a real reason. The runtime then creates the helper's worktree, runs the configured agent there, enforces limits, and only merges the helper's work (agent_land) after checking it stayed in scope. Default to working alone on small steps.
Founder decisions and acknowledgements (ack, decide, milestone close) are never available here: the founder records them with their own words in a terminal.`;

const P = { path: { type: 'string', description: 'Project folder (defaults to the server\'s working folder or KIT_PROJECT)' } };
const TOOLS = [
  { name: 'kit_init', description: 'Create the product kit in a project folder: engine, protocol, a generic roadmap (baseline milestone M0 and first slice M1), VISION.md from the brief, AGENTS.md pointer. Initializes git if needed and commits. Ask the founder for the name and brief first.', inputSchema: { type: 'object', properties: { ...P, project: { type: 'string', description: 'Product name' }, brief: { type: 'string', description: 'What is being built, for whom, in a few sentences (goes into VISION.md)' }, slices: { type: 'array', description: 'Optional: 3 to 6 steps of the first usable slice (milestone M1)', items: { type: 'object', properties: { title: { type: 'string' }, exit: { type: 'string', description: 'How anyone checks it is done' }, lane: { type: 'string', enum: ['platform', 'security', 'frontend', 'quality', 'founder'] }, founder_test: { type: 'string' } }, required: ['title', 'exit'] } } }, required: ['project'] } },
  { name: 'kit_run', description: `Run a kit command in the project. Allowed: ${[...ALLOWED].join(', ')}. Start with recover or continue and do what they print. Founder-only commands (ack, decide, milestone close) are refused on purpose.`, inputSchema: { type: 'object', properties: { ...P, command: { type: 'string' }, args: { type: 'array', items: { type: 'string' }, description: 'Arguments, for example ["G1.1","--agent","me"] for claim' } }, required: ['command'] } },
  { name: 'kit_roadmap_add', description: 'Add steps to a milestone in milestones.json. Validates and renders; undoes the change if the roadmap would be invalid. Each step needs an id like M1.4, a lane, a title and exit evidence someone can check.', inputSchema: { type: 'object', properties: { ...P, milestone: { type: 'string' }, steps: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, lane: { type: 'string' }, exit: { type: 'string' }, type: { type: 'string', enum: ['work', 'decision'] }, deps: { type: 'array', items: { type: 'string' } }, needs: { type: 'array', items: { type: 'string' } }, defers: { type: 'string' } }, required: ['id', 'title', 'lane', 'exit'] } } }, required: ['milestone', 'steps'] } },
  { name: 'agent_policy', description: 'Show the limits and configuration for spawning helper agents (concurrency, per step, per day, timeout, allowed roles, which agent command runs) and the runs so far. Read this before deciding to spawn.', inputSchema: { type: 'object', properties: { ...P } } },
  { name: 'agent_spawn', description: 'YOU decide when and why; the runtime creates and executes. Start a helper agent (researcher, tester, debugger, reviewer, implementer) on a CLAIMED step. Use it only when parallel work is worth the cost: an unknown to research while you build, a test suite while you build, a failure that resisted two attempts, a second look at a diff, or a clearly separate part. The reason is recorded. The runtime refuses over-limit, unclaimed, or nested spawns. Returns a run id immediately; use agent_wait.', inputSchema: { type: 'object', properties: { ...P, step: { type: 'string' }, role: { type: 'string', enum: ['researcher', 'tester', 'debugger', 'reviewer', 'implementer'] }, task: { type: 'string', description: 'Exactly what the helper should do and produce' }, reason: { type: 'string', description: 'Why a separate agent is worth its cost here' }, paths: { type: 'array', items: { type: 'string' }, description: 'Implementer only: the paths it may change' } }, required: ['step', 'role', 'task', 'reason'] } },
  { name: 'agent_status', description: 'Status of one run (with the tail of its log) or of all runs.', inputSchema: { type: 'object', properties: { ...P, run_id: { type: 'string' } } } },
  { name: 'agent_wait', description: 'Wait up to timeout_sec (max 120) for a run to finish, then return its status. Call again if still running.', inputSchema: { type: 'object', properties: { ...P, run_id: { type: 'string' }, timeout_sec: { type: 'number' } }, required: ['run_id'] } },
  { name: 'agent_land', description: 'Merge a finished helper into its step: checkpoints the helper\'s work (secret scan), checks it touched only its role\'s scope and wrote its report, then merges. Refused if the run failed, timed out, or went out of scope. Read the helper\'s report afterwards.', inputSchema: { type: 'object', properties: { ...P, run_id: { type: 'string' } }, required: ['run_id'] } },
  { name: 'agent_cancel', description: 'Stop a running helper. Its worktree stays so you can read what it did.', inputSchema: { type: 'object', properties: { ...P, run_id: { type: 'string' } }, required: ['run_id'] } },
];

const text = (t, isError = false) => ({ content: [{ type: 'text', text: String(t) }], ...(isError ? { isError: true } : {}) });
const HANDLERS = {
  kit_init: async (a) => { const r = initProject(a); return text(`Kit created in ${r.root}/${r.kit}. ${r.validate}${r.committed ? ' Committed.' : ' (not committed: set git user.name and user.email, then commit)'}\n\nNext, in order:\n1. Read ${r.kit}/VISION.md and fill the empty sections with the founder.\n2. The founder records decisions G0.1 and G0.2 in a terminal: helm decide G0.1 --quote "..." (founders only).\n3. kit_run continue.\nIf you did not pass slices, milestone M1 has one placeholder step: replace it with kit_roadmap_add.`); },
  kit_run: async (a) => { const project = resolveProject(a.path); const r = kitRun(project, a.command, a.args ?? []); return text(r.out || '(no output)', r.code !== 0); },
  kit_roadmap_add: async (a) => text(roadmapAdd(a)),
  agent_policy: async (a) => { const project = resolveProject(a.path); const pol = loadPolicy(project); const runs = readRuns(project); return text(JSON.stringify({ policy: { ...pol, agentConfigured: !!pol.agent?.command }, spawnedProcess: process.env.KIT_SPAWNED === '1', runs: runs.map((r) => ({ id: r.id, step: r.step, role: r.role, status: statusOf(r).status, landed: !!r.landed })) }, null, 2)); },
  agent_spawn: async (a) => { const project = resolveProject(a.path); return text(spawnAgent(project, a).text); },
  agent_status: async (a) => { const project = resolveProject(a.path); const runs = readRuns(project); if (a.run_id) { const r = runs.find((x) => x.id === a.run_id); if (!r) throw Object.assign(new Error(`no run ${a.run_id}`), { user: true }); return text(describeRun(r)); } return text(runs.length ? runs.map(describeRun).join('\n\n---\n') : 'no runs yet'); },
  agent_wait: async (a) => { const project = resolveProject(a.path); return text(describeRun(await waitRun(project, a.run_id, a.timeout_sec ?? 60))); },
  agent_land: async (a) => { const project = resolveProject(a.path); return text(landRun(project, a.run_id)); },
  agent_cancel: async (a) => { const project = resolveProject(a.path); return text(describeRun(cancelRun(project, a.run_id))); },
};

const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...m }) + '\n');
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];
async function handle(msg) {
  const { id, method, params } = msg;
  const isReq = id !== undefined && id !== null;
  try {
    if (method === 'initialize') return send({ id, result: { protocolVersion: SUPPORTED.includes(params?.protocolVersion) ? params.protocolVersion : SUPPORTED[0], capabilities: { tools: {} }, serverInfo: { name: 'helm', version: VERSION }, instructions: INSTRUCTIONS } });
    if (method === 'ping') return send({ id, result: {} });
    if (method === 'tools/list') return send({ id, result: { tools: TOOLS } });
    if (method === 'tools/call') {
      const h = HANDLERS[params?.name];
      if (!h) return send({ id, error: { code: -32602, message: `unknown tool ${params?.name}` } });
      try { return send({ id, result: await h(params.arguments ?? {}) }); }
      catch (e) { return send({ id, result: text(e.user ? e.message : `internal error: ${e.stack ?? e.message}`, true) }); }
    }
    if (isReq) send({ id, error: { code: -32601, message: `method not found: ${method}` } });
  } catch (e) { if (isReq) send({ id, error: { code: -32603, message: e.message } }); }
}
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (l) => { if (!l.trim()) return; let m; try { m = JSON.parse(l); } catch { return send({ id: null, error: { code: -32700, message: 'parse error' } }); } handle(m); });
rl.on('close', () => process.exit(0));
