#!/bin/bash
# Codespaces 启动脚本：自动拉起后端 + 前端
# 用户无需任何操作，浏览器将自动打开前端页面

echo "==> 启动后端服务 (FastAPI)..."
nohup python servers/web_api_server.py > /tmp/backend.log 2>&1 &
echo $! > /tmp/backend.pid

echo "==> 启动前端服务 (Vite)..."
cd frontend && nohup npm run dev > /tmp/frontend.log 2>&1 &
echo $! > /tmp/frontend.pid

echo "==> 服务已启动！"
echo "    后端: http://localhost:8000"
echo "    前端: http://localhost:3000（将自动打开）"
