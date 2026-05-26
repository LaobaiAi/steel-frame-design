@echo off
chcp 65001 >nul
title XuanwuAI Steel Frame Design

echo ================================================
echo   XuanwuAI Steel Frame Design — 启动中...
echo ================================================
echo.

:: 启动后端
echo [1/2] 启动后端服务 (FastAPI)...
start /B python servers/web_api_server.py > backend.log 2>&1
echo       后端启动中，等待就绪...

:: 等待后端就绪
timeout /t 3 /nobreak >nul

:: 启动前端
echo [2/2] 启动前端服务 (Vite)...
cd frontend
start /B npm run dev > ..\frontend.log 2>&1
cd ..

echo.
echo ================================================
echo   后端: http://localhost:8000
echo   前端: http://localhost:3000
echo   关闭本窗口停止所有服务
echo ================================================
echo.
echo 前端日志: frontend.log
echo 后端日志: backend.log
echo.

:: 保持窗口打开
pause
