"""
llm_param_extractor.py — CAIAO 原子 Server：将自然语言转换为结构化设计参数

CAIAO 设计原则：
- 纯计算：只做 JSON 解析、Schema 校验、默认值填充
- 零网络：LLM 通信通过 Hub → llm_gateway，不直接发 HTTP
- 原子性：单一职责——只做"自然语言 → 参数"的转换

调用链路：
  用户文本 → hub.call_tool("chat_completion", ...) → llm_gateway
                                                    → JSON 解析
                                                    → 参数校验与填充
                                                    → 结构化参数字典
"""

import json
from servers.base import CAIAOServer, tool

# ── 参数提取的 System Prompt ──────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """你是一个结构工程参数提取器。根据用户的自然语言描述，提取钢框架设计参数。

请以严格的 JSON 格式返回，不要添加任何解释。字段说明：

- grid_x: X方向柱距列表（单位：米），如 [6.0, 6.0, 6.0]
- grid_y: Y方向柱距列表（单位：米），如 [6.0, 6.0]
- num_stories: 层数（整数）
- story_heights: 各层层高列表（单位：米），首层通常较高，如 [4.5, 3.5, 3.5]
- column_section: 柱截面型号，可选：
  HW300x300x10x15, HW350x350x12x19, HW400x400x13x21,
  HM244x175x7x11, HM294x200x8x12, HM340x250x9x14, HM390x300x10x16
  默认 "HW350x350x12x19"
- beam_section: 梁截面型号，同上列表，默认 "HM340x250x9x14"
- material: 钢材牌号，可选 Q235 或 Q355，默认 "Q355"
- name: 项目名称
- dead_load: 楼面恒载（kN/m²），默认 2.0
- live_load: 楼面活载（kN/m²），默认 3.0（办公楼）
- wind_pressure: 基本风压（kN/m²），默认 0.45
- seismic_intensity: 地震影响系数最大值，默认 0.08（7度区）
- output_dir: 输出目录，默认 "./output"

如果没有明确指定，使用合理的默认值。

示例输入："设计一个三层的钢结构办公楼，柱距6米，每层3.5米高"
示例输出：{"grid_x":[6.0,6.0],"grid_y":[6.0],"num_stories":3,"story_heights":[3.5,3.5,3.5],"material":"Q355","name":"三层钢结构办公楼","dead_load":2.0,"live_load":3.0}
"""


class LLMParamExtractor(CAIAOServer):
    """LLM 参数提取器 — 纯计算原子 Server。

    将自然语言设计描述转换为结构化钢框架设计参数。
    LLM 通信通过 Hub → llm_gateway，自身不包含网络逻辑。
    """

    server_name = "llm-param-extractor"
    server_version = "2.0.0"
    server_category = "ai_interface"
    server_description = "将自然语言描述转换为结构化钢框架设计参数。纯计算 Server，通过 Hub 调用 llm_gateway 与 LLM 通信。"
    server_dependencies = []  # 不再直接依赖 requests

    def __init__(self, hub=None):
        super().__init__()
        self._hub = hub

    # ── 纯计算：JSON 解析 ───────────────────────────────────────

    def _try_parse_json(self, content: str) -> dict | None:
        """尝试从 LLM 响应中解析 JSON。

        先直接解析，失败后尝试提取 { } 包裹的内容。
        纯计算逻辑，无副作用。
        """
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

        start = content.find("{")
        end = content.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass
        return None

    # ── 纯计算：默认值填充 ──────────────────────────────────────

    def _validate_and_fill_params(self, params: dict) -> dict:
        """验证并填充默认参数。

        纯计算逻辑：
        1. 缺失字段填入合理默认值
        2. story_heights 与 num_stories 不匹配时自动修正
        3. 返回完整参数字典
        """
        defaults = {
            "grid_x": [6.0, 6.0, 6.0],
            "grid_y": [6.0, 6.0],
            "num_stories": 4,
            "story_heights": [4.0, 3.5, 3.5, 3.5],
            "column_section": "HW350x350x12x19",
            "beam_section": "HM340x250x9x14",
            "material": "Q355",
            "name": "Steel Frame",
            "dead_load": 2.0,
            "live_load": 3.0,
            "wind_pressure": 0.45,
            "seismic_intensity": 0.08,
            "output_dir": "./output",
        }

        filled = {}
        for key, default in defaults.items():
            val = params.get(key, default)
            filled[key] = default if val is None else val

        # 修正 story_heights 与 num_stories 不匹配
        if len(filled["story_heights"]) != filled["num_stories"]:
            h = filled["story_heights"][-1] if filled["story_heights"] else 3.5
            filled["story_heights"] = filled["story_heights"][:filled["num_stories"]]
            while len(filled["story_heights"]) < filled["num_stories"]:
                filled["story_heights"].append(h)

        return filled

    # ── 公共方法 ────────────────────────────────────────────────

    def extract_params(self, prompt: str, llm_config: dict | None = None) -> dict:
        """核心方法：自然语言 → 结构化参数。

        调用链路：
          1. hub.call_tool("chat_completion", messages) → llm_gateway → LLM API
          2. 解析返回的 JSON（纯计算）
          3. 填充默认值（纯计算）
          4. 返回完整参数

        Args:
            prompt: 用户自然语言设计描述
            llm_config: LLM 配置（可选，主要用于开发调试）

        Returns:
            成功：{"params": {...}, "raw_llm_output": {...}}
            失败：{"error": "..."}
        """
        if self._hub is None:
            return {"error": "LLMParamExtractor requires a Hub. Initialize with hub=Hub()."}

        # 通过 Hub 调 llm_gateway（唯一网络层）
        llm_result = self._hub.call_tool("chat_completion", {
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"请提取以下描述中的钢框架设计参数：\n\n{prompt}"},
            ],
            "temperature": 0.1,
            "max_tokens": 1000,
            "llm_config": llm_config,
        })

        if "error" in llm_result:
            return {"error": f"LLM call failed: {llm_result['error']}"}

        content = llm_result.get("content", "")
        if not content:
            finish = llm_result.get("finish_reason", "unknown")
            usage = llm_result.get("usage", {})
            # 包含更多诊断信息帮助调试
            detail = f"finish_reason={finish}, tokens={usage.get('total_tokens', 'N/A')}, model_used={llm_result.get('model', 'unknown')}"
            return {"error": f"LLM returned empty content ({detail}). This may indicate an API auth or quota issue."}

        # 纯计算：JSON 解析
        raw_params = self._try_parse_json(content)
        if raw_params is None:
            return {"error": f"Failed to parse LLM response as JSON: {content[:300]}"}

        # 纯计算：默认值填充
        filled_params = self._validate_and_fill_params(raw_params)

        return {
            "params": filled_params,
            "raw_llm_output": raw_params,
        }

    # ── Tool 注册 ────────────────────────────────────────────────

    @tool(
        name="extract_params_from_text",
        description="【CAIAO 原子工具】将自然语言描述通过 LLM 转换为钢框架设计参数。LLM 通信经由 llm-gateway，自身纯计算。输入用户文本描述和可选的 LLM 配置，输出结构化参数字典。",
        input_schema={
            "type": "object",
            "required": ["prompt"],
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "用户的自然语言设计描述，如'设计一个三层钢框架办公楼，6米柱距'"
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM 配置覆盖（可选）。API Key 优先级：环境变量 LLM_API_KEY > 此配置",
                    "properties": {
                        "api_key": {"type": "string", "description": "API密钥（仅在未设环境变量时生效）"},
                        "model": {"type": "string", "description": "模型名称"},
                        "base_url": {"type": "string", "description": "API地址"}
                    }
                }
            }
        }
    )
    def extract_params_from_text(self, input_data: dict) -> dict:
        """@tool 包装器：从输入 dict 中提取参数并调用核心方法。"""
        prompt = input_data.get("prompt", "")
        llm_config = input_data.get("llm_config")
        return self.extract_params(prompt, llm_config)


if __name__ == "__main__":
    server = LLMParamExtractor()
    server.run_cli()
