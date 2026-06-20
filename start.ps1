#
# WiseScan Quick Start (v2)
# Usage: .\start.ps1
# Auto-launches API + Vite, waits for both to be ready, opens browser.
#

$ErrorActionPreference = "Continue"
$root = "C:\Users\ASUS\WorkBuddy\Claw\wisescan"

Write-Host ""
Write-Host "=== WiseScan Quick Start ===" -ForegroundColor Cyan
Write-Host ""

# ---------- Step 1: Clean old ports ----------
Write-Host "[1/3] Cleaning old processes..." -ForegroundColor Yellow

$ports = @(3003, 5173, 5174)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conn) {
        foreach ($c in $conn) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "  Stopped process on port $p (PID: $($c.OwningProcess))" -ForegroundColor Gray
        }
    }
}
Start-Sleep -Seconds 2

# ---------- Step 2: Launch API Server ----------
Write-Host "[2/3] Launching API Server (port 3003)..." -ForegroundColor Yellow

$apiWindow = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$env:PORT='3003'; cd '$root'; Write-Host 'API Server :: Starting on http://localhost:3003' -ForegroundColor Green; Write-Host ''; node api/api-server.mjs"
) -PassThru

Write-Host "  Waiting for API to be ready..." -ForegroundColor Gray

$apiReady = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3003/api/health" -TimeoutSec 1 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $apiReady = $true
            Write-Host "  API Server ready!" -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 1
}

if (-not $apiReady) {
    Write-Host "  WARNING: API did not respond within 15s. Check the API window for errors." -ForegroundColor Red
    Write-Host "  Vite will still be launched, but you'll need to restart the API." -ForegroundColor Red
}

# ---------- Step 3: Launch Vite Frontend ----------
Write-Host "[3/3] Launching Vite Frontend..." -ForegroundColor Yellow

$viteWindow = Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root'; Write-Host 'Vite :: Starting dev server...' -ForegroundColor Green; Write-Host ''; npm run dev"
) -PassThru

Write-Host "  Waiting for Vite to be ready..." -ForegroundColor Gray

$viteReady = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $viteReady = $true
            Write-Host "  Vite ready!" -ForegroundColor Green
            break
        }
    } catch {
        # Also check port 5174 (fallback)
        try {
            $res = Invoke-WebRequest -Uri "http://localhost:5174" -TimeoutSec 1 -ErrorAction Stop
            if ($res.StatusCode -eq 200) {
                $viteReady = $true
                Write-Host "  Vite ready on 5174!" -ForegroundColor Green
                break
            }
        } catch {}
    }
    Start-Sleep -Seconds 1
}

if (-not $viteReady) {
    Write-Host "  WARNING: Vite did not respond within 20s. Check the Vite window for errors." -ForegroundColor Red
}

# ---------- Done ----------
Write-Host ""
Write-Host "=== All set! ===" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173/assess" -ForegroundColor Cyan
Write-Host "  API:      http://localhost:3003/api/health" -ForegroundColor Cyan
Write-Host ""

# Auto-open browser
Start-Process "http://localhost:5173/assess"

Write-Host "Press Enter to close this window..." -ForegroundColor Gray
