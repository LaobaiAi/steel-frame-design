"""
3D 模型导出器 Server (three_d_exporter)

将钢框架结构模型和分析结果导出为 Three.js 可渲染的 3D 数据格式。
纯 Python 坐标变换与数据重组，不依赖 Web 框架。

输出格式说明：
- nodes: 所有节点坐标列表 [{id, x, y, z}]
- elements: 所有构件列表 [{id, node_i, node_j, type, section}]
- deformed_nodes (可选): 变形后的节点坐标
- color_map: 基于应力比的构件颜色映射
"""

from servers.base import CAIAOServer, tool


class ThreeDExporter(CAIAOServer):
    """3D 模型导出器。

    将钢框架模型数据转为 Three.js 可直接加载的 JSON 格式，
    支持原始模型、变形叠加和基于校核结果的颜色映射。
    """

    server_name = "3d-exporter"
    server_version = "1.0.0"
    server_category = "visualization"
    server_description = "将钢框架模型和校核结果导出为Three.js可渲染的3D JSON数据，支持变形叠加和颜色映射"
    server_dependencies = []

    def __init__(self):
        super().__init__()

    def _compute_color(self, ratio: float) -> str:
        """根据应力比计算颜色：绿(0) → 黄(0.5) → 红(1.0+)。"""
        clamped = min(max(ratio, 0.0), 1.0)
        if clamped < 0.5:
            # 绿 → 黄
            g = 1.0
            r = clamped * 2.0
            b = 0.0
        else:
            # 黄 → 红
            r = 1.0
            g = 2.0 - clamped * 2.0
            b = 0.0
        return f"rgb({int(r*255)},{int(g*255)},{b})"

    def _compute_deformed_nodes(self, nodes: list, displacements: dict,
                                 scale_factor: float) -> list:
        """计算变形后的节点坐标。

        Args:
            nodes: 原始节点列表
            displacements: 位移字典 {node_id: [ux, uy, uz, rx, ry, rz]}
            scale_factor: 变形放大系数
        """
        deformed = []
        disp_map = {}
        for k, v in displacements.items():
            disp_map[int(k)] = v

        for n in nodes:
            nd = n.copy()
            disp = disp_map.get(n["id"], [0, 0, 0, 0, 0, 0])
            nd["x"] = n["x"] + float(disp[0]) * scale_factor
            nd["y"] = n["y"] + float(disp[1]) * scale_factor
            nd["z"] = n["z"] + float(disp[2]) * scale_factor
            deformed.append(nd)

        return deformed

    @tool(
        name="export_3d_model",
        description="将钢框架模型和可选的校核/分析结果导出为Three.js可渲染的3D数据。输出含节点、构件、变形节点和颜色映射。",
        input_schema={
            "type": "object",
            "required": ["model"],
            "properties": {
                "model": {
                    "type": "object",
                    "description": "结构模型JSON（含nodes和elements）"
                },
                "check_results": {
                    "type": "object",
                    "description": "校核结果（可选，含elements校核信息），用于颜色映射"
                },
                "analysis_result": {
                    "type": "object",
                    "description": "分析结果（可选，含displacements），用于变形叠加"
                },
                "deformation_scale": {
                    "type": "number",
                    "description": "变形放大系数，默认100",
                    "default": 100
                }
            }
        }
    )
    def export_3d_model(self, input_data: dict) -> dict:
        model = input_data["model"]
        check_results = input_data.get("check_results")
        analysis_result = input_data.get("analysis_result")
        deformation_scale = input_data.get("deformation_scale", 100)

        nodes = model.get("nodes", [])
        elements = model.get("elements", [])

        # ── 基础数据 ────────────────────────────────────────────
        three_d_data = {
            "metadata": model.get("metadata", {}),
            "nodes": [{"id": n["id"], "x": n["x"], "y": n["y"], "z": n["z"]}
                       for n in nodes],
            "elements": [{"id": el["id"], "node_i": el["node_i"],
                          "node_j": el["node_j"], "type": el.get("type", "beam"),
                          "section": el.get("section_id", "")}
                          for el in elements],
            "sections": model.get("sections", []),
        }

        # ── 颜色映射（基于校核结果）─────────────────────────────
        if check_results and "elements" in check_results:
            color_map = {}
            for el in check_results["elements"]:
                ratio = max(el.get("stress_ratio", 0),
                           el.get("stability_ratio", 0))
                color_map[str(el["id"])] = {
                    "color": self._compute_color(ratio),
                    "stress_ratio": el.get("stress_ratio", 0),
                    "stability_ratio": el.get("stability_ratio", 0),
                    "deflection_ratio": el.get("deflection_ratio", 0),
                    "slenderness_ratio": el.get("slenderness_ratio", 0),
                    "pass": el.get("pass", True),
                }
            three_d_data["color_map"] = color_map

        # ── 变形节点 ────────────────────────────────────────────
        if analysis_result and "displacements" in analysis_result:
            displacements = analysis_result["displacements"]
            three_d_data["deformed_nodes"] = self._compute_deformed_nodes(
                nodes, displacements, deformation_scale
            )
            three_d_data["deformation_scale"] = deformation_scale
            three_d_data["load_case"] = analysis_result.get("load_case", "")
            three_d_data["max_displacement"] = analysis_result.get("summary", {}).get("max_displacement", 0)
        else:
            three_d_data["deformed_nodes"] = None
            three_d_data["deformation_scale"] = 0

        # ── 计算包围盒 ─────────────────────────────────────────
        if nodes:
            xs = [n["x"] for n in nodes]
            ys = [n["y"] for n in nodes]
            zs = [n["z"] for n in nodes]
            three_d_data["bounding_box"] = {
                "min": [min(xs), min(ys), min(zs)],
                "max": [max(xs), max(ys), max(zs)],
                "center": [(min(xs) + max(xs)) / 2,
                           (min(ys) + max(ys)) / 2,
                           (min(zs) + max(zs)) / 2]
            }

        # ── 截面可视化信息 ──────────────────────────────────────
        section_dimensions = {}
        for sec in model.get("sections", []):
            sid = sec.get("id", "")
            # 估算截面尺寸用于3D渲染（从截面名称解析或使用默认值）
            if "x" in sid:
                parts = sid.replace("HW", "").replace("HM", "").split("x")
                if len(parts) >= 4:
                    h = float(parts[0]) / 1000  # mm → m
                    b = float(parts[1]) / 1000
                else:
                    h = b = 0.3
            else:
                h = b = 0.3
            section_dimensions[sid] = {"height": h, "width": b}

        three_d_data["section_dimensions"] = section_dimensions

        return {"three_d_data": three_d_data}


if __name__ == "__main__":
    server = ThreeDExporter()
    server.run_cli()
