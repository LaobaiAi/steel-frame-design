"""
钢框架生成器 Server (steel_frame_generator)

从 StructureClaw 萃取：参数化生成钢框架结构模型。
输入：网格尺寸、层数、层高、截面选择
输出：符合 model.schema.json 的结构模型
"""

from servers.base import CAIAOServer, tool

# ── 内置截面库（常用 H 型钢，单位：m）───────────────────────────

BUILTIN_SECTIONS: dict[str, dict] = {
    "HW300x300x10x15": {"A": 0.01204, "Ix": 2.05e-4, "Iy": 6.76e-5, "Wx": 1.37e-3, "Wy": 4.50e-4, "ix": 0.130, "iy": 0.075},
    "HW350x350x12x19": {"A": 0.01736, "Ix": 4.03e-4, "Iy": 1.36e-4, "Wx": 2.30e-3, "Wy": 7.76e-4, "ix": 0.152, "iy": 0.088},
    "HW400x400x13x21": {"A": 0.02187, "Ix": 6.69e-4, "Iy": 2.24e-4, "Wx": 3.34e-3, "Wy": 1.12e-3, "ix": 0.175, "iy": 0.101},
    "HM244x175x7x11":  {"A": 0.00556, "Ix": 6.12e-5, "Iy": 9.84e-6, "Wx": 5.02e-4, "Wy": 1.12e-4, "ix": 0.105, "iy": 0.042},
    "HM294x200x8x12":  {"A": 0.00730, "Ix": 1.14e-4, "Iy": 1.60e-5, "Wx": 7.79e-4, "Wy": 1.60e-4, "ix": 0.125, "iy": 0.047},
    "HM340x250x9x14":  {"A": 0.01018, "Ix": 2.17e-4, "Iy": 3.65e-5, "Wx": 1.28e-3, "Wy": 2.92e-4, "ix": 0.146, "iy": 0.060},
    "HM390x300x10x16": {"A": 0.01366, "Ix": 3.89e-4, "Iy": 7.21e-5, "Wx": 2.00e-3, "Wy": 4.81e-4, "ix": 0.169, "iy": 0.073},
}

BUILTIN_MATERIALS: dict[str, dict] = {
    "Q235": {"name": "Q235", "E": 2.06e8, "fy": 2.35e5, "nu": 0.3, "density": 7850},
    "Q355": {"name": "Q355", "E": 2.06e8, "fy": 3.55e5, "nu": 0.3, "density": 7850},
}


class SteelFrameGenerator(CAIAOServer):
    """钢框架结构模型生成器。

    根据用户指定的网格、层数、截面等参数，
    生成包含节点、单元、截面和材料的完整结构模型。
    """

    def __init__(self):
        super().__init__()

    @tool(
        name="generate_frame",
        description="根据网格参数生成钢框架结构模型。输入x/y方向柱距列表、层数、层高和截面选择，输出完整的模型JSON。",
        input_schema={
            "type": "object",
            "required": ["grid_x", "grid_y", "num_stories", "story_heights"],
            "properties": {
                "grid_x": {
                    "type": "array", "items": {"type": "number"},
                    "description": "X方向柱距列表（m），如 [6.0, 6.0, 6.0] 表示3跨各6m"
                },
                "grid_y": {
                    "type": "array", "items": {"type": "number"},
                    "description": "Y方向柱距列表（m）"
                },
                "num_stories": {
                    "type": "integer", "minimum": 1,
                    "description": "层数"
                },
                "story_heights": {
                    "type": "array", "items": {"type": "number"},
                    "description": "各层层高（m），长度应等于 num_stories，从底层到顶层"
                },
                "column_section": {
                    "type": "string",
                    "description": "柱截面型号，默认 HW350x350x12x19",
                    "default": "HW350x350x12x19"
                },
                "beam_section": {
                    "type": "string",
                    "description": "梁截面型号，默认 HM340x250x9x14",
                    "default": "HM340x250x9x14"
                },
                "material": {
                    "type": "string",
                    "description": "材料等级，Q235 或 Q355",
                    "default": "Q235"
                },
                "name": {
                    "type": "string",
                    "description": "模型名称",
                    "default": "Steel Frame"
                }
            }
        }
    )
    def generate_frame(self, input_data: dict) -> dict:
        grid_x = input_data["grid_x"]
        grid_y = input_data["grid_y"]
        num_stories = input_data["num_stories"]
        story_heights = input_data["story_heights"]
        column_sec = input_data.get("column_section", "HW350x350x12x19")
        beam_sec = input_data.get("beam_section", "HM340x250x9x14")
        material_id = input_data.get("material", "Q235")
        name = input_data.get("name", "Steel Frame")

        if len(story_heights) != num_stories:
            return {"error": f"story_heights length ({len(story_heights)}) != num_stories ({num_stories})"}

        # 验证截面和材料存在
        if column_sec not in BUILTIN_SECTIONS:
            return {"error": f"Unknown column section: {column_sec}. Available: {list(BUILTIN_SECTIONS.keys())}"}
        if beam_sec not in BUILTIN_SECTIONS:
            return {"error": f"Unknown beam section: {beam_sec}. Available: {list(BUILTIN_SECTIONS.keys())}"}
        if material_id not in BUILTIN_MATERIALS:
            return {"error": f"Unknown material: {material_id}. Available: {list(BUILTIN_MATERIALS.keys())}"}

        # ── 计算网格坐标 ──────────────────────────────────────
        n_col_x = len(grid_x) + 1  # 柱数 = 跨数 + 1
        n_col_y = len(grid_y) + 1
        x_coords = [0.0]
        for dx in grid_x:
            x_coords.append(x_coords[-1] + dx)
        y_coords = [0.0]
        for dy in grid_y:
            y_coords.append(y_coords[-1] + dy)

        # 累计高度（从地面 0 开始）
        z_levels = [0.0]
        for h in story_heights:
            z_levels.append(z_levels[-1] + h)

        # ── 生成节点 ──────────────────────────────────────────
        nodes = []
        node_id = 1
        node_map = {}  # (ix, iy, iz) -> node_id

        for iz in range(num_stories + 1):  # 包含底层（地面）到顶层
            z = z_levels[iz]
            for iy in range(n_col_y):
                y = y_coords[iy]
                for ix in range(n_col_x):
                    x = x_coords[ix]
                    nodes.append({"id": node_id, "x": x, "y": y, "z": z})
                    node_map[(ix, iy, iz)] = node_id
                    node_id += 1

        # ── 生成单元 ──────────────────────────────────────────
        elements = []
        elem_id = 1

        for iz in range(num_stories):
            for iy in range(n_col_y):
                for ix in range(n_col_x):
                    bottom_node = node_map[(ix, iy, iz)]
                    top_node = node_map[(ix, iy, iz + 1)]
                    elements.append({
                        "id": elem_id,
                        "node_i": bottom_node,
                        "node_j": top_node,
                        "section_id": column_sec,
                        "type": "column"
                    })
                    elem_id += 1

        # 主梁：X方向
        for iz in range(1, num_stories + 1):
            for iy in range(n_col_y):
                for ix in range(n_col_x - 1):
                    node_a = node_map[(ix, iy, iz)]
                    node_b = node_map[(ix + 1, iy, iz)]
                    elements.append({
                        "id": elem_id,
                        "node_i": node_a,
                        "node_j": node_b,
                        "section_id": beam_sec,
                        "type": "beam"
                    })
                    elem_id += 1

        # 主梁：Y方向
        for iz in range(1, num_stories + 1):
            for ix in range(n_col_x):
                for iy in range(n_col_y - 1):
                    node_a = node_map[(ix, iy, iz)]
                    node_b = node_map[(ix, iy + 1, iz)]
                    elements.append({
                        "id": elem_id,
                        "node_i": node_a,
                        "node_j": node_b,
                        "section_id": beam_sec,
                        "type": "beam"
                    })
                    elem_id += 1

        # ── 构建截面列表（含几何属性）────────────────────────
        sections = []
        sec_ids = set()
        for el in elements:
            sid = el["section_id"]
            if sid not in sec_ids:
                sec_ids.add(sid)
                sec_data = BUILTIN_SECTIONS[sid].copy()
                sec_data["id"] = sid
                sec_data["material_id"] = material_id
                sec_data["profile"] = sid
                sections.append(sec_data)

        # ── 构建材料列表 ──────────────────────────────────────
        mat_data = BUILTIN_MATERIALS[material_id].copy()
        mat_data["id"] = material_id
        materials = [mat_data]

        model = {
            "metadata": {
                "name": name,
                "description": f"{num_stories}层钢框架，{n_col_x}x{n_col_y}柱网",
                "units": {"length": "m", "force": "kN"}
            },
            "nodes": nodes,
            "elements": elements,
            "sections": sections,
            "materials": materials
        }

        return model


# ── 独立运行入口 ──────────────────────────────────────────────────

if __name__ == "__main__":
    server = SteelFrameGenerator()
    server.run_cli()
