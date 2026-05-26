"""
llm_agent_orchestrator.py — CAIAO 合并 Server：LLM Agent 自主编排循环

设计原则（CAIAO 合并 Server 规范）：
- 纯编排：不含领域计算逻辑，仅做步骤编排和数据传递
- 零网络：LLM 通信通过 Hub → llm_gateway，不直接发 HTTP
- 零硬编码：工具列表通过 Hub 动态发现，不在 System Prompt 中硬编码
- 智能摘要：工具结果摘要后回传 LLM，节省 Token

调用链路：
  用户描述 → hub.call_tool("chat_completion", messages, tools) → llm_gateway
                                                               → LLM 响应含 tool_calls
                                                               → hub.call_tool(工具名, 参数)
                                                               → 智能摘要 → 下一轮
"""

import json
from servers.base import CAIAOServer, tool

AGENT_SYSTEM_PROMPT = """你是一个钢框架设计 AI Agent。你可以使用以下工具完成钢框架设计任务：

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
- 最终总结设计结果：模型规模、最大应力比、是否通过校核
- 如果工具返回错误，分析原因并尝试修复"""

DEFAULT_MAX_ITERATIONS = 10


class LLMAgentOrchestrator(CAIAOServer):
    """LLM Agent 编排器 — CAIAO 合并 Server。

    通过 LLM 的工具调用能力，自动发现和编排 Hub 中注册的工具，
    实现钢框架设计的全流程自主完成。

    作为合并 Server：
    - 不包含任何领域计算逻辑
    - 通过 Hub 调用 llm_gateway 获取 LLM 响应
    - 通过 Hub 调用其他原子 Server 执行工具
    - 仅做数据传递和顺序编排
    """

    server_name = "llm-agent-orchestrator"
    server_version = "2.0.0"
    server_category = "orchestration"
    server_description = "【CAIAO 合并 Server】基于 ReAct 循环的 LLM Agent 编排器：通过 Hub 动态发现工具，编排 llm_gateway 与原子 Server 完成钢框架全流程设计"
    server_dependencies = []  # 不直接依赖 requests

    def __init__(self, hub=None):
        self._hub = hub
        super().__init__()

    def _hub_call(self, tool_name: str, input_data: dict) -> dict:
        """通过 Hub 调用工具，Hub 不可用时返回错误。"""
        if self._hub is None:
            return {"error": f"Hub not connected. Cannot call '{tool_name}'"}
        return self._hub.call_tool(tool_name, input_data)

    def _discover_tools_from_hub(self) -> tuple[list[dict], str]:
        """从 Hub 动态发现工具供 LLM 使用。

        返回：
            (tools_for_llm, tools_text_description)
            - tools_for_llm: OpenAI function calling 格式的工具定义
            - tools_text_description: 人类可读的工具列表文本

        CAIAO 原则：不硬编码工具名，所有工具从 Hub 动态获取。
        注意：过滤掉编排器自身的工具（避免递归调用）。
        """
        if self._hub is None:
            return [], "No tools available (Hub not connected)"

        our_tools = {t["name"] for t in self.list_tools()}
        llm_tools = []
        text_lines = []

        for entry in self._hub.list_all_tools():
            name = entry["name"]
            if name in our_tools:
                continue
            llm_tools.append({
                "type": "function",
                "function": {
                    "name": name,
                    "description": entry.get("description", ""),
                    "parameters": entry.get("inputSchema", {"type": "object"}),
                },
            })
            text_lines.append(f"- {name}: {entry.get('description', '')}")

        return llm_tools, "\n".join(text_lines)

    def _summarize_result(self, tool_name: str, result: dict) -> str:
        """智能摘要工具结果。

        将完整的工具输出 JSON 摘要为一行文本，节省 Token。
        相比返回完整 JSON，摘要可减少 80-90% 的 Token 消耗。

        CAIAO 原则：合并 Server 只传递必要信息。
        """
        if "error" in result:
            return f"[ERROR] {result['error'][:100]}"

        if tool_name == "generate_frame":
            nodes = len(result.get("nodes", []))
            elems = len(result.get("elements", []))
            return f"模型生成完成: {nodes} 节点, {elems} 单元"
        elif tool_name == "apply_loads":
            cases = [lc["name"] for lc in result.get("load_cases", [])]
            return f"荷载施加完成: {', '.join(cases)}"
        elif tool_name == "run_analysis":
            summary = result.get("summary", {})
            md = summary.get("max_displacement", 0)
            return f"分析完成: 最大位移 {md:.6f}m"
        elif tool_name == "check_code":
            s = result.get("summary", {})
            return f"校核完成: {s.get('passed', 0)}/{s.get('total_elements', 0)} 通过, 最大应力比 {s.get('max_stress_ratio', 0):.4f}"
        elif tool_name == "generate_report":
            return f"报告已生成: {result.get('report_path', '')}"
        elif tool_name == "export_3d_model":
            data = result.get("three_d_data", {})
            return f"3D 数据已导出: {len(data.get('nodes', []))} 节点, {len(data.get('elements', []))} 单元"
        elif tool_name == "extract_params_from_text":
            params = result.get("params", {})
            return f"参数提取完成: {params.get('name', '')}, {params.get('num_stories', '?')}层"
        else:
            # 通用摘要：提取关键数值字段
            keys = list(result.keys())
            numeric = [k for k in keys[:5] if isinstance(result.get(k), (int, float, str))]
            parts = [f"{k}={result[k]}" for k in numeric] if numeric else ["完成"]
            return f"{tool_name}: {', '.join(parts)}"

    def _extract_step_data(self, tool_name: str, func_args: dict, result: dict) -> dict:
        """提取步骤数据供前端展示（含完整的结构化数据）。"""
        step_data = {
            "tool": tool_name,
            "input": func_args,
            "result_summary": self._summarize_result(tool_name, result),
        }
        # 携带结构化数据（3D、报告路径等）供前端直接使用
        if "error" not in result:
            if tool_name == "export_3d_model":
                step_data["three_d_data"] = result.get("three_d_data")
            elif tool_name == "generate_report":
                step_data["report_path"] = result.get("report_path")
            elif tool_name == "check_code":
                step_data["code_check"] = result
            elif tool_name == "run_analysis":
                step_data["analysis_result"] = result
        else:
            step_data["error"] = result["error"]
        return step_data

    # ── 核心编排方法 ─────────────────────────────────────────────

    def execute(self, prompt: str, llm_config: dict | None = None,
                max_iterations: int = DEFAULT_MAX_ITERATIONS) -> dict:
        """执行 Agent 编排循环。

        CAIAO 合并 Server 核心方法：
          1. 从 Hub 获取工具列表（动态发现）
          2. 通过 Hub → llm_gateway 获取 LLM 响应
          3. 执行工具调用 → 摘要结果 → 下一轮
          4. 返回最终响应与执行步骤

        Args:
            prompt: 用户设计请求
            llm_config: LLM 配置覆盖（可选）
            max_iterations: 最大迭代次数

        Returns:
            {"final_response": str, "steps": [...], "total_iterations": int}
        """
        if self._hub is None:
            return {"error": "Agent requires CAIAO Hub. Initialize with hub=Hub()."}

        tools, tools_desc = self._discover_tools_from_hub()
        if not tools:
            return {"error": "No tools registered in Hub for agent to use."}

        # 构建 System Prompt（工具描述动态填充）
        system_content = AGENT_SYSTEM_PROMPT.format(tools_description=tools_desc)
        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ]

        steps = []
        final_response = ""
        llm_call_count = 0

        for iteration in range(max_iterations):
            # Step A: 通过 Hub → llm_gateway 获取 LLM 思考
            llm_result = self._hub_call("chat_completion", {
                "messages": messages,
                "tools": tools,
                "llm_config": llm_config,
            })

            if "error" in llm_result:
                return {"error": f"LLM call failed: {llm_result['error']}", "steps": steps}

            llm_call_count += 1
            content = llm_result.get("content", "")
            tool_calls = llm_result.get("tool_calls", [])

            if not tool_calls:
                # LLM 返回最终文本，循环结束
                final_response = content or ""
                steps.append({
                    "iteration": iteration + 1,
                    "type": "final_response",
                    "content": final_response,
                })
                break

            # Step B: 将 assistant 消息加入对话
            assistant_msg = {"role": "assistant", "content": content or None}
            if tool_calls:
                assistant_msg["tool_calls"] = tool_calls
            messages.append(assistant_msg)

            # Step C: 执行每个工具调用
            for tc in tool_calls:
                func_name = tc.get("function", {}).get("name", "")
                try:
                    func_args = json.loads(tc.get("function", {}).get("arguments", "{}"))
                except json.JSONDecodeError:
                    func_args = {}

                # 通过 Hub 执行工具
                tool_result = self._hub_call(func_name, func_args)

                # 提取步骤摘要与数据
                step_info = self._extract_step_data(func_name, func_args, tool_result)
                step_info["iteration"] = iteration + 1
                steps.append(step_info)

                # Step D: 智能摘要后回传 LLM（而非完整 JSON）
                summary_text = self._summarize_result(func_name, tool_result)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": summary_text,
                })
        else:
            final_response = f"Agent 在 {max_iterations} 次迭代后未生成最终回复"

        return {
            "final_response": final_response,
            "steps": steps,
            "total_iterations": llm_call_count,
        }

    # ── Tool 注册 ────────────────────────────────────────────────

    @tool(
        name="execute_with_llm",
        description="【CAIAO 合并工具】启动 LLM Agent 自主编排模式。Agent 通过 Hub 动态发现工具，自动规划步骤并调用各原子 Server 完成钢框架全流程设计。适用于[全自动设计]场景。",
        input_schema={
            "type": "object",
            "required": ["prompt"],
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "用户设计请求，如'设计一个三层钢框架办公楼，6米柱距，Q355钢，生成报告'"
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM 配置覆盖（可选）。API Key 优先级：环境变量 LLM_API_KEY > 此配置",
                    "properties": {
                        "api_key": {"type": "string", "description": "API密钥"},
                        "model": {"type": "string", "description": "模型名称"},
                        "base_url": {"type": "string", "description": "API地址"}
                    }
                },
                "max_iterations": {
                    "type": "integer",
                    "description": "最大迭代次数，默认 10",
                    "default": 10
                }
            }
        }
    )
    def execute_with_llm(self, input_data: dict) -> dict:
        """@tool 包装器。"""
        prompt = input_data.get("prompt", "")
        llm_config = input_data.get("llm_config")
        max_iter = input_data.get("max_iterations", DEFAULT_MAX_ITERATIONS)
        return self.execute(prompt, llm_config, max_iter)


if __name__ == "__main__":
    server = LLMAgentOrchestrator()
    server.run_cli()
