# Steel Frame Design — CLAUDE.md

## 快速启动

项目启动方式详见 [docs/quickstart.md](docs/quickstart.md)。

### 简要启动命令

```bash
# 确保端口 3000 可用（杀掉占用的进程）
PID=$(netstat -ano 2>/dev/null | findstr ":3000 " | findstr LISTEN | awk '{print $NF}')
[ -n "$PID" ] && taskkill /F /PID $PID 2>/dev/null || true
sleep 1

# 后端
python servers/web_api_server.py

# 前端（另一个终端）
cd frontend && npm run dev
```

### CLI 模式

```bash
python cli/main.py run --quick
```

## 项目结构

- `servers/` — CAIAO 原子 Server
- `frontend/` — React + Vite + TypeScript 前端
- `cli/` — CLI 入口
- `caiao_hub.py` — 核心 Hub，统一调度所有 Server
