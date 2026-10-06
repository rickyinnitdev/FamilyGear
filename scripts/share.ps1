param([switch]$SourceOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$releaseRoot = Join-Path $projectRoot 'release'
$sourceRoot = Join-Path $releaseRoot 'Family-Gear-source'
New-Item -ItemType Directory -Force $sourceRoot | Out-Null
foreach ($name in @('src','public','desktop','scripts','tests','package.json','package-lock.json','tsconfig.json','index.html','LICENSE','THIRD_PARTY_NOTICES.md','README.md','WINDOWS.md','FREE-UPDATES.md','AI_HANDOFF.md','AGENTS.md')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $name) -Destination $sourceRoot -Recurse -Force
}
$upstreamRoot = Join-Path $sourceRoot 'upstream/openmouse'
New-Item -ItemType Directory -Force $upstreamRoot | Out-Null
$protocolRoot = Join-Path $projectRoot 'work/mouse-protocol'
if (-not (Test-Path -LiteralPath $protocolRoot)) { $protocolRoot = Join-Path $projectRoot 'upstream/openmouse' }
if (Test-Path -LiteralPath $protocolRoot) {
  foreach ($item in Get-ChildItem -LiteralPath $protocolRoot -Force | Where-Object { $_.Name -notin @('.git','node_modules','dist') }) {
    Copy-Item -LiteralPath $item.FullName -Destination $upstreamRoot -Recurse -Force
  }
}
Compress-Archive -LiteralPath $sourceRoot -DestinationPath (Join-Path $releaseRoot 'Family-Gear-source.zip') -Force
$appVersion = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$windowsRoot = Join-Path $releaseRoot ('windows-' + $appVersion + '/win-unpacked')
Copy-Item -LiteralPath (Join-Path $releaseRoot 'Family-Gear-source.zip') -Destination $windowsRoot -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'WINDOWS.md') -Destination (Join-Path $windowsRoot 'START-HERE.txt') -Force
if ($SourceOnly) { exit 0 }
Compress-Archive -Path (Join-Path $windowsRoot '*') -DestinationPath (Join-Path $releaseRoot 'Family-Gear-Windows.zip') -Force
