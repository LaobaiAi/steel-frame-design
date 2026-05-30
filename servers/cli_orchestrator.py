"""
CLI 编排器 Server (cli_orchestrator)

合并 Server — 对 CLI 暴露统一接口，支持三种模式：
- engineering: 读取YAML → 全流程管线
- llm-param: 自然语言 → LLM提取参数 → 全流程管线
- llm-agent: 自然语言 → LLM Agent自主编排

自身不包含计算逻辑，仅通过 Hub 调度。
"""

import os

import yaml

from servers.base import CAIAOServer, tool


class CliOrchestrator(CAIAOServer):
    """CLI 编排器。

    为 CLI 入口提供统一的 run_cli_command 接口，
    支持工程模式、LLM参数提取模式和LLM Agent模式。
    """

    server_name = "cli-orchestrator"
    server_version = "2.0.0"
    server_category = "orchestration"
    server_description = "CLI统一编排器：支持工程模式(YAML)、LLM参数提取、LLM Agent三种运行模式"
    server_dependencies = ["pyyaml"]

    def __init__(self, hub=None):
        super().__init__()
        self._hub = hub

    def _call(self, tool_name: str, input_data: dict) -> dict:
        """通过 Hub 调用工具，Hub 不可用时返回错误。"""
        if self._hub is None:
            return {"error": f"Hub not connected. Cannot call '{tool_name}'"}
        return self._hub.call_tool(tool_name, input_data)

    @tool(
        name="run_cli_command",
        description="CLI统一入口：根据模式运行钢框架设计全流程。支持工程模式、LLM参数提取、LLM Agent三种模式。",
        input_schema={
            "type": "object",
            "required": ["mode"],
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["engineering", "llm-param", "llm-agent"],
                    "description": "运行模式"
                },
                "input_file": {
                    "type": "string",
                    "description": "输入 YAML 参数文件路径（engineering 模式）"
                },
                "output_dir": {
                    "type": "string",
                    "description": "输出目录，默认 ./output",
                    "default": "./output"
                },
                "prompt": {
                    "type": "string",
                    "description": "自然语言设计描述（llm-param / llm-agent 模式）"
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM 配置（llm-param / llm-agent 模式）",
                    "properties": {
                        "api_key": {"type": "string"},
                        "model": {"type": "string"},
                        "base_url": {"type": "string"}
                    }
                },
                "quick": {
                    "type": "boolean",
                    "description": "使用快速演示参数",
                    "default": False
                }
            }
        }
    )
    def run_cli_command(self, input_data: dict) -> dict:
        mode = input_data["mode"]
        output_dir = input_data.get("output_dir", "./output")

        # ── 工程模式 ──────────────────────────────────────────
        if mode == "engineering":
            input_file = input_data.get("input_file")
            quick = input_data.get("quick", False)

            if input_file:
                try:
                    with open(input_file, "r", encoding="utf-8") as f:
                        params = yaml.safe_load(f)
                except FileNotFoundError:
                    return {"error": f"Input file not found: {input_file}"}
                except Exception as e:
                    return {"error": f"YAML parsing failed: {e}"}
            elif quick:
                params = {
                    "grid_x": [6.0, 6.0, 6.0],
                    "grid_y": [6.0, 6.0],
                    "num_stories": 4,
                    "story_heights": [4.0, 3.5, 3.5, 3.5],
                    "column_section": "HW350x350x12x19",
                    "beam_section": "HM340x250x9x14",
                    "material": "Q355",
                    "name": "示例办公楼",
                    "dead_load": 2.0,
                    "live_load": 3.0,
                    "wind_pressure": 0.45,
                    "seismic_intensity": 0.08,
                }
            else:
                params = {
                    "grid_x": [6.0, 6.0],
                    "grid_y": [6.0],
                    "num_stories": 3,
                    "story_heights": [4.0, 3.5, 3.5],
                    "column_section": "HW350x350x12x19",
                    "beam_section": "HM340x250x9x14",
                    "material": "Q235",
                    "name": "示例框架",
                    "dead_load": 1.5,
                    "live_load": 2.0,
                    "wind_pressure": 0.45,
                    "seismic_intensity": 0.08,
                }

            params["output_dir"] = output_dir
            pipeline_result = self._call("run_full_pipeline", params)
            if "error" in pipeline_result:
                return {"error": pipeline_result["error"]}

            # 导出 3D 数据
            model_data = pipeline_result.get("model", {})
            check_data = pipeline_result.get("check_results", {})
            analysis_list = pipeline_result.get("analysis_results", [])

            if model_data:
                export_input = {
                    "model": model_data,
                    "check_results": check_data,
                }
                if analysis_list:
                    export_input["analysis_result"] = analysis_list[0]
                    export_input["deformation_scale"] = 100

                three_d_result = self._call("export_3d_model", export_input)
                if "error" not in three_d_result:
                    three_d_data = three_d_result.get("three_d_data", {})
                    # 保存 3D 数据
                    import json
                    three_d_path = os.path.join(output_dir, "model_3d.json")
                    os.makedirs(output_dir, exist_ok=True)
                    with open(three_d_path, "w", encoding="utf-8") as f:
                        json.dump(three_d_data, f, ensure_ascii=False, indent=2)
                    pipeline_result["three_d_path"] = os.path.abspath(three_d_path)

            return {
                "mode": "engineering",
                "result": pipeline_result,
            }

        # ── LLM 参数提取模式 ─────────────────────────────────
        elif mode == "llm-param":
            prompt = input_data.get("prompt", "")
            llm_config = input_data.get("llm_config", {})

            if not prompt:
                return {"error": "prompt is required for llm-param mode"}
            if not llm_config:
                return {"error": "llm_config is required for llm-param mode"}

            extract_result = self._call("extract_params_from_text", {
                "prompt": prompt,
                "llm_config": llm_config,
            })
            if "error" in extract_result:
                return {"error": f"Parameter extraction failed: {extract_result['error']}"}

            params = extract_result.get("params", {})
            params["output_dir"] = output_dir

            pipeline_result = self._call("run_full_pipeline", params)
            if "error" in pipeline_result:
                return {"error": pipeline_result["error"]}

            return {
                "mode": "llm-param",
                "extracted_params": params,
                "raw_llm_output": extract_result.get("raw_llm_output", {}),
                "result": pipeline_result,
            }

        # ── LLM Agent 模式 ────────────────────────────────────
        elif mode == "llm-agent":
            prompt = input_data.get("prompt", "")
            llm_config = input_data.get("llm_config", {})

            if not prompt:
                return {"error": "prompt is required for llm-agent mode"}
            if not llm_config:
                return {"error": "llm_config is required for llm-agent mode"}

            agent_result = self._call("execute_with_llm", {
                "prompt": prompt,
                "llm_config": llm_config,
            })
            return {
                "mode": "llm-agent",
                "result": agent_result,
            }

        else:
            return {"error": f"Unknown mode: {mode}"}


if __name__ == "__main__":
    server = CliOrchestrator()
    server.run_cli()
