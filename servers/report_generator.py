"""
报告生成器 Server (report_generator)

从 StructureClaw 萃取：基于 Jinja2 渲染 HTML 报告。
输入：校核结果 + 模型信息
输出：HTML 报告文件路径
"""

import os
import json
from datetime import datetime
from servers.base import CAIAOServer, tool

try:
    from jinja2 import Template
    JINJA2_AVAILABLE = True
except ImportError:
    JINJA2_AVAILABLE = False


class ReportGenerator(CAIAOServer):
    """报告生成器。基于 Jinja2 模板生成 HTML 校核报告。"""

    def __init__(self):
        super().__init__()
        self._template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
        self._output_dir = os.path.join(os.path.dirname(__file__), "..", "output")

    @tool(
        name="generate_report",
        description="生成钢框架校核报告（HTML格式）。输入校核结果、模型元信息和输出路径，返回报告文件路径。",
        input_schema={
            "type": "object",
            "required": ["check_results", "model_meta"],
            "properties": {
                "check_results": {
                    "type": "object",
                    "description": "校核结果（由 steel_code_check 生成）"
                },
                "model_meta": {
                    "type": "object",
                    "description": "模型元信息，如 {name, description}",
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string"}
                    }
                },
                "load_case_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "分析工况名称列表"
                },
                "output_path": {
                    "type": "string",
                    "description": "输出文件路径，默认 ./output/report.html"
                }
            }
        }
    )
    def generate_report(self, input_data: dict) -> dict:
        check_results = input_data["check_results"]
        model_meta = input_data.get("model_meta", {})
        load_cases = input_data.get("load_case_names", [])
        output_path = input_data.get("output_path",
                                      os.path.join(self._output_dir, "report.html"))

        template_path = os.path.join(self._template_dir, "report.html")

        if not JINJA2_AVAILABLE:
            # 无 Jinja2 时直接用字符串替换生成简单 HTML
            html = self._generate_fallback_html(check_results, model_meta, load_cases)
        else:
            try:
                with open(template_path, "r", encoding="utf-8") as f:
                    template_str = f.read()
                template = Template(template_str)
                summary = check_results.get("summary", {})
                elements = check_results.get("elements", [])

                html = template.render(
                    title=f"钢框架结构校核报告 — {model_meta.get('name', '未命名')}",
                    generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    model_description=model_meta.get("description", ""),
                    load_cases=load_cases if load_cases else ["未指定"],
                    total_elements=summary.get("total_elements", 0),
                    passed_count=summary.get("passed", 0),
                    failed_count=summary.get("failed", 0),
                    max_stress_ratio=summary.get("max_stress_ratio", 0),
                    max_deflection_ratio=summary.get("max_deflection_ratio", 0),
                    elements=elements
                )
            except Exception as e:
                return {"error": f"Template render failed: {e}"}

        # 确保输出目录存在
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

        return {
            "report_path": os.path.abspath(output_path),
            "file_size": len(html),
            "status": "generated"
        }

    def _generate_fallback_html(self, check_results: dict, model_meta: dict,
                                 load_cases: list) -> str:
        """无 Jinja2 时的降级 HTML 生成。"""
        summary = check_results.get("summary", {})
        elements = check_results.get("elements", [])

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>钢框架校核报告</title>
<style>body{{font-family:sans-serif;padding:20px}}table{{border-collapse:collapse;width:100%}}
th,td{{border:1px solid #ccc;padding:8px;text-align:left}}th{{background:#2b6cb0;color:#fff}}
.pass{{color:green}}.fail{{color:red}}h2{{color:#2c5282}}</style></head>
<body>
<h1>钢框架结构校核报告</h1>
<p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
<p>模型: {model_meta.get('name', '未命名')}</p>
<h2>校核总览</h2>
<p>总构件: {summary.get('total_elements', 0)}, 通过: {summary.get('passed', 0)}, 未通过: {summary.get('failed', 0)}</p>
<p>最大应力比: {summary.get('max_stress_ratio', 0):.4f}, 最大挠度比: {summary.get('max_deflection_ratio', 0):.4f}</p>
<h2>构件明细</h2>
<table><tr><th>ID</th><th>应力比</th><th>稳定比</th><th>挠度比</th><th>结果</th></tr>"""

        for el in elements:
            cls = "pass" if el.get("pass") else "fail"
            status = "✓" if el.get("pass") else "✗"
            html += f"<tr><td>{el['id']}</td><td>{el.get('stress_ratio',0):.4f}</td><td>{el.get('stability_ratio',0):.4f}</td><td>{el.get('deflection_ratio',0):.4f}</td><td class='{cls}'>{status}</td></tr>"

        html += "</table></body></html>"
        return html


if __name__ == "__main__":
    server = ReportGenerator()
    server.run_cli()
