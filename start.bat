@echo off
chcp 65001 >nul
cd /d C:\Users\ASUS\WorkBuddy\Claw\wisescan
echo 正在启动 明鉴 WiseScan 服务器...
echo.
echo [1] 启动 API...
start "WiseScan-API" cmd /k "node api/api-server.mjs"
timeout /t 2 >nul
echo [2] 启动前端...
start "WiseScan-Vite" cmd /k "npx vite --port 5173 --host"
echo.
echo 完成。
echo  API: http://localhost:3002
echo  前端: http://localhost:5173
echo  关闭此窗口不影响服务器运行。
pause
