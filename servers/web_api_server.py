"""
Web API Server (CAIAO 合并 Server)

基于 FastAPI 的 Web API，提供 REST/SSE 端点给前端调用。
CAIAO 合并 Server — 通过 Hub 调度原子 Server。

端点：
  GET  /api/health          — 健康检查
  POST /api/run_pipeline    — 工程模式全流程
  POST /api/llm_param       — LLM 参数提取
  POST /api/llm_agent       — LLM Agent 全自动（非流式）
  POST /api/llm/stream      — LLM 流式对话（SSE）

设计原则（CAIAO 合并 Server）：
- 不含领域计算逻辑
- 仅做协议转换（HTTP ↔ Hub JSON）和路由
- 领域逻辑全部委托给原子 Server
"""

import os
import sys
import json

# PyInstaller 打包兼容
if getattr(sys, 'frozen', False):
    _ROOT = sys._MEIPASS
else:
    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
except ImportError:
    print("需要安装 FastAPI: pip install fastapi uvicorn")
    sys.exit(1)

from caiao_hub import Hub
from servers.base import CAIAOServer, tool


class WebAPIServer(CAIAOServer):
    """Web API Server — CAIAO 合并 Server。

    通过 Hub 调度其他原子 Server，对外暴露 RESTful API。
    自身不含任何计算逻辑，仅做协议转换和编排。
    """

    server_name = "web-api-server"
    server_version = "2.0.0"
    server_category = "orchestration"
    server_description = "Web API Server：通过 Hub 调度原子 Server，提供 REST/SSE API"

    def __init__(self, hub: Hub | None = None):
        super().__init__()
        self._hub = hub

    def _call(self, tool_name: str, input_data: dict) -> dict:
        if self._hub is None:
            return {"error": "Hub not connected"}
        return self._hub.call_tool(tool_name, input_data)

    @tool(
        name="run_pipeline",
        description="运行钢框架全流程设计：建模→荷载→分析→校核→报告+3D导出",
        input_schema={
            "type": "object",
            "required": ["grid_x", "grid_y", "num_stories", "story_heights"],
            "properties": {
                "grid_x": {"type": "array", "items": {"type": "number"}},
                "grid_y": {"type": "array", "items": {"type": "number"}},
                "num_stories": {"type": "integer"},
                "story_heights": {"type": "array", "items": {"type": "number"}},
                "column_section": {"type": "string"},
                "beam_section": {"type": "string"},
                "material": {"type": "string"},
                "name": {"type": "string"},
                "dead_load": {"type": "number"},
                "live_load": {"type": "number"},
                "wind_pressure": {"type": "number"},
                "seismic_intensity": {"type": "number"},
            },
        },
    )
    def run_pipeline(self, input_data: dict) -> dict:
        """运行全流程并返回前端所需数据。"""
        pipeline_result = self._call("run_full_pipeline", input_data)
        if "error" in pipeline_result:
            return {"status": "error", "message": pipeline_result["error"]}

        model = pipeline_result.get("model", {})
        analysis_results = pipeline_result.get("analysis_results", [])
        check_results = pipeline_result.get("check_results", {})
        report_path = pipeline_result.get("report_path", "")

        # 导出 3D 数据
        three_d_data = None
        if model:
            export_input = {"model": model, "check_results": check_results}
            if analysis_results:
                export_input["analysis_result"] = analysis_results[0]
                export_input["deformation_scale"] = 100
            three_d_result = self._call("export_3d_model", export_input)
            if "error" not in three_d_result:
                three_d_data = three_d_result.get("three_d_data")

        report_url = ""
        if report_path and os.path.exists(report_path):
            rel_path = os.path.relpath(report_path, _ROOT)
            report_url = f"/{rel_path.replace(os.sep, '/')}"

        return {
            "status": "success",
            "model": model,
            "analysis_result": analysis_results[0] if analysis_results else None,
            "code_check": check_results,
            "three_d_data": three_d_data,
            "report_url": report_url,
        }

    @tool(
        name="llm_param_extract",
        description="通过 LLM 从自然语言提取钢框架设计参数（经由 llm-gateway）",
        input_schema={
            "type": "object",
            "required": ["prompt"],
            "properties": {
                "prompt": {"type": "string"},
                "llm_config": {
                    "type": "object",
                    "properties": {
                        "api_key": {"type": "string"},
                        "model": {"type": "string"},
                        "base_url": {"type": "string"},
                    },
                },
            },
        },
    )
    def llm_param_extract(self, input_data: dict) -> dict:
        result = self._call("extract_params_from_text", input_data)
        if "error" in result:
            return {"status": "error", "message": result["error"]}
        return {
            "status": "success",
            "params": result.get("params", {}),
            "raw_llm_output": result.get("raw_llm_output", ""),
        }

    @tool(
        name="llm_agent_run",
        description="启动 LLM Agent 自主编排钢框架全流程设计（经由 llm-gateway）",
        input_schema={
            "type": "object",
            "required": ["prompt"],
            "properties": {
                "prompt": {"type": "string"},
                "llm_config": {"type": "object"},
                "max_iterations": {"type": "integer"},
            },
        },
    )
    def llm_agent_run(self, input_data: dict) -> dict:
        result = self._call("execute_with_llm", input_data)
        if "error" in result:
            return {"status": "error", "message": result["error"]}

        steps_data = result.get("steps", [])
        formatted_steps = []
        three_d_data = None
        report_url = ""

        for s in steps_data:
            formatted_steps.append({
                "tool": s.get("tool", s.get("type", "unknown")),
                "input": json.dumps(s.get("input", {}), ensure_ascii=False),
                "output": json.dumps(s.get("result_summary", {}), ensure_ascii=False),
            })
            if s.get("three_d_data"):
                three_d_data = s["three_d_data"]
            if s.get("report_path"):
                report_url = s["report_path"]

        return {
            "status": "success",
            "steps": formatted_steps,
            "final_response": result.get("final_response", ""),
            "three_d_data": three_d_data,
            "report_url": report_url,
        }


# ── FastAPI 应用 ────────────────────────────────────────────────

app = FastAPI(
    title="CAIAO Steel Frame Design API",
    description="钢结构全流程设计 Web API — CAIAO 原子化架构",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

hub: Hub | None = None
web_api: WebAPIServer | None = None


@app.on_event("startup")
async def startup():
    global hub, web_api
    print("[WebAPI] 正在初始化 CAIAO Hub...")
    hub = Hub()

    # 注册需要 hub 引用的 Server（覆盖自动发现的 hub=None 实例）
    from servers.steel_frame_pipeline import SteelFramePipeline
    from servers.llm_agent_orchestrator import LLMAgentOrchestrator
    from servers.llm_param_extractor import LLMParamExtractor

    pipeline = SteelFramePipeline(hub=hub)
    agent_orch = LLMAgentOrchestrator(hub=hub)
    param_extractor = LLMParamExtractor(hub=hub)
    hub.register(pipeline)
    hub.register(agent_orch)
    hub.register(param_extractor)  # 覆盖自动发现的实例，使提取器可通过 Hub 调 llm_gateway

    # 注册 Web API Server
    web_api = WebAPIServer(hub=hub)
    hub.register(web_api)

    print(f"[WebAPI] Hub 就绪: {hub.get_server_count()} Servers, {hub.get_tool_count()} Tools")
    print(f"[WebAPI] 可用工具: {list(hub._tool_registry.keys())}")

    # ── 注册子进程计算型 Server ─────────────────────────────────
    # 计算型 Server 以独立子进程运行，实现进程隔离：
    #   求解器崩溃 → 只杀子进程，不影响 Gateway 主进程
    hub.register_subprocess({
        "name": "fea_runner",
        "command": os.path.join(_ROOT, ".venv_opensees", "Scripts", "python.exe"),
        "args": ["-u", "-m", "servers.opensees_runner"],
        "cwd": _ROOT,
        "lazy": True,           # 首次 call_tool 时才启动子进程
        "tools": ["run_analysis"],
    })

    print(f"[WebAPI] 注册子进程 Server 'fea_runner' (lazy, tools: run_analysis)")
    print(f"[WebAPI] 总计: {hub.get_server_count()} Servers, {hub.get_tool_count()} Tools")


@app.on_event("shutdown")
async def shutdown():
    global hub
    if hub:
        print("[WebAPI] 正在停止子进程 Server...")
        hub.stop_all()
        print("[WebAPI] 所有子进程已停止")


# ── REST API 路由 ────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok", "servers": hub.get_server_count() if hub else 0}


@app.post("/api/run_pipeline")
async def api_run_pipeline(data: dict):
    if web_api is None:
        raise HTTPException(503, "Server not initialized")
    result = web_api.call_tool("run_pipeline", data)
    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


@app.post("/api/llm_param")
async def api_llm_param(data: dict):
    if web_api is None:
        raise HTTPException(503, "Server not initialized")
    result = web_api.call_tool("llm_param_extract", data)
    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


@app.post("/api/llm_agent")
async def api_llm_agent(data: dict):
    if web_api is None:
        raise HTTPException(503, "Server not initialized")
    result = web_api.call_tool("llm_agent_run", data)
    if "error" in result:
        raise HTTPException(500, result["error"])
    return result


# ── SSE 流式端点 ────────────────────────────────────────────────


@app.post("/api/llm/stream")
async def llm_stream(data: dict):
    """SSE 流式 LLM 对话。

    通过 Server-Sent Events 推送 LLM 响应的每个 token。
    前端使用 EventSource 或 fetch + ReadableStream 接收。

    请求体:
    {
        "messages": [...],
        "tools": [...],
        "llm_config": {...}
    }

    响应 (SSE):
        data: {"type": "token", "content": "..."}
        data: {"type": "tool_call", "name": "...", "arguments": "..."}
        data: {"type": "done"}
        data: {"type": "error", "content": "..."}
    """
    if hub is None:
        raise HTTPException(503, "Hub not initialized")

    async def event_stream():
        # 通过 Hub 调 llm_gateway 的 stream_chat
        result = hub.call_tool("stream_chat", data)
        if "error" in result:
            yield f"data: {json.dumps({'type': 'error', 'content': result['error']})}\n\n"
            return

        stream = result.get("stream")
        if stream is None:
            yield f"data: {json.dumps({'type': 'error', 'content': 'No stream returned'})}\n\n"
            return

        for chunk_json in stream:
            yield f"data: {chunk_json.strip()}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/tools")
async def list_tools():
    if hub is None:
        return {"tools": []}
    return {"tools": hub.list_all_tools(), "servers": hub.list_server_names()}


# ── 静态文件服务 ────────────────────────────────────────────────

_FRONTEND_DIST = os.path.join(_ROOT, "frontend", "dist")
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("output/"):
            return JSONResponse({"error": "Not found"}, status_code=404)
        file_path = os.path.join(_FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(_FRONTEND_DIST, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        return JSONResponse({"error": "Frontend not built yet. Run: cd frontend && npm run build"}, status_code=404)
else:
    print(f"[WebAPI] 警告: 前端构建目录不存在 ({_FRONTEND_DIST})")
    print("[WebAPI] 请先构建前端: cd frontend && npm run build")


def _cleanup_port(port: int):
    """启动前清理占用指定端口的旧进程（Windows）。"""
    import subprocess, time
    try:
        out = subprocess.check_output(
            f'netstat -ano | findstr LISTENING | findstr ":{port}"',
            shell=True, text=True, stderr=subprocess.DEVNULL,
        )
        for line in out.strip().splitlines():
            parts = line.strip().split()
            pid = parts[-1] if parts else ""
            if pid.isdigit():
                subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                print(f"[WebAPI] 已清理端口 {port} 上的旧进程 (PID {pid})")
                time.sleep(0.5)
    except subprocess.CalledProcessError:
        pass  # 没有进程占用该端口
    except Exception as e:
        print(f"[WebAPI] 清理端口 {port} 时出错: {e}")


if __name__ == "__main__":
    import uvicorn
    _cleanup_port(8000)
    print("[WebAPI] 启动 FastAPI 服务 http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
