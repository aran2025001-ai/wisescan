@echo off
chcp 65001 > nul
title 明鉴 WiseScan - 开发服务器
echo ================================================
echo  明鉴 WiseScan - 一键启动开发服务器
echo ================================================
echo.

cd /d "%~dp0"

echo [+] 启动 API 服务器 (端口 3002)...
start "WiseScan API" cmd /k "node api\api-server.mjs"
timeout /t 3 /nobreak > nul

echo [+] 启动前端开发服务器...
echo.
echo 前端地址: http://localhost:5173
echo.
echo 如果提示"node不是内部命令"，请手动运行:
echo   cd %~dp0
echo   npx vite --port 5173 --host
echo.
npx vite --port 5173 --host

pause
