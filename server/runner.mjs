// Runs ONE agent process for the orchestration runtime. Detached from the MCP server so it survives restarts.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, openSync, existsSync, appendFileSync } from 'node:fs';
const run = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = openSync(run.logFile, 'a');
const prompt = readFileSync(run.promptFile, 'utf8');
const args = [...run.args]; if (run.promptVia === 'arg') args.push(prompt);
let finished = false, timedOut = false, cancelled = false;
const finish = (code, note) => { if (finished) return; finished = true; writeFileSync(run.exitFile, JSON.stringify({ code, timedOut, cancelled, note, endedAt: new Date().toISOString() })); process.exit(0); };
appendFileSync(run.logFile, `[runner] ${new Date().toISOString()} start ${run.command} ${args.slice(0, 6).join(' ')} cwd=${run.cwd}\n`);
const win = process.platform === 'win32';
const child = spawn(run.command, args, { cwd: run.cwd, env: { ...process.env, KIT_SPAWNED: '1', KIT_RUN_ID: run.id }, stdio: [run.promptVia === 'stdin' ? 'pipe' : 'ignore', out, out], detached: !win, shell: win && !/\.exe$/i.test(run.command), windowsHide: true });
const kill = () => { if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']); else { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 5000).unref(); } };
child.on('error', (e) => finish(127, `could not start "${run.command}": ${e.message}`));
if (run.promptVia === 'stdin') { child.stdin.on('error', () => {}); child.stdin.end(prompt); }
const timer = setTimeout(() => { timedOut = true; appendFileSync(run.logFile, '[runner] timeout, stopping the agent\n'); kill(); }, run.timeoutMs);
const poll = setInterval(() => { if (existsSync(run.cancelFile) && !cancelled) { cancelled = true; appendFileSync(run.logFile, '[runner] cancelled by the lead\n'); kill(); } }, 500);
child.on('exit', (code, sig) => { clearTimeout(timer); clearInterval(poll); finish(timedOut ? 124 : cancelled ? 130 : (code ?? 1), sig ? `signal ${sig}` : undefined); });
