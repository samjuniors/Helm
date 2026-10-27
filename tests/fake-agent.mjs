// A stand-in for a real agent CLI, used only by the tests. Reads the role card on stdin, acts in its cwd.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
let prompt = ''; for await (const c of process.stdin) prompt += c;
const role = (prompt.match(/^ROLE: (\w+)/m) ?? [])[1], step = (prompt.match(/^ROLE: \w+ for step (\S+)/m) ?? [])[1];
if (prompt.includes('MODE:sleep')) { await new Promise((r) => setTimeout(r, 60000)); process.exit(0); }
if (prompt.includes('MODE:fail')) { console.error('simulated failure'); process.exit(3); }
console.log(`fake agent: role=${role} step=${step} spawned=${process.env.KIT_SPAWNED} cwd=${process.cwd()}`);
const report = { researcher: 'research', tester: 'test', debugger: 'debug', reviewer: 'review' }[role];
if (role === 'tester') { mkdirSync('tests', { recursive: true }); writeFileSync('tests/generated.test.mjs', "import assert from 'node:assert'; assert.equal(1, 1);\n"); }
if (prompt.includes('MODE:leak')) { mkdirSync('src', { recursive: true }); writeFileSync('src/leak.js', 'export const leak = 1;\n'); }
if (report) { mkdirSync('.agents/product-kit/handoffs', { recursive: true }); writeFileSync(`.agents/product-kit/handoffs/${step}.${report}.md`, `# ${role} report\nspawned=${process.env.KIT_SPAWNED}\nran the generated test: exit 0\n`); }
