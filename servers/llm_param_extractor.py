"""
LLM 参数提取器 Server (llm_param_extractor)

将自然语言描述转换为钢框架设计参数 YAML。
通过调用兼容 OpenAI 接口的 LLM，提取结构化设计参数。

使用方式：
- 通过 Hub 调用 extract_params_from_text
- 输入：自然语言提示 + LLM 配置
- 输出：结构化的参数字典或 YAML 字符串
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

DEFAULT_MODEL = "gpt-4o-mini"


class LLMParamExtractor(CAIAOServer):
    """LLM 参数提取器。

    将自然语言设计描述转换为结构化钢框架设计参数。
    使用兼容 OpenAI API 的 LLM 后端（可配置）。
    """

    server_name = "llm-param-extractor"
    server_version = "1.0.0"
    server_category = "ai_interface"
    server_description = "将自然语言描述通过LLM转换为钢框架设计YAML参数，支持OpenAI兼容接口"
    server_dependencies = ["requests"]

    def __init__(self):
        super().__init__()

    def _call_llm(self, prompt: str, llm_config: dict) -> dict:
        """调用 LLM 提取参数。

        Args:
            prompt: 用户自然语言描述
            llm_config: LLM 配置 {api_key, model, base_url?}

        Returns:
            解析后的参数字典
        """
        api_key = llm_config.get("api_key", "")
        model = llm_config.get("model", DEFAULT_MODEL)
        base_url = llm_config.get("base_url", "https://api.openai.com/v1")

        if not api_key:
            return {"error": "LLM API key is required in llm_config"}

        try:
            import requests
        except ImportError:
            return {"error": "requests library not installed. Run: pip install requests"}

        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user", "content": f"请提取以下描述中的钢框架设计参数：\n\n{prompt}"},
            ],
            "temperature": 0.1,
            "max_tokens": 1000,
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # 解析 JSON 响应
            params = json.loads(content)
            return params
        except json.JSONDecodeError:
            # 尝试修复——取第一个 { 和最后一个 }
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(content[start:end])
                except json.JSONDecodeError:
                    pass
            return {"error": f"Failed to parse LLM response as JSON: {content[:200]}"}
        except Exception as e:
            return {"error": f"LLM API call failed: {str(e)}"}

    def _validate_and_fill_params(self, params: dict) -> dict:
        """验证并填充默认参数。"""
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
            if val is not None:
                filled[key] = val
            else:
                filled[key] = default

        # 修正 story_heights 与 num_stories 不匹配
        if len(filled["story_heights"]) != filled["num_stories"]:
            h = filled["story_heights"][-1] if filled["story_heights"] else 3.5
            filled["story_heights"] = filled["story_heights"][:filled["num_stories"]]
            while len(filled["story_heights"]) < filled["num_stories"]:
                filled["story_heights"].append(h)

        return filled

    @tool(
        name="extract_params_from_text",
        description="将自然语言描述通过LLM转换为钢框架设计参数。输入用户文本描述和LLM配置，输出结构化参数字典。",
        input_schema={
            "type": "object",
            "required": ["prompt", "llm_config"],
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "用户的自然语言设计描述，如'设计一个三层钢框架办公楼，6米柱距'"
                },
                "llm_config": {
                    "type": "object",
                    "description": "LLM配置",
                    "required": ["api_key"],
                    "properties": {
                        "api_key": {"type": "string", "description": "API密钥"},
                        "model": {"type": "string", "description": "模型名称，默认gpt-4o-mini"},
                        "base_url": {"type": "string", "description": "API地址，默认OpenAI"}
                    }
                }
            }
        }
    )
    def extract_params_from_text(self, input_data: dict) -> dict:
        prompt = input_data["prompt"]
        llm_config = input_data["llm_config"]

        raw_params = self._call_llm(prompt, llm_config)
        if "error" in raw_params:
            return raw_params

        filled_params = self._validate_and_fill_params(raw_params)
        return {
            "params": filled_params,
            "raw_llm_output": raw_params,
        }


if __name__ == "__main__":
    server = LLMParamExtractor()
    server.run_cli()
