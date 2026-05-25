"""
LLM Agent 循环 Server (llm_agent_loop)

实现 ReAct 循环：通过 LLM 自主编排多个 CAIAO Server 的工具，
完成钢框架设计全流程。该 Server 本身不依赖任何具体工程 Server，
仅依赖 Hub 接口获取可用工具列表并执行调用。

工作流程：
1. 从 Hub 获取所有可用工具定义
2. 将工具列表和用户 prompt 发送给 LLM
3. LLM 返回 tool_calls → 通过 Hub 执行 → 反馈结果
4. 循环直到 LLM 返回最终文本或达到最大迭代次数
"""

import json
from servers.base import CAIAOServer, tool

# ── Agent System Prompt ────────────────────────────────────────────

AGENT_SYSTEM_PROMPT = """你是一个钢框架设计 AI Agent。你可以使用以下工具来完成钢框架设计任务：

{tools_description}

请按照以下步骤处理用户的请求：
1. 分析用户需求，提取设计参数
2. 使用 generate_frame 生成模型
3. 使用 apply_loads 施加荷载
4. 使用 run_analysis 进行有限元分析
5. 使用 check_code 进行规范校核
6. 使用 generate_report 生成报告
7. 可选：使用 export_3d_model 导出3D数据

重要规则：
- 逐步执行，每步只调用一个工具
- 将上一步的输出作为下一步的输入
- 分析多个荷载工况（Dead, Live, Wind, Seismic）
- 最终总结设计结果：模型规模、最大应力比、是否通过校核
- 如果工具返回错误，分析原因并尝试修复"""

AGENT_SIMPLE_PROMPT = """你是一个钢框架设计AI助手。使用可用工具完成用户的设计请求。

工具列表：
{tools_description}

规则：
- 每次只调用一个工具
- 将上一步的结果传递给下一步
- 最终输出设计摘要（模型信息、校核结果）
- 遇到错误尝试修复后再继续"""

DEFAULT_MODEL = "gpt-4o-mini"
MAX_ITERATIONS = 10


class LLMAgentLoop(CAIAOServer):
    """LLM Agent 自主编排循环。

    通过 LLM 的 tool_calls 能力，自动发现和调用 Hub 中注册的工具，
    实现钢框架设计的全流程自主完成。
    """

    server_name = "llm-agent-loop"
    server_version = "1.0.0"
    server_category = "ai_interface"
    server_description = "基于ReAct循环的LLM Agent：自动编排CAIAO工具完成钢框架全流程设计，支持自主规划和错误恢复"
    server_dependencies = ["requests"]

    def __init__(self, hub=None):
        super().__init__()
        self._hub = hub

    def _build_tools_for_llm(self) -> list[dict]:
        """将 Hub 中的工具定义转换为 LLM function calling 格式。"""
        if self._hub is None:
            return []

        tools = []
        for entry in self._hub.list_all_tools():
            tool_def = {
                "type": "function",
                "function": {
                    "name": entry["name"],
                    "description": entry["description"],
                    "parameters": entry.get("inputSchema", {"type": "object"}),
                }
            }
            tools.append(tool_def)
        return tools

    def _build_tools_description(self) -> str:
        """构建人类可读的工具描述文本。"""
        if self._hub is None:
            return "No tools available (Hub not connected)"

        lines = []
        for entry in self._hub.list_all_tools():
            lines.append(f"- {entry['name']}: {entry['description']}")
        return "\n".join(lines)

    def _call_llm(self, messages: list[dict], tools: list[dict],
                  llm_config: dict) -> dict:
        """调用 LLM API。

        Args:
            messages: 对话历史
            tools: 工具定义列表
            llm_config: LLM 配置

        Returns:
            API 响应
        """
        api_key = llm_config.get("api_key", "")
        model = llm_config.get("model", DEFAULT_MODEL)
        base_url = llm_config.get("base_url", "https://api.openai.com/v1")

        if not api_key:
            return {"error": "LLM API key is required"}

        try:
            import requests
        except ImportError:
            return {"error": "requests library not installed"}

        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2000,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"LLM API error: {str(e)}"}

    @tool(
        name="execute_with_llm",
        description="启动LLM Agent自主编排模式。Agent自动发现工具、规划步骤、调用工具完成钢框架全流程设计。",
        input_schema={
            "type": "object",
            "required": ["prompt", "llm_config"],
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "用户设计请求，如'设计一个三层钢框架办公楼，6米柱距，Q355钢'"
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM配置",
                    "required": ["api_key"],
                    "properties": {
                        "api_key": {"type": "string", "description": "API密钥"},
                        "model": {"type": "string", "description": "模型名称"},
                        "base_url": {"type": "string", "description": "API地址"}
                    }
                },
                "max_iterations": {
                    "type": "integer",
                    "description": "最大迭代次数，默认10",
                    "default": 10
                }
            }
        }
    )
    def execute_with_llm(self, input_data: dict) -> dict:
        prompt = input_data["prompt"]
        llm_config = input_data["llm_config"]
        max_iter = input_data.get("max_iterations", MAX_ITERATIONS)

        if self._hub is None:
            return {"error": "Agent requires a CAIAO Hub. Initialize with hub=Hub()"}

        tools = self._build_tools_for_llm()
        tools_desc = self._build_tools_description()

        if not tools:
            return {"error": "No tools registered in Hub. Run hub = Hub() first."}

        # 初始消息
        system_content = AGENT_SYSTEM_PROMPT.format(tools_description=tools_desc)
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ]

        steps = []
        final_response = ""

        for iteration in range(max_iter):
            response = self._call_llm(messages, tools, llm_config)
            if "error" in response:
                return {"error": response["error"], "steps": steps}

            choice = response["choices"][0]
            message = choice["message"]

            # 检查是否有 tool_calls
            tool_calls = message.get("tool_calls", [])
            if not tool_calls:
                # LLM 返回最终文本
                final_response = message.get("content", "")
                steps.append({
                    "iteration": iteration + 1,
                    "type": "final_response",
                    "content": final_response,
                })
                break

            # 将 assistant 消息加入对话
            messages.append(message)

            # 执行每个 tool_call
            for tc in tool_calls:
                func_name = tc["function"]["name"]
                try:
                    func_args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    func_args = {}

                # 通过 Hub 执行工具
                tool_result = self._hub.call_tool(func_name, func_args)

                step_info = {
                    "iteration": iteration + 1,
                    "type": "tool_call",
                    "tool": func_name,
                    "input": func_args,
                    "result_summary": self._summarize_result(func_name, tool_result),
                }

                if "error" in tool_result:
                    step_info["error"] = tool_result["error"]

                steps.append(step_info)

                # 将工具结果加入对话
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })
        else:
            # 达到最大迭代次数
            final_response = "Agent reached maximum iterations without final response."

        return {
            "final_response": final_response,
            "steps": steps,
            "total_iterations": len(steps),
        }

    def _summarize_result(self, tool_name: str, result: dict) -> dict:
        """提取工具结果的关键摘要信息。"""
        if "error" in result:
            return {"error": result["error"]}

        summary = {}
        if tool_name == "generate_frame":
            summary = {"nodes": len(result.get("nodes", [])),
                        "elements": len(result.get("elements", []))}
        elif tool_name == "apply_loads":
            summary = {"load_cases": [lc["name"] for lc in result.get("load_cases", [])]}
        elif tool_name == "run_analysis":
            summary = {"max_disp": result.get("summary", {}).get("max_displacement", 0)}
        elif tool_name == "check_code":
            s = result.get("summary", {})
            summary = {"passed": s.get("passed"), "failed": s.get("failed"),
                        "max_stress_ratio": s.get("max_stress_ratio")}
        elif tool_name == "generate_report":
            summary = {"report_path": result.get("report_path")}
        elif tool_name == "export_3d_model":
            data = result.get("three_d_data", {})
            summary = {"nodes": len(data.get("nodes", [])),
                        "elements": len(data.get("elements", [])),
                        "has_deformation": data.get("deformed_nodes") is not None}
        else:
            summary = {"status": "completed"}

        return summary


if __name__ == "__main__":
    server = LLMAgentLoop()
    server.run_cli()
