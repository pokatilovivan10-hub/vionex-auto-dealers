$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX LEADS: self-check ===' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.13+ is not installed.' }
$VersionText = (& node -p "process.versions.node").Trim()
$VersionParts = $VersionText.Split('.')
$Major = [int]$VersionParts[0]
$Minor = [int]$VersionParts[1]
if (($Major -lt 22) -or (($Major -eq 22) -and ($Minor -lt 13))) { throw "Node.js 22.13+ is required. Recommended: Node.js 24 LTS. Installed version: $(& node -v)" }
& npm run check
if ($LASTEXITCODE -ne 0) { throw 'Self-check failed.' }
Write-Host ''
Write-Host 'All checks passed.' -ForegroundColor Green
