Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 明鉴 WiseScan - 一键启动开发服务器" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$nodeExe = "C:\Users\ASUS\.workbuddy\binaries\node\versions\22.22.2\node.exe"
$apiDir = "C:\Users\ASUS\WorkBuddy\Claw\wisescan\api"

# 检查端口 3002
$apiBusy = netstat -ano | Select-String ":3002"
if ($apiBusy) {
    Write-Host "[✓] API 服务器已经在端口 3002 运行" -ForegroundColor Green
} else {
    Write-Host "[+] 启动 API 服务器 (端口 3002)..." -ForegroundColor Yellow
    $env:PORT = "3002"
    Start-Process -WindowStyle Hidden -FilePath $nodeExe -ArgumentList "$apiDir\api-server.mjs"
    Start-Sleep -Seconds 3
}

# 检查端口 5173
$viteBusy = netstat -ano | Select-String ":5173"
if ($viteBusy) {
    Write-Host "[✓] 前端服务器已经在端口 5173 运行" -ForegroundColor Green
} else {
    Write-Host "[+] 启动前端开发服务器..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "前端地址: http://localhost:5173" -ForegroundColor Green
    Write-Host ""
    & $nodeExe .\node_modules\vite\bin\vite.js --port 5173 --host
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null
