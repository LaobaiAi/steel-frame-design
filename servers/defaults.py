"""
共享默认设计参数 — CAIAO 项目唯一默认值来源

所有 Server 和 CLI 入口均从此模块获取默认参数，
不在代码中硬编码默认值。新增参数只需修改此文件。

用法:
    from servers.defaults import DEFAULT_DESIGN_PARAMS, BUILTIN_SECTIONS, BUILTIN_MATERIALS
"""

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

# ── 默认设计参数（唯一来源）────────────────────────────────────

DEFAULT_DESIGN_PARAMS: dict = {
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

# ── Quick 演示参数（与默认值不同时覆盖）───────────────────────

QUICK_DEMO_PARAMS: dict = {
    **DEFAULT_DESIGN_PARAMS,
    "grid_x": [6.0, 6.0, 6.0],
    "grid_y": [6.0, 6.0],
    "num_stories": 4,
    "story_heights": [4.0, 3.5, 3.5, 3.5],
    "column_section": "HW350x350x12x19",
    "beam_section": "HM340x250x9x14",
    "material": "Q355",
    "name": "示例办公楼",
}

# ── 荷载组合系数（GB50017）─────────────────────────────────────

COMBO_DEFS: list[tuple[str, list[tuple[float, str]]]] = [
    ("1.3D + 1.5L", [(1.3, "Dead"), (1.5, "Live")]),
    ("1.3D + 1.5W", [(1.3, "Dead"), (1.5, "Wind")]),
    ("1.3D + 1.5L + 0.9W", [(1.3, "Dead"), (1.5, "Live"), (0.9, "Wind")]),
    ("1.3D + 1.3S", [(1.3, "Dead"), (1.3, "Seismic")]),
    ("1.0D + 1.5W", [(1.0, "Dead"), (1.5, "Wind")]),
]

COMBO_LABELS: list[tuple[str, str]] = [
    ("1.3D + 1.5L", "恒+活主导"),
    ("1.3D + 1.5W", "恒+风主导"),
    ("1.3D + 1.5L + 0.9W", "恒+活+风"),
    ("1.3D + 1.3S", "恒+震"),
    ("1.0D + 1.5W", "风吸力"),
]

# ── 应力比颜色映射（前后端共用梯度定义）───────────────────────

# 连续梯度：ratio 0→绿 #00FF00，0.5→黄 #FFFF00，1.0+→红 #FF0000
# 前端 ResultsPanel 的离散阈值应与下列 stops 对齐
COLORMAP_STOPS: list[dict] = [
    {"ratio": 0.0,  "r": 0,   "g": 255, "b": 0,   "label": "安全",  "hex": "#00FF00"},
    {"ratio": 0.3,  "r": 153, "g": 255, "b": 0,   "label": "",      "hex": "#99FF00"},
    {"ratio": 0.5,  "r": 255, "g": 255, "b": 0,   "label": "注意",  "hex": "#FFFF00"},
    {"ratio": 0.65, "r": 255, "g": 170, "b": 0,   "label": "",      "hex": "#FFAA00"},
    {"ratio": 0.8,  "r": 255, "g": 68,  "b": 0,   "label": "警告",  "hex": "#FF4400"},
    {"ratio": 1.0,  "r": 255, "g": 0,   "b": 0,   "label": "超限",  "hex": "#FF0000"},
]

# 前端表行背景色（离散阈值，从 COLORMAP_STOPS 派生）
COLORMAP_THRESHOLDS: list[dict] = [
    {"max_ratio": 0.5,  "dot": "#32CC66", "bg": "rgba(50,204,102,0.12)",  "label": "安全"},
    {"max_ratio": 0.65, "dot": "#AADD00", "bg": "rgba(170,221,0,0.12)",   "label": "注意"},
    {"max_ratio": 0.8,  "dot": "#FFCC00", "bg": "rgba(255,204,0,0.12)",   "label": "警告"},
    {"max_ratio": 0.95, "dot": "#FF8800", "bg": "rgba(255,136,0,0.15)",   "label": "临近超限"},
    {"max_ratio": float("inf"), "dot": "#FF4400", "bg": "rgba(255,68,0,0.18)", "label": "超限"},
]
