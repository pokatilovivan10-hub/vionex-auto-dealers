$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX LEADS: Docker start ===' -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop is not installed or is not available in PATH.' }
if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example. Review it before production deployment.' -ForegroundColor Yellow
}
& docker compose up -d --build --wait
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose start failed.' }
Write-Host 'Containers are running.' -ForegroundColor Green
Start-Process 'http://localhost:8080'
