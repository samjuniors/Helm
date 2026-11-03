// Windows per-user PATH maintenance. Never alters machine PATH or another user's
// environment. Writes only the exact Helm launcher entry, preserving all others.
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function pathEntryKey(entry) {
  if (typeof entry !== 'string') return '';
  const expanded = entry.trim().replace(/^"|"$/g, '');
  if (!expanded) return '';
  return path.win32.normalize(expanded).replace(/[\\/]+$/, '').toLowerCase();
}

export function appendPathEntry(original, entry) {
  const current = typeof original === 'string' ? original : '';
  const key = pathEntryKey(entry);
  if (!key) throw new Error('Helm PATH entry is empty');
  const already = current.split(';').some((s) => pathEntryKey(s) === key);
  if (already) return { value: current, changed: false };
  const value = current ? (current.endsWith(';') ? current : current + ';') + entry : entry;
  if (value.length > 30000) throw new Error('user PATH is too long to extend safely');
  return { value, changed: true };
}

export function removePathEntry(original, entry) {
  const current = typeof original === 'string' ? original : '';
  const key = pathEntryKey(entry);
  if (!key) throw new Error('Helm PATH entry is empty');
  const parts = current.split(';');
  const kept = parts.filter((s) => pathEntryKey(s) !== key);
  return kept.length === parts.length
    ? { value: current, changed: false }
    : { value: kept.filter(Boolean).join(';'), changed: true };
}

// Launch a fixed PowerShell program without constructing code from a filesystem
// path. The path is passed via the process environment, not through shell quoting.
// Test-only subkeys are strictly isolated below HKCU\Software\HelmPathQA_...
const script = String.raw`
$ErrorActionPreference = 'Stop'
$bin = [Environment]::GetEnvironmentVariable('HELM_BIN_ENTRY', 'Process')
$action = [Environment]::GetEnvironmentVariable('HELM_PATH_ACTION', 'Process')
$keyName = [Environment]::GetEnvironmentVariable('HELM_PATH_KEY', 'Process')
if (-not $bin -or $action -notin @('add', 'remove')) { throw 'Invalid Helm PATH operation' }
if ($keyName -ne 'Environment' -and $keyName -notmatch '^Software\\HelmPathQA_[a-f0-9]{32}$') { throw 'Invalid registry test subkey' }
$k = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($keyName)
try {
  $old = [string]$k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  try { $kind = $k.GetValueKind('Path') }
  catch { $kind = [Microsoft.Win32.RegistryValueKind]::ExpandString }
  if ($kind -notin @([Microsoft.Win32.RegistryValueKind]::String, [Microsoft.Win32.RegistryValueKind]::ExpandString)) { throw 'Unexpected PATH registry value type' }
  $normalize = {
    param([string]$s)
    if (-not $s) { return '' }
    $expanded = [Environment]::ExpandEnvironmentVariables($s.Trim().Trim('"'))
    return ($expanded.TrimEnd([char[]]@('\', '/'))).ToLowerInvariant()
  }
  $needle = & $normalize $bin
  $parts = @($old -split ';' | Where-Object { $_ -ne '' })
  $matching = @($parts | Where-Object { (& $normalize $_) -eq $needle })
  if ($action -eq 'add') {
    if ($matching.Count -gt 0) { Write-Output 'ALREADY_PRESENT'; exit 0 }
    $updated = if ($old.EndsWith(';') -or -not $old) { $old + $bin } else { $old + ';' + $bin }
    if ($updated.Length -gt 30000) { throw 'User PATH is too long' }
  } else {
    if ($matching.Count -eq 0) { Write-Output 'ALREADY_ABSENT'; exit 0 }
    $updated = (@($parts | Where-Object { (& $normalize $_) -ne $needle })) -join ';'
  }
  $k.SetValue('Path', $updated, $kind)
  # Notify Explorer and newly opened terminals; the current PowerShell process
  # is refreshed separately by bootstrap.ps1 after installation.
  try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HelmPathEnvironmentNotification {
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint message,
        UIntPtr wParam, string lParam, uint flags, uint timeout, out UIntPtr result);
}
'@ -ErrorAction Stop
    [UIntPtr]$broadcastResult = [UIntPtr]::Zero
    [HelmPathEnvironmentNotification]::SendMessageTimeout([IntPtr]0xffff, 0x001A,
        [UIntPtr]::Zero, 'Environment', 0x0002, 3000, [ref]$broadcastResult) | Out-Null
  } catch { # Some minimal Windows installations cannot broadcast; PATH stays saved.
  }
  Write-Output 'CHANGED'
} finally {
  if ($k) { $k.Close() }
}
`;

export function changeWindowsUserPath(binDir, action, { testKey = null } = {}) {
  if (process.platform !== 'win32') throw new Error('Only Windows user PATH is supported');
  if (!path.isAbsolute(binDir)) throw new Error('Helm launcher directory must be an absolute path');
  if (!['add', 'remove'].includes(action)) throw new Error('Invalid PATH action');
  if (testKey && !/^Software\\HelmPathQA_[a-f0-9]{32}$/.test(testKey)) throw new Error('Invalid test registry key');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', timeout: 15000, windowsHide: true, maxBuffer: 512 * 1024,
    env: {
      ...process.env, HELM_BIN_ENTRY: binDir, HELM_PATH_ACTION: action,
      HELM_PATH_KEY: testKey || 'Environment',
    },
  });
  if (result.error || result.status !== 0) {
    throw new Error('Unable to safely update Windows user PATH: ' + String(result.stderr || result.error || 'unknown error').trim());
  }
  const lines = (result.stdout || '').trim().split(/\r?\n/);
  const status = lines.at(-1);
  if (!['CHANGED', 'ALREADY_PRESENT', 'ALREADY_ABSENT'].includes(status)) throw new Error('Unexpected Windows PATH helper result');
  return { changed: status === 'CHANGED', status };
}
