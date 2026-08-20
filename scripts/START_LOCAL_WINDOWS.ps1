$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=== VIONEX LEADS: local preview ===' -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22.13+ is not installed. Install Node.js 24 LTS from nodejs.org and run this file again.'
}

$VersionText = (& node -p "process.versions.node").Trim()
$VersionParts = $VersionText.Split('.')
$Major = [int]$VersionParts[0]
$Minor = [int]$VersionParts[1]
if (($Major -lt 22) -or (($Major -eq 22) -and ($Minor -lt 13))) {
    throw "Node.js 22.13+ is required. Recommended: Node.js 24 LTS. Installed version: $(& node -v)"
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example.' -ForegroundColor Yellow
}

$Port = 8080
$Url = "http://localhost:$Port"
$Process = $null
try {
    $Process = Start-Process -FilePath 'node' -ArgumentList 'src/server.mjs' -WorkingDirectory $Root -NoNewWindow -PassThru
    $Ready = $false
    for ($Attempt = 1; $Attempt -le 30; $Attempt++) {
        Start-Sleep -Milliseconds 500
        if ($Process.HasExited) {
            throw "The site process stopped with exit code $($Process.ExitCode)."
        }
        try {
            $Health = Invoke-RestMethod -Uri "$Url/health" -TimeoutSec 2
            if ($Health.ok) { $Ready = $true; break }
        } catch {
            # Wait until the server is ready.
        }
    }
    if (-not $Ready) { throw 'The site did not start within 15 seconds.' }

    Write-Host "Site is available at $Url" -ForegroundColor Green
    Write-Host 'Close this window or press Ctrl+C to stop the local server.' -ForegroundColor DarkGray
    Start-Process $Url
    Wait-Process -Id $Process.Id
}
finally {
    if ($Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
}
