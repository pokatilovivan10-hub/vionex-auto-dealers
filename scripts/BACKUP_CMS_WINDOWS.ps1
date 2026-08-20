$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX CMS: create backup ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.13+ is not installed. Recommended: Node.js 24 LTS.'
}

& npm run cms:backup
if ($LASTEXITCODE -ne 0) {
    throw 'CMS backup failed. Read the error above.'
}

Write-Host 'Backup created in data/backups.' -ForegroundColor Green
