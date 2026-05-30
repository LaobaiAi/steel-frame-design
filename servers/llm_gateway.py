"""
llm_gateway.py — CAIAO 原子 Server：唯一 LLM API 通信层

设计原则（CAIAO 原子 Server 规范）：
- 单一职责：只做 LLM API 通信，不含任何业务逻辑
- 纯计算约束：本项目唯一含网络调用的 Server
- 零间接依赖：不 import 其他 Server，通过 Hub 被调用
- 无状态：每次 call_tool 独立

所有需要 LLM 能力的其他 Server（参数提取器、Agent编排器等）
必须通过 Hub → llm_gateway 调用，不得直接发起 HTTP 请求。

API Key 优先级：环境变量 LLM_API_KEY > 入参 llm_config.api_key
"""

import json
import os

from servers.base import CAIAOServer, tool

DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_BASE_URL = "https://api.openai.com/v1"


class LLMGateway(CAIAOServer):
    """LLM API 通信层 —— 全项目唯一发 HTTP 请求的原子 Server。

    所有 LLM 调用都通过此 Server 路由到后端 API。
    支持非流式和流式两种模式。
    """

    server_name = "llm-gateway"
    server_version = "1.0.0"
    server_category = "ai_interface"
    server_description = "LLM API 通信层：统一管理与 LLM 后端的 HTTP 通信，支持流式和非流式调用，是项目中唯一包含网络逻辑的原子 Server"
    server_dependencies = ["requests"]

    def __init__(self):
        super().__init__()
        self._default_api_key = os.environ.get("LLM_API_KEY", "")
        self._default_base_url = os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL)
        self._default_model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)

    # ── 内部：解析 LLM 配置 ────────────────────────────────────

    def _resolve_config(self, llm_config: dict | None = None) -> dict:
        """解析 LLM 配置，优先级：环境变量 > 入参 > 默认值。

        CAIAO 原则：API Key 应通过环境变量配置，而非每次从外部传入。
        入参仅作为开发/调试时的覆盖手段。
        """
        cfg = llm_config or {}
        api_key = self._default_api_key or cfg.get("api_key", "")
        # When server-side env API key is set, use server-side base_url/model too.
        # Otherwise, use the user-provided config from the frontend.
        if self._default_api_key:
            return {
                "api_key": api_key,
                "base_url": self._default_base_url,
                "model": self._default_model,
            }
        return {
            "api_key": api_key,
            "base_url": cfg.get("base_url") or DEFAULT_BASE_URL,
            "model": cfg.get("model") or DEFAULT_MODEL,
        }

    # ── 内部：HTTP 调用封装 ─────────────────────────────────────

    def _post(self, config: dict, payload: dict) -> dict:
        """发送 HTTP POST 请求到 LLM API。"""
        api_key = config["api_key"]
        if not api_key:
            return {"error": "LLM API key is required. Set LLM_API_KEY env var or pass api_key in llm_config."}

        try:
            import requests
        except ImportError:
            return {"error": "requests library not installed. Run: pip install requests"}

        url = f"{config['base_url'].rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"LLM API call failed: {str(e)}"}

    # ── Tool: chat_completion（非流式） ─────────────────────────

    @tool(
        name="chat_completion",
        description="调用 LLM API 完成一次非流式对话。输入消息列表和可选的工具定义，返回 LLM 响应。所有需要 LLM 能力的其他 Server 应通过此工具调用 LLM，而非直接发 HTTP 请求。",
        input_schema={
            "type": "object",
            "required": ["messages"],
            "properties": {
                "messages": {
                    "type": "array",
                    "description": "对话消息列表，格式符合 OpenAI Chat API： [{\"role\": \"system\", \"content\": \"...\"}, {\"role\": \"user\", \"content\": \"...\"}]",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {"type": "string", "enum": ["system", "user", "assistant", "tool"]},
                            "content": {"type": "string"},
                        },
                    },
                },
                "tools": {
                    "type": "array",
                    "description": "可选的工具定义列表（OpenAI function calling 格式），供 LLM 选择调用",
                    "items": {"type": "object"},
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM 配置覆盖（可选）。优先级低于环境变量：api_key, model, base_url",
                    "properties": {
                        "api_key": {"type": "string", "description": "API Key（仅在未设 LLM_API_KEY 环境变量时生效）"},
                        "model": {"type": "string", "description": "模型名称"},
                        "base_url": {"type": "string", "description": "API 地址"},
                    },
                },
                "temperature": {
                    "type": "number",
                    "description": "采样温度，默认 0.2",
                    "default": 0.2,
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "最大生成 token 数，默认 2000",
                    "default": 2000,
                },
            },
        },
    )
    def chat_completion(self, input_data: dict) -> dict:
        """非流式 LLM 对话完成。

        接收消息列表和工具定义，返回 LLM 的完整响应。
        供参数提取器、Agent编排器以及其他需要 LLM 能力的 Server 调用。
        """
        messages = input_data.get("messages", [])
        tools = input_data.get("tools", [])
        temperature = input_data.get("temperature", 0.2)
        max_tokens = input_data.get("max_tokens", 2000)
        llm_config = self._resolve_config(input_data.get("llm_config"))

        payload = {
            "model": llm_config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        result = self._post(llm_config, payload)

        if "error" in result:
            return result

        # 标准化输出：只返回前端/调用方需要的字段
        try:
            choice = result["choices"][0]
            message = choice["message"]
            return {
                "role": message.get("role", "assistant"),
                "content": message.get("content", ""),
                "tool_calls": message.get("tool_calls", []),
                "finish_reason": choice.get("finish_reason", ""),
                "usage": result.get("usage", {}),
                "model": result.get("model", payload.get("model", "")),
            }
        except (KeyError, IndexError) as e:
            return {"error": f"Unexpected API response format: {str(e)}"}

    # ── Tool: stream_chat（流式，返回 SSE 格式 chunk） ──────────

    @tool(
        name="stream_chat",
        description="调用 LLM API 完成一次流式对话。与 chat_completion 相同但响应为流式 SSE 格式。返回一个包含 stream 字段的 dict，stream 值为 generator。",
        input_schema={
            "type": "object",
            "required": ["messages"],
            "properties": {
                "messages": {
                    "type": "array",
                    "description": "对话消息列表",
                    "items": {"type": "object"},
                },
                "tools": {
                    "type": "array",
                    "description": "工具定义列表",
                    "items": {"type": "object"},
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM 配置覆盖（可选）",
                    "properties": {
                        "api_key": {"type": "string"},
                        "model": {"type": "string"},
                        "base_url": {"type": "string"},
                    },
                },
                "temperature": {"type": "number", "default": 0.2},
                "max_tokens": {"type": "integer", "default": 2000},
            },
        },
    )
    def stream_chat(self, input_data: dict) -> dict:
        """流式 LLM 对话完成。

        返回 SSE 兼容的文本流。注意：当前为同步实现，
        在后端需要配合 StreamingResponse 使用。
        返回 dict 中的 stream 字段为 generator。
        """
        messages = input_data.get("messages", [])
        tools = input_data.get("tools", [])
        temperature = input_data.get("temperature", 0.2)
        max_tokens = input_data.get("max_tokens", 2000)
        llm_config = self._resolve_config(input_data.get("llm_config"))

        api_key = llm_config["api_key"]
        if not api_key:
            return {"error": "LLM API key is required"}

        try:
            import requests
        except ImportError:
            return {"error": "requests library not installed"}

        url = f"{llm_config['base_url'].rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": llm_config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        def _generate():
            try:
                resp = requests.post(url, headers=headers, json=payload, stream=True, timeout=120)
                resp.raise_for_status()
                for line in resp.iter_lines():
                    if not line:
                        continue
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: "):
                        data_str = decoded[6:]
                        if data_str.strip() == "[DONE]":
                            yield json.dumps({"type": "done"}) + "\n"
                            break
                        yield data_str + "\n"
            except Exception as e:
                yield json.dumps({"type": "error", "content": str(e)}) + "\n"

        return {"stream": _generate()}


if __name__ == "__main__":
    server = LLMGateway()
    server.run_cli()
