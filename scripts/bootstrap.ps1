# Helm one-time bootstrap for Windows PowerShell 5.1+.
# Official source: https://github.com/samjuniors/Helm
# Downloads and verifies the latest stable release; never runs unverified ZIP contents.
param(
  [switch]$DryRun,
  [ValidateSet('all','claude','codex')][string]$Client = 'all'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$api = 'https://api.github.com/repos/samjuniors/Helm/releases/latest'
$headers = @{ 'User-Agent' = 'Helm-Bootstrap'; 'Accept' = 'application/vnd.github+json' }
$temporary = $null

try {
  $nodeMajor = & node -p "process.versions.node.split('.')[0]"
  if ($LASTEXITCODE -ne 0 -or [int]$nodeMajor -lt 18) { throw 'Helm requires Node.js 18 or newer (https://nodejs.org/).' }
  $release = Invoke-RestMethod -Uri $api -Headers $headers
  if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') {
    throw 'GitHub did not return a stable Helm release.'
  }
  $tag = [string]$release.tag_name
  $base = "https://github.com/samjuniors/Helm/releases/download/$tag"
  $zipName = "helm-$tag.zip"
  $assetNames = @($release.assets | ForEach-Object { $_.name })
  if ($zipName -notin $assetNames -or 'SHA256SUMS' -notin $assetNames) {
    throw 'The official Helm release is missing its ZIP or SHA256SUMS.'
  }
  Write-Output "Helm $tag - verified installer"
  Write-Output "Release: https://github.com/samjuniors/Helm/releases/tag/$tag"
  if ($DryRun) { Write-Output 'DRY RUN: the release would be downloaded, checksum verified and setup previewed.' }

  $temporary = Join-Path ([System.IO.Path]::GetTempPath()) ('helm-bootstrap-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $temporary -ErrorAction Stop | Out-Null
  $zipPath = Join-Path $temporary $zipName
  $sumsPath = Join-Path $temporary 'SHA256SUMS'
  Invoke-WebRequest -Uri "$base/SHA256SUMS" -OutFile $sumsPath -Headers @{ 'User-Agent'='Helm-Bootstrap' }
  Invoke-WebRequest -Uri "$base/$zipName" -OutFile $zipPath -Headers @{ 'User-Agent'='Helm-Bootstrap' }

  if ((Get-Item -LiteralPath $zipPath).Length -gt 33554432) { throw 'The release ZIP exceeds the 32 MiB safety limit.' }
  $matchesForZip = @()
  foreach ($line in (Get-Content -LiteralPath $sumsPath)) {
    if ($line -match '^([0-9a-f]{64})  \*?(.+)$' -and $Matches[2] -ceq $zipName) {
      $matchesForZip += $Matches[1]
    }
  }
  if ($matchesForZip.Count -ne 1) { throw 'The official ZIP checksum is missing or ambiguous.' }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zipPath).Hash.ToLowerInvariant()
  if ($actual -cne $matchesForZip[0]) { throw 'SHA-256 mismatch. No installation was changed.' }

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
  try {
    $entries = @($zip.Entries)
    if ($entries.Count -lt 20 -or $entries.Count -gt 3000) { throw 'Unexpected number of files in Helm ZIP.' }
    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($item in $entries) {
      $name = $item.FullName
      if (-not $name.StartsWith('helm/', [System.StringComparison]::Ordinal) -or $name.Contains('\')) {
        throw "Unsafe ZIP path: $name"
      }
      $parts = $name.TrimEnd('/').Split('/')
      if ($parts | Where-Object { $_ -eq '..' -or $_ -eq '.' -or $_ -eq 'node_modules' -or $_ -eq '.git' }) {
        throw "Unsafe ZIP entry: $name"
      }
      $kind = [int](($item.ExternalAttributes -shr 16) -band 0xF000)
      if ($kind -ne 0 -and $kind -ne 0x4000 -and $kind -ne 0x8000) {
        throw "ZIP links and unusual file types are not allowed: $name"
      }
      if (-not $seen.Add($name)) { throw "Duplicate ZIP entry: $name" }
    }
  } finally {
    $zip.Dispose()
  }
  $unpacked = Join-Path $temporary 'extracted'
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $unpacked)
  $source = Join-Path $unpacked 'helm'
  $pkg = Get-Content -LiteralPath (Join-Path $source 'package.json') -Raw | ConvertFrom-Json
  if ($pkg.name -cne '@samjuniors/helm' -or $pkg.version -cne $tag.Substring(1)) {
    throw 'Verified release does not identify the expected Helm version.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $source 'setup.mjs'))) {
    throw 'Helm setup.mjs is missing from the downloaded release.'
  }
  Write-Output "Verified SHA-256: $actual"
  $nodeArgs = @((Join-Path $source 'setup.mjs'), 'install', '--host', $Client)
  if ($DryRun) { $nodeArgs += '--dry-run' }
  & node @nodeArgs
  if ($LASTEXITCODE -ne 0) { throw 'Helm setup reported an error; existing installations were preserved.' }
  if ($DryRun) {
    Write-Output 'Preview finished. No installation or host registration was changed.'
  } else {
    Write-Output 'Helm installation finished. Restart your coding assistant, then use helm update or helm uninstall.'
  }
} finally {
  if ($temporary -and (Test-Path -LiteralPath $temporary)) {
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
  }
}
