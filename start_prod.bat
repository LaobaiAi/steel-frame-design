@echo off
chcp 65001 >nul
title XuanwuAI Steel Frame Design — 生产模式

echo ================================================
echo   XuanwuAI Steel Frame Design
echo   生产模式 — 单进程，无需 Vite
echo ================================================
echo.

:: 构建前端
echo [1/3] 构建前端...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo 前端构建失败！
    pause
    exit /b
)
cd ..
echo        [32m前端构建完成 ✓[0m
echo.

:: 启动后端（同时 serve 前端）
echo [2/3] 启动后端引擎...
echo [3/3] 打开浏览器...
echo.
echo ================================================
echo   访问地址: http://localhost:8000
echo   按 Ctrl+C 停止服务
echo ================================================
echo.

python servers/web_api_server.py

pause
