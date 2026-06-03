"""
全流程编排 Server (steel_frame_pipeline)

"合并 Server" 模式：不包含任何计算逻辑，只负责通过 Hub 按顺序调用原子 Server。
体现 CAIAO 哲学：合并而非修改。

从用户级参数出发，依次通过 Hub 调用：
  generate_frame → apply_loads → run_analysis(×N) → check_code → generate_report

Hub 调度模式（v2.0）：通过 caiao_hub.Hub 统一调度，Server 间零直接依赖。
"""

import json
import os

from servers.base import CAIAOServer, tool


class SteelFramePipeline(CAIAOServer):
    """钢框架全流程编排器。

    通过 CAIAO Hub 调度原子 Server，本身不含任何计算逻辑。
    若未注入 Hub，自动回退到直接实例化（向后兼容）。
    """

    server_name = "steel-frame-pipeline"
    server_version = "2.0.0"
    server_category = "orchestration"
    server_description = "钢框架全流程编排器：通过Hub依次调度建模→荷载→分析→校核→报告，一步跑通"
    server_dependencies = []

    def __init__(self, hub=None):
        """初始化管线编排器。

        Args:
            hub: CAIAO Hub 实例（可选）。若提供，通过 Hub 调度；
                 否则自动实例化原子 Server 直接调用（向后兼容）。
        """
        super().__init__()
        self._hub = hub

        # 若未提供 Hub，回退到直接实例化（向后兼容）
        if self._hub is None:
            from servers.opensees_runner import OpenSeesRunner
            from servers.report_generator import ReportGenerator
            from servers.steel_code_check import SteelCodeCheck
            from servers.steel_frame_generator import SteelFrameGenerator
            from servers.steel_load_generator import SteelLoadGenerator

            self._generator = SteelFrameGenerator()
            self._loader = SteelLoadGenerator()
            self._runner = OpenSeesRunner()
            self._checker = SteelCodeCheck()
            self._reporter = ReportGenerator()

    def _call(self, tool_name: str, input_data: dict) -> dict:
        """统一的工具调用入口：优先 Hub 调度，回退直接调用。"""
        if self._hub is not None:
            return self._hub.call_tool(tool_name, input_data)
        # 回退：直接调用对应的原子 Server（tool_name 即方法名，attr 名由前缀约定）
        attr_map = {
            "generate_frame": "_generator",
            "apply_loads": "_loader",
            "run_analysis": "_runner",
            "check_code": "_checker",
            "generate_report": "_reporter",
        }
        server = getattr(self, attr_map.get(tool_name, ""), None)
        if server:
            return server.call_tool(tool_name, input_data)
        return {"error": f"Tool '{tool_name}' not available"}

    @tool(
        name="run_full_pipeline",
        description="运行钢框架全流程：参数化建模→荷载施加→有限元分析→规范校核→报告生成。一步跑通。",
        input_schema={
            "type": "object",
            "required": ["grid_x", "grid_y", "num_stories", "story_heights"],
            "properties": {
                "grid_x": {"type": "array", "items": {"type": "number"}},
                "grid_y": {"type": "array", "items": {"type": "number"}},
                "num_stories": {"type": "integer"},
                "story_heights": {"type": "array", "items": {"type": "number"}},
                "column_section": {"type": "string", "default": "HW350x350x12x19"},
                "beam_section": {"type": "string", "default": "HM340x250x9x14"},
                "material": {"type": "string", "default": "Q235"},
                "name": {"type": "string", "default": "Steel Frame"},
                "dead_load": {"type": "number", "default": 1.5},
                "live_load": {"type": "number", "default": 2.0},
                "wind_pressure": {"type": "number", "default": 0.45},
                "seismic_intensity": {"type": "number", "default": 0.08},
                "output_dir": {"type": "string", "default": "./output"}
            }
        }
    )
    def run_full_pipeline(self, input_data: dict) -> dict:
        steps = []
        output_dir = input_data.get("output_dir", "./output")
        os.makedirs(output_dir, exist_ok=True)

        # ── Step 1: 生成模型 ─────────────────────────────────
        model = self._call("generate_frame", {
            "grid_x": input_data["grid_x"],
            "grid_y": input_data["grid_y"],
            "num_stories": input_data["num_stories"],
            "story_heights": input_data["story_heights"],
            "column_section": input_data.get("column_section", "HW350x350x12x19"),
            "beam_section": input_data.get("beam_section", "HM340x250x9x14"),
            "material": input_data.get("material", "Q235"),
            "name": input_data.get("name", "Steel Frame")
        })
        if "error" in model:
            return {"error": f"Step 1 (generate_frame): {model['error']}"}
        steps.append({"step": "generate_frame", "nodes": len(model["nodes"]),
                       "elements": len(model["elements"])})

        # ── Step 2: 施加荷载 ─────────────────────────────────
        loaded = self._call("apply_loads", {
            "model": model,
            "dead_load": input_data.get("dead_load", 1.5),
            "live_load": input_data.get("live_load", 2.0),
            "wind_pressure": input_data.get("wind_pressure", 0.45),
            "seismic_intensity": input_data.get("seismic_intensity", 0.08),
        })
        if "error" in loaded:
            return {"error": f"Step 2 (apply_loads): {loaded['error']}"}
        steps.append({"step": "apply_loads",
                       "load_cases": [lc["name"] for lc in loaded["load_cases"]]})

        # ── Step 3: 有限元分析 ───────────────────────────────
        analysis_results = []
        load_case_names = [lc["name"] for lc in loaded["load_cases"]]
        for lc_name in load_case_names:
            ar = self._call("run_analysis", {
                "loaded_model": loaded,
                "load_case_name": lc_name
            })
            if "error" in ar:
                return {"error": f"Step 3 (run_analysis/{lc_name}): {ar['error']}"}
            analysis_results.append(ar)
            steps.append({"step": f"run_analysis/{lc_name}",
                           "max_disp": ar["summary"]["max_displacement"]})

        # ── Step 4: 规范校核 ─────────────────────────────────
        check = self._call("check_code", {
            "model": model,
            "analysis_results": analysis_results,
        })
        if "error" in check:
            return {"error": f"Step 4 (check_code): {check['error']}"}
        steps.append({"step": "check_code",
                       "passed": check["summary"]["passed"],
                       "failed": check["summary"]["failed"]})

        # ── Step 5: 生成报告 ─────────────────────────────────
        report = self._call("generate_report", {
            "check_results": check,
            "model_meta": {
                "name": input_data.get("name", "Steel Frame"),
                "description": model.get("metadata", {}).get("description", "")
            },
            "load_case_names": load_case_names,
            "output_path": os.path.join(output_dir, "report.html")
        })
        if "error" in report:
            return {"error": f"Step 5 (generate_report): {report['error']}"}
        steps.append({"step": "generate_report", "path": report["report_path"]})

        # ── 保存中间结果 ─────────────────────────────────────
        model_file = os.path.join(output_dir, "model.json")
        with open(model_file, "w", encoding="utf-8") as f:
            json.dump(model, f, ensure_ascii=False, indent=2)

        load_file = os.path.join(output_dir, "loaded_model.json")
        with open(load_file, "w", encoding="utf-8") as f:
            json.dump(loaded, f, ensure_ascii=False, indent=2)

        check_file = os.path.join(output_dir, "check_results.json")
        with open(check_file, "w", encoding="utf-8") as f:
            json.dump(check, f, ensure_ascii=False, indent=2)

        return {
            "status": "completed",
            "model": model,
            "loaded_model": loaded,
            "analysis_results": analysis_results,
            "check_results": check,
            "report_path": report["report_path"],
            "output_files": {
                "model": os.path.abspath(model_file),
                "loaded_model": os.path.abspath(load_file),
                "check_results": os.path.abspath(check_file),
                "report": os.path.abspath(report["report_path"])
            },
            "steps": steps
        }


if __name__ == "__main__":
    server = SteelFramePipeline()
    server.run_cli()
