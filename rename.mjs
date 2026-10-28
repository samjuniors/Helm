#!/usr/bin/env node
// Renames this plugin: the name your tools show, the MCP server key, the Claude Code plugin and marketplace names,
// the command-line tool, and the name written into new projects' tool registrations.
// It does NOT rename the folder inside your projects (.agents/product-kit), the tool names (kit_init, agent_spawn, ...) or this folder.
//   node rename.mjs --name orbit-forge        (lowercase letters, digits and dashes; starts with a letter)
//   node rename.mjs --name orbit-forge --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const slug = argv[argv.indexOf('--name') + 1];
const dry = argv.includes('--dry-run');
if (!slug || slug.startsWith('--') || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) { console.error('usage: node rename.mjs --name <new-name>   (2 to 31 characters: lowercase letters, digits, dashes; starts with a letter)'); process.exit(1); }
const OLD = fs.existsSync(path.join(here, 'bin', 'product-kit.mjs')) ? 'product-kit' : (fs.readdirSync(path.join(here, 'bin')).find((f) => f.endsWith('.mjs')) ?? '').replace(/\.mjs$/, '');
if (!OLD) { console.error('cannot find the current name (bin/<name>.mjs)'); process.exit(1); }
if (OLD === slug) { if (!dry) fs.writeFileSync(path.join(here, '.plugin-name'), slug + '\n'); console.log(`Already named ${slug}.`); process.exit(0); }

const PROTECT = [new RegExp('@samjuniors/helm', 'g'), /product-kit-plugin/g, /(?:\.?agents?\/|KIT_DIRNAME\}\/)product-kit/g, /KIT_DIRNAME, 'product-kit'/g, /name: product-kit\\ndescription/g, /'skills', 'product-kit'/g].map((r) => new RegExp(r.source.replaceAll('product-kit', OLD), 'g'));
const rewrite = (text) => {
  const saved = [];
  let t = text.replaceAll(`${OLD}-local`, `${slug}-local`);
  for (const r of PROTECT) t = t.replace(r, (m) => { saved.push(m); return `\u0000${saved.length - 1}\u0000`; });
  t = t.replaceAll(OLD, slug);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]);
};
const files = ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.mcp.json', 'hooks/hooks.json', 'server/mcp.mjs', 'server/runtime.mjs', `bin/${OLD}.mjs`, 'install.mjs', 'package.json', 'README.md', 'TODO-MAP.md', `skills/${OLD}/SKILL.md`, 'tests/e2e.mjs',
  ...fs.readdirSync(path.join(here, 'commands')).map((f) => `commands/${f}`), ...fs.readdirSync(path.join(here, 'agents')).map((f) => `agents/${f}`)];
const changed = [];
for (const f of files) {
  const p = path.join(here, f);
  if (!fs.existsSync(p)) continue;
  const before = fs.readFileSync(p, 'utf8'), after = rewrite(before);
  if (after !== before) { changed.push(f); if (!dry) fs.writeFileSync(p, after); }
}
// engine: only the three exact places that carry the plugin-level name
const ek = path.join(here, 'engine', 'kit.mjs');
let e = fs.readFileSync(ek, 'utf8'); const e0 = e;
e = e.replace(`== ${OLD} recover`, `== ${slug} recover`).replace(`: '${OLD}';`, `: '${slug}';`);
if (e !== e0) { changed.push('engine/kit.mjs'); if (!dry) fs.writeFileSync(ek, e); }
if (!dry) {
  fs.renameSync(path.join(here, 'bin', `${OLD}.mjs`), path.join(here, 'bin', `${slug}.mjs`));
  fs.renameSync(path.join(here, 'skills', OLD), path.join(here, 'skills', slug));
}
console.log(`${dry ? '[dry run] would change' : 'Changed'} ${changed.length} file(s), plus bin/${OLD}.mjs -> bin/${slug}.mjs and skills/${OLD}/ -> skills/${slug}/.`);
if (dry) process.exit(0);
let bad = 0;
for (const f of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', '.mcp.json', 'hooks/hooks.json', 'package.json']) { try { JSON.parse(fs.readFileSync(path.join(here, f), 'utf8')); } catch (x) { bad++; console.error(`INVALID JSON after rename: ${f}`); } }
for (const f of ['server/mcp.mjs', 'server/runtime.mjs', 'server/runner.mjs', `bin/${slug}.mjs`, 'install.mjs', 'engine/kit.mjs']) { const r = spawnSync(process.execPath, ['--check', path.join(here, f)], { encoding: 'utf8' }); if (r.status !== 0) { bad++; console.error(`SYNTAX ERROR after rename: ${f}\n${r.stderr}`); } }
if (bad) { console.error('Rename left problems; restore from the zip and tell me.'); process.exit(1); }
console.log(`Renamed to "${slug}". Now:\n 1. Remove the old registrations:  claude mcp remove ${OLD}   and   codex mcp remove ${OLD}\n 2. Register under the new name:    node install.mjs\n 3. Claude Code plugin: /plugin marketplace add <this folder>, then /plugin install ${slug}@${slug}-local\n 4. Projects you already set up keep their old registration: edit the "${OLD}" key in .mcp.json, .codex/config.toml and .agents/mcp_config.json, or run  node .agents/product-kit/kit.mjs adapt --host all --mcp <full path to server/mcp.mjs> --name ${slug}  (adds the new entry; delete the old one by hand).\nNot renamed on purpose: the .agents/${OLD} folder inside projects, the tool names (kit_init, agent_spawn, ...), and this folder.`);
