#!/bin/bash
# Steel Frame Design — 生产模式（单进程）
# 构建前端 + 启动后端，一个进程搞定一切

set -e

echo "================================================"
echo "  XuanwuAI Steel Frame Design"
echo "  生产模式 — 单进程，无需 Vite"
echo "================================================"

echo ""
echo "[1/3] 构建前端..."
cd frontend && npm run build && cd ..
echo "      ✓ 前端构建完成"

echo ""
echo "[2/3] 启动后端引擎..."
echo "[3/3] 打开浏览器..."
echo ""
echo "================================================"
echo "  访问地址: http://localhost:8000"
echo "  Ctrl+C 停止服务"
echo "================================================"
echo ""

python servers/web_api_server.py
