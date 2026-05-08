$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host ''
Write-Host 'Starting ConnectSphere Frontend...' -ForegroundColor Cyan
Write-Host 'Project:' $PSScriptRoot

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js was not found in PATH. Please install Node.js or open this from a Node-enabled terminal.' }
if (-not $npm) { throw 'npm was not found in PATH. Please install Node.js or open this from a Node-enabled terminal.' }

$portBusy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($portBusy) {
  Write-Host 'Port 3000 is already running. Opening http://localhost:3000 ...' -ForegroundColor Yellow
  try { try { try { Start-Process 'http://localhost:3000' } catch { Write-Host 'Open http://localhost:3000 in your browser.' -ForegroundColor Yellow } } catch { Write-Host 'Open http://localhost:3000 in your browser.' -ForegroundColor Yellow } } catch { Write-Host 'Open http://localhost:3000 in your browser.' -ForegroundColor Yellow }
  return
}

if (-not (Test-Path '.\node_modules')) {
  Write-Host 'Installing npm dependencies...' -ForegroundColor Yellow
  npm install
}

if (-not (Test-Path '.\build\index.html')) {
  Write-Host 'Build folder missing. Creating production build...' -ForegroundColor Yellow
  npm run build
}

Write-Host 'Frontend server is starting on http://localhost:3000' -ForegroundColor Green
try { Start-Process 'http://localhost:3000' } catch { Write-Host 'Open http://localhost:3000 in your browser.' -ForegroundColor Yellow }
Write-Host 'Do not close this window while using the site.' -ForegroundColor Yellow
node .\serve-frontend.js

