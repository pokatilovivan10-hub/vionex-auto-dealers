$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX CMS: change administrator password ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.13+ is not installed. Recommended: Node.js 24 LTS.'
}

& npm run admin:password
if ($LASTEXITCODE -ne 0) {
    throw 'Password change failed. Read the error above.'
}

Write-Host ''
Write-Host 'Password updated. Existing sessions were closed.' -ForegroundColor Green
