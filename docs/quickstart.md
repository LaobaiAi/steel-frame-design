# 快速启动

## 启动前准备（可选）

启动前确保端口 3000 未被占用：

```bash
PID=$(netstat -ano 2>/dev/null | findstr ":3000 " | findstr LISTEN | awk '{print $NF}')
[ -n "$PID" ] && taskkill /F /PID $PID 2>/dev/null || true
```

> 查找占用端口 3000 的进程并强制终止，保证 Vite 始终使用 3000 端口。

## 启动方式

### 1. 后端 (FastAPI)

```bash
python servers/web_api_server.py
```

默认端口: **8000**

### 2. 前端 (Vite + React)

```bash
cd frontend && npm run dev
```

默认端口: **3000**（被占用时自动递增）

### 3. CLI 模式（无需前端）

```bash
# 快速演示
python cli/main.py run --quick

# 指定输入文件
python cli/main.py run --input examples/sample.yaml --output-dir ./output

# LLM 参数提取模式
python cli/main.py run --mode llm-param --prompt "设计一个三层钢框架..."

# LLM Agent 模式
python cli/main.py run --mode llm-agent --prompt "设计一个三层钢框架..." --api-key sk-xxx
```

## 启动后访问

- 前端界面: http://localhost:3000（或自动递增的端口）
- 后端 API: http://localhost:8000
- 健康检查: http://localhost:8000/api/health

## 注意事项

- 前端 Vite 配置了 `/api` 和 `/output` 代理到后端 `localhost:8000`
- 后端需要先启动，前端启动时会自动代理请求
- 构建前端用于生产: `cd frontend && npm run build`
- 后端会提供构建后的前端静态文件（需先 `npm run build`）
