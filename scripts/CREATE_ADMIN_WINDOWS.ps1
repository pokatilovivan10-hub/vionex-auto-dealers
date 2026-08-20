$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX CMS: create administrator ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.13+ is not installed. Recommended: Node.js 24 LTS.'
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example.' -ForegroundColor Yellow
}

& npm run admin:create
if ($LASTEXITCODE -ne 0) {
    throw 'Administrator creation failed. Read the error above.'
}

Write-Host ''
Write-Host 'Administrator created. Start the site and open /admin.' -ForegroundColor Green
