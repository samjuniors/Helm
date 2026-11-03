// Read-only client discovery for Helm's guided installer.
// Detection is informational, never permission to edit a client registration.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const present = (f) => {
  try { return fs.existsSync(f); } catch { return false; }
};
const nativeCommand = (name) => {
  if (!/^[a-z][a-z0-9-]*$/i.test(name)) return false;
  const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], {
    stdio: 'ignore', timeout: 2500, windowsHide: true,
  });
  return !result.error && result.status === 0;
};
export const AUTO_HOSTS = Object.freeze(['claude', 'codex']);

/**
 * CLI presence and configuration markers are distinct. A folder doesn't prove
 * a functioning app; a launchable CLI doesn't prove a live MCP connection.
 */
export function discoverClients({
  home = os.homedir(), env = process.env, platform = process.platform,
  commandExists = nativeCommand, exists = present,
} = {}) {
  const configRoot = env.APPDATA || path.join(home, 'AppData', 'Roaming');
  const codeRoot = env.CLAUDE_CONFIG_DIR || home;
  const codexRoot = env.CODEX_HOME || path.join(home, '.codex');
  const geminiRoot = env.GEMINI_CLI_HOME || home;
  const windows = platform === 'win32';
  const entries = [
    { id: 'claude', label: 'Claude Code (terminal / editor)', command: 'claude',
      marker: path.join(env.CLAUDE_CONFIG_DIR || home, '.claude'), config: path.join(codeRoot, '.claude.json'),
      integration: 'automatic', note: 'Claude Code CLI and editor integration' },
    { id: 'codex', label: 'Codex (CLI / IDE extension)', command: 'codex',
      marker: codexRoot, config: path.join(codexRoot, 'config.toml'),
      integration: 'automatic', note: 'Codex CLI and IDE extension share an MCP configuration' },
    { id: 'antigravity', label: 'Antigravity (desktop / IDE / CLI)', command: 'agy',
      marker: path.join(geminiRoot, '.gemini', 'config'), config: path.join(geminiRoot, '.gemini', 'config', 'mcp_config.json'),
      integration: 'guided-manual', note: 'Global or per-project integration; do not modify shared configuration automatically' },
    { id: 'claude_desktop', label: 'Claude Desktop', command: null,
      marker: windows ? path.join(configRoot, 'Claude') : path.join(home, 'Library', 'Application Support', 'Claude'),
      config: windows ? path.join(configRoot, 'Claude', 'claude_desktop_config.json') :
        path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      integration: 'guided-manual', note: 'Separate from Claude Code; MSIX/profile variants require manual verification' },
    { id: 'cursor', label: 'Cursor IDE', command: null,
      marker: path.join(home, '.cursor'), config: path.join(home, '.cursor', 'mcp.json'),
      integration: 'guided-manual', note: 'Manual MCP configuration; IDE loading not automatically verified' },
    { id: 'vscode', label: 'VS Code / Copilot editor', command: 'code',
      marker: windows ? path.join(configRoot, 'Code') : path.join(home, '.vscode'),
      config: windows ? path.join(configRoot, 'Code', 'User', 'mcp.json') :
        path.join(home, '.config', 'Code', 'User', 'mcp.json'),
      integration: 'guided-manual', note: 'Manual MCP configuration; editor-specific settings vary' },
  ];
  return entries.map((entry) => {
    const cli = Boolean(entry.command && commandExists(entry.command));
    const marker = exists(entry.marker);
    const configured = exists(entry.config);
    return { ...entry, cli, detected: cli || marker || configured,
      evidence: cli ? 'command available' : configured ? 'configuration exists' :
        marker ? 'application marker exists' : 'not detected',
      available: entry.integration === 'automatic' && cli };
  });
}

export function parseClientSelection(input, clients = discoverClients()) {
  const s = String(input || '').trim().toLowerCase();
  if (!s || s === 'none' || s === '0') return [];
  if (s === 'detected') return clients.filter((c) => c.available).map((c) => c.id);
  const allowed = new Set(AUTO_HOSTS);
  const names = s.split(/[,\s]+/).filter(Boolean);
  if (!names.length || names.some((x) => !allowed.has(x))) {
    throw new Error('Choose claude, codex, detected, or none; other clients need a guided manual configuration.');
  }
  return [...new Set(names)];
}

export function selectedHostFlag(ids) {
  const values = [...new Set(ids)];
  if (!values.length) return 'none';
  if (values.length === 2 && values.includes('claude') && values.includes('codex')) return 'all';
  if (values.length === 1 && AUTO_HOSTS.includes(values[0])) return values[0];
  throw new Error('Unsupported automatic-client selection');
}
