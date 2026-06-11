#!/bin/bash
# Codespaces 初始化脚本：安装依赖 + 构建前端
set -e
echo "==> 安装 Python 依赖..."
pip install -r requirements.txt
echo "==> 安装前端依赖..."
cd frontend && npm install && cd ..
echo "==> 初始化完成！服务即将自动启动..."
