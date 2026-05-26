"""
荷载施加器 Server (steel_load_generator)

从 StructureClaw 萃取：为钢框架模型施加荷载和边界条件。
输入：结构模型 + 荷载参数
输出：带荷载的模型（符合 load.schema.json）
"""

from servers.base import CAIAOServer, tool


class SteelLoadGenerator(CAIAOServer):
    """荷载与边界条件施加器。

    根据用户指定的荷载参数，为钢框架模型施加：
    - 恒荷载（楼面自重 + 附加恒载）
    - 活荷载
    - 简化风荷载
    - 简化地震作用
    - 边界条件（柱脚固接）
    """

    server_name = "load-generator"
    server_version = "1.0.0"
    server_category = "load_analysis"
    server_description = "为钢框架模型施加恒载、活载、风荷载和地震作用及边界条件"
    server_dependencies = []

    def __init__(self):
        super().__init__()

    @tool(
        name="apply_loads",
        description="为钢框架模型施加荷载和边界条件。输入模型和荷载参数，输出带荷载工况的完整模型。",
        input_schema={
            "type": "object",
            "required": ["model"],
            "properties": {
                "model": {
                    "type": "object",
                    "description": "基础结构模型（由 steel_frame_generator 生成）"
                },
                "dead_load": {
                    "type": "number",
                    "description": "楼面附加恒载 (kN/m²)，默认 1.5",
                    "default": 1.5
                },
                "live_load": {
                    "type": "number",
                    "description": "楼面活载 (kN/m²)，默认 2.0",
                    "default": 2.0
                },
                "roof_live_load": {
                    "type": "number",
                    "description": "屋面活载 (kN/m²)，默认 0.5",
                    "default": 0.5
                },
                "wind_pressure": {
                    "type": "number",
                    "description": "基本风压 (kN/m²)，默认 0.45",
                    "default": 0.45
                },
                "seismic_intensity": {
                    "type": "number",
                    "description": "地震影响系数最大值，默认 0.08 (7度)",
                    "default": 0.08
                },
                "include_seismic": {
                    "type": "boolean",
                    "description": "是否包含地震工况",
                    "default": True
                },
                "include_wind": {
                    "type": "boolean",
                    "description": "是否包含风荷载工况",
                    "default": True
                }
            }
        }
    )
    def apply_loads(self, input_data: dict) -> dict:
        model = input_data["model"]
        dead = input_data.get("dead_load", 1.5)
        live = input_data.get("live_load", 2.0)
        roof_live = input_data.get("roof_live_load", 0.5)
        wind_p = input_data.get("wind_pressure", 0.45)
        seismic = input_data.get("seismic_intensity", 0.08)
        include_seismic = input_data.get("include_seismic", True)
        include_wind = input_data.get("include_wind", True)

        nodes = model["nodes"]
        elements = model["elements"]

        # ── 确定网格参数 ─────────────────────────────────────
        # 从节点坐标推算实际柱距（用于从属宽度）
        x_coords = sorted(set(n["x"] for n in nodes))
        y_coords = sorted(set(n["y"] for n in nodes))
        grid_spacing_x = [x_coords[i+1] - x_coords[i] for i in range(len(x_coords)-1)]
        grid_spacing_y = [y_coords[i+1] - y_coords[i] for i in range(len(y_coords)-1)]
        avg_spacing_x = sum(grid_spacing_x) / len(grid_spacing_x) if grid_spacing_x else 6.0
        avg_spacing_y = sum(grid_spacing_y) / len(grid_spacing_y) if grid_spacing_y else 6.0
        tributary_x = avg_spacing_x / 2  # 双向板，每根梁分担一半跨度
        tributary_y = avg_spacing_y / 2

        max_x = max(n["x"] for n in nodes)
        max_y = max(n["y"] for n in nodes)
        max_z = max(n["z"] for n in nodes)

        # 各层高度（唯一 Z 坐标，排除 0）
        z_levels = sorted(set(n["z"] for n in nodes if n["z"] > 0.001))
        num_stories = len(z_levels)

        # 估算楼层面积（用于计算集中质量）
        floor_area = max_x * max_y
        # 估算建筑重量：楼层 = 面积 × (恒+0.5活) + 构件自重简化
        # 简化：每平米总重约 dead_load + 0.5*live_load + 钢结构自重 0.8 kN/m²
        weight_per_floor = floor_area * (dead + 0.5 * live + 0.8)
        roof_weight = floor_area * (dead + 0.5 * roof_live + 0.8)

        # ── 边界条件：柱脚全部固接 ────────────────────────────
        bc = []
        for n in nodes:
            if n["z"] < 0.001:  # 地面节点
                bc.append({
                    "node_id": n["id"],
                    "restraints": [True, True, True, True, True, True]
                })

        # ── 荷载工况 1: 恒载 (Dead Load) ──────────────────────
        dead_loads = []
        for el in elements:
            if el["type"] == "beam":
                node_i = next(n for n in nodes if n["id"] == el["node_i"])
                node_j = next(n for n in nodes if n["id"] == el["node_j"])
                z = node_i["z"]
                if z > 0.001:
                    # 恒载对屋面/楼面相同；按梁方向取对应从属宽度
                    dx = abs(node_j["x"] - node_i["x"])
                    dy = abs(node_j["y"] - node_i["y"])
                    tributary = tributary_y if dx > dy else tributary_x
                    ql = dead * tributary
                    dead_loads.append({
                        "element_id": el["id"],
                        "type": "uniform",
                        "direction": "global_z",
                        "values": {"q": -ql}
                    })

        # ── 荷载工况 2: 活载 (Live Load) ──────────────────────
        live_loads = []
        for el in elements:
            if el["type"] == "beam":
                node_el = next(n for n in nodes if n["id"] == el["node_i"])
                node_j = next(n for n in nodes if n["id"] == el["node_j"])
                z = node_el["z"]
                if z > 0.001:
                    is_roof = abs(z - max_z) < 0.01
                    ll = roof_live if is_roof else live
                    dx = abs(node_j["x"] - node_el["x"])
                    dy = abs(node_j["y"] - node_el["y"])
                    tributary = tributary_y if dx > dy else tributary_x
                    ql = ll * tributary
                    live_loads.append({
                        "element_id": el["id"],
                        "type": "uniform",
                        "direction": "global_z",
                        "values": {"q": -ql}
                    })

        load_cases = [
            {"name": "Dead", "description": "恒荷载", "loads": dead_loads},
            {"name": "Live", "description": "活荷载", "loads": live_loads},
        ]

        # ── 荷载工况 3: 风荷载 (Wind) ─────────────────────────
        if include_wind:
            wind_loads = []
            # 简化：风荷载转为各层楼面处的水平集中力，均分给该层所有框架节点
            for i, z in enumerate(z_levels):
                story_h_upper = z_levels[i] - (z_levels[i-1] if i > 0 else 0)
                story_h_lower = (z_levels[i+1] - z) if i < len(z_levels) - 1 else story_h_upper
                story_h = (story_h_upper + story_h_lower) / 2
                wind_area = max_y * story_h
                wind_force = wind_p * 1.3 * 1.0 * wind_area
                # 均分给该层所有节点
                level_nodes = [n for n in nodes if abs(n["z"] - z) < 0.01]
                force_per_node = wind_force / len(level_nodes) if level_nodes else 0
                for n in level_nodes:
                    wind_loads.append({
                        "node_id": n["id"],
                        "type": "point",
                        "direction": "global_x",
                        "values": {"Px": force_per_node}
                    })
            load_cases.append({"name": "Wind", "description": "风荷载（X方向）", "loads": wind_loads})

        # ── 荷载工况 4: 地震 (Seismic) ────────────────────────
        if include_seismic:
            seismic_loads = []
            total_weight = sum(weight_per_floor for _ in range(num_stories - 1)) + roof_weight
            base_shear = seismic * 0.85 * total_weight
            z_weight = [(z, weight_per_floor) for z in z_levels[:-1]] + [(z_levels[-1], roof_weight)]
            total_moment = sum(z * w for z, w in z_weight)
            for z, w in z_weight:
                fi = base_shear * (z * w) / total_moment if total_moment > 0 else 0
                level_nodes = [n for n in nodes if abs(n["z"] - z) < 0.01]
                force_per_node = fi / len(level_nodes) if level_nodes else 0
                for n in level_nodes:
                    seismic_loads.append({
                        "node_id": n["id"],
                        "type": "point",
                        "direction": "global_x",
                        "values": {"Px": force_per_node}
                    })

            load_cases.append({"name": "Seismic", "description": "地震作用（X方向，底部剪力法）", "loads": seismic_loads})

        return {
            "model": model,
            "load_cases": load_cases,
            "boundary_conditions": bc
        }


if __name__ == "__main__":
    server = SteelLoadGenerator()
    server.run_cli()
