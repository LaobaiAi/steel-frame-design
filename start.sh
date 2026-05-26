#!/bin/bash
# Steel Frame Design — 一键启动脚本
# 同时启动后端 (FastAPI) + 前端 (Vite)

echo "================================================"
echo "  XuanwuAI Steel Frame Design — 启动中..."
echo "================================================"

# 启动后端 (后台运行)
echo "[1/2] 启动后端服务 (FastAPI)..."
python servers/web_api_server.py &
BACKEND_PID=$!

# 等待后端就绪
echo "      等待后端就绪..."
for i in $(seq 1 15); do
  sleep 1
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "      后端已就绪 ✓ (PID: $BACKEND_PID)"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "      后端启动耗时较长，前端启动后将自动重连"
  fi
done

# 启动前端
echo "[2/2] 启动前端服务 (Vite)..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================================"
echo "  后端: http://localhost:8000"
echo "  前端: http://localhost:3000"
echo "  按 Ctrl+C 停止所有服务"
echo "================================================"

# 捕获退出信号，清理子进程
trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 等待任一子进程结束
wait
