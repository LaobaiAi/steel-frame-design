"""
规范校核 Server (steel_code_check)

从 StructureClaw 萃取：按 GB50017 钢标进行构件校核。
输入：分析结果 + 模型信息 + 设计参数
输出：校核结果（应力比、稳定比、挠度比、长细比）
"""

import math
from servers.base import CAIAOServer, tool


class SteelCodeCheck(CAIAOServer):
    """GB50017 钢标校核器。

    对每个构件进行：
    - 强度校核（拉弯/压弯应力比）
    - 稳定性校核（平面内/平面外）
    - 挠度校核
    - 长细比校核
    """

    server_name = "code-checker"
    server_version = "1.0.0"
    server_category = "code_compliance"
    server_description = "按GB50017-2017钢标对钢框架构件进行强度、稳定性、挠度和长细比校核"
    server_dependencies = []

    def __init__(self):
        super().__init__()

    def _check_element(self, el: dict, forces: dict, sec: dict, mat: dict,
                        length: float, params: dict) -> dict:
        """校核单个构件。"""
        A = sec.get("A", 0.01)
        Wx = sec.get("Wx", A * 0.1)
        Wy = sec.get("Wy", Wx * 0.5)
        ix = sec.get("ix", 0.1)
        iy = sec.get("iy", 0.05)

        fy = mat.get("fy", 2.35e5)  # kN/m²
        E = mat.get("E", 2.06e8)

        N = abs(forces.get("N", 0))
        My = abs(forces.get("My", 0))
        Mz = abs(forces.get("Mz", 0))

        px = 1.0
        py = 1.0

        results = {}
        messages = []

        # ── 1. 长细比校核 ─────────────────────────────────────
        lambda_x = length / ix if ix > 0 else 999
        lambda_y = length / iy if iy > 0 else 999
        lambda_max = max(lambda_x, lambda_y)
        lambda_limit = params.get("slenderness_limit", 150)
        slenderness_check = lambda_max <= lambda_limit
        results["slenderness_ratio"] = round(lambda_max, 2)
        if not slenderness_check:
            messages.append(f"长细比超限: λ_max={lambda_max:.1f} > {lambda_limit}")

        # ── 2. 强度校核（压弯构件）───────────────────────────
        sigma_n = N / A if A > 0 else 0
        sigma_mx = My / Wx if Wx > 0 else 0
        sigma_my = Mz / Wy if Wy > 0 else 0
        stress_ratio = (sigma_n + sigma_mx + sigma_my) / fy
        results["stress_ratio"] = round(float(stress_ratio), 6)
        if stress_ratio > 1.0:
            messages.append(f"强度超限: stress_ratio={stress_ratio:.3f}")

        # ── 3. 稳定性校核（简化：按轴心受压）─────────────────
        lambda_bar_x = (lambda_x / math.pi) * math.sqrt(fy / E)
        lambda_bar_y = (lambda_y / math.pi) * math.sqrt(fy / E)

        # a 类曲线（简化稳定系数）
        def phi(lambda_bar: float) -> float:
            if lambda_bar <= 0.215:
                return 1.0 - 0.65 * lambda_bar ** 2
            alpha = 0.41  # a类曲线
            inner = (1 + alpha * (lambda_bar - 0.215) + lambda_bar ** 2) ** 2 - 4 * lambda_bar ** 2
            if inner <= 0:
                return 0.1
            return (1 + alpha * (lambda_bar - 0.215) + lambda_bar ** 2 - math.sqrt(inner)) / (2 * lambda_bar ** 2)

        phi_x = phi(lambda_bar_x)
        phi_y = phi(lambda_bar_y)
        phi_min = min(phi_x, phi_y)

        # 稳定应力比
        stab_ratio = N / (phi_min * A * fy) if (phi_min * A * fy) > 0 else 0
        results["stability_ratio"] = round(float(stab_ratio), 6)
        if stab_ratio > 1.0:
            messages.append(f"稳定性超限: stability_ratio={stab_ratio:.3f}")

        # ── 4. 挠度校核（简化）───────────────────────────────
        I_min = min(sec.get("Ix", 0), sec.get("Iy", 0))
        deflection_limit = params.get("deflection_limit", length / 250)
        # 近似挠度：假设简支梁 qL 作用下的最大挠度
        q_equiv = abs(forces.get("Vz", 0)) * 2 / length if length > 0 else 0
        if I_min > 1e-9 and length > 0:
            delta = (5 * q_equiv * length ** 4) / (384 * E * I_min)
            actual_deflection = min(delta, length / 100)  # sanity clamp
        else:
            actual_deflection = 0
        deflection_ratio_val = actual_deflection / deflection_limit if deflection_limit > 0 else 0
        results["deflection_ratio"] = round(float(deflection_ratio_val), 6)
        if deflection_ratio_val > 1.0:
            messages.append(f"挠度超限: ratio={deflection_ratio_val:.3f}")

        # ── 综合判断 ─────────────────────────────────────────
        max_ratio = max(stress_ratio, stab_ratio, deflection_ratio_val,
                        lambda_max / lambda_limit)
        passed = max_ratio <= 1.0
        results["pass"] = passed
        results["messages"] = messages

        return results

    @tool(
        name="check_code",
        description="按 GB50017 进行钢框架构件校核。输入分析结果、模型信息和设计参数，输出校核结果。",
        input_schema={
            "type": "object",
            "required": ["model", "analysis_results", "load_case_name"],
            "properties": {
                "model": {
                    "type": "object",
                    "description": "结构模型 JSON"
                },
                "analysis_results": {
                    "type": "array",
                    "description": "各工况分析结果列表",
                    "items": {"type": "object"}
                },
                "load_case_name": {
                    "type": "string",
                    "description": "主校核荷载工况名"
                },
                "slenderness_limit": {
                    "type": "number",
                    "description": "长细比限值，默认 150（受压构件）",
                    "default": 150
                },
                "deflection_limit_ratio": {
                    "type": "number",
                    "description": "挠度限值为跨度的 1/N，默认 250",
                    "default": 250
                }
            }
        }
    )
    def check_code(self, input_data: dict) -> dict:
        model = input_data["model"]
        analysis_results = input_data["analysis_results"]
        load_case_name = input_data.get("load_case_name", "Dead")

        deflection_limit_ratio = input_data.get("deflection_limit_ratio", 250)
        slenderness_limit = input_data.get("slenderness_limit", 150)

        sects = {s["id"]: s for s in model["sections"]}
        mats = {m["id"]: m for m in model["materials"]}
        nodes = model["nodes"]
        node_coords = {n["id"]: (n["x"], n["y"], n["z"]) for n in nodes}

        z_set = sorted(set(round(n["z"], 3) for n in nodes))
        z_levels = [z for z in z_set if z > 0.01]

        def get_story(el_type: str, ni_z: float, nj_z: float, dx: float, dy: float) -> int:
            """确定构件所属楼层（1-based）。

            楼层约定：
              z_levels[0] = 2层楼面标高, z_levels[1] = 3层楼面标高, ...
              1层 = 地面(z=0) 到 z_levels[0]
              柱属底部所在楼层的上一层（柱底在 z_levels[i] 属 i+2 层），
              梁属梁面所在实际楼层（梁面在 z_levels[i] 属 i+1 层）
            """
            if el_type == "column":
                ref_z = min(ni_z, nj_z)  # 柱底标高
            else:
                ref_z = max(ni_z, nj_z)  # 梁面标高

            if ref_z < 0.01:
                return 1
            for idx, zl in enumerate(z_levels):
                if abs(ref_z - zl) < 0.3:
                    if el_type == "column":
                        return idx + 2  # 柱底在 z_levels[idx] → 属 idx+2 层
                    return idx + 1      # 梁面在 z_levels[idx] → 属 idx+1 层
            # 不在任何层标高处，找最近标高推算
            for idx, zl in enumerate(z_levels):
                if ref_z < zl:
                    return idx + 1
            return len(z_levels)

        def get_element_label(el_type: str, dx: float, dy: float) -> str:
            """返回构件类型的中文标签。"""
            if el_type == "column":
                return "柱"
            if dx > dy:
                return "X向梁"
            return "Y向梁"

        # 分工况收集内力（保留符号，不取绝对值）
        force_keys = ["N", "Vy", "Vz", "T", "My", "Mz"]
        forces_by_case: dict[str, dict[str, dict[str, float]]] = {}
        for ar in analysis_results:
            lc_name = ar.get("load_case", ar.get("name", "unknown"))
            if "element_forces" in ar:
                for eid, fvals in ar["element_forces"].items():
                    forces_by_case.setdefault(lc_name, {}).setdefault(eid, {k: 0.0 for k in force_keys})
                    for k in force_keys:
                        forces_by_case[lc_name][eid][k] += fvals.get(k, 0.0)

        # GB50017 荷载组合（简化）:
        # Combo1: 1.3*D + 1.5*L
        # Combo2: 1.3*D + 1.5*W
        # Combo3: 1.3*D + 1.5*L + 0.9*W
        # Combo4: 1.3*D + 1.3*S  (地震简化)
        # Combo5: 1.0*D + 1.5*W  (风吸力)

        def get_case_forces(case_name: str, elem_id: str) -> dict[str, float]:
            return forces_by_case.get(case_name, {}).get(elem_id, {k: 0.0 for k in force_keys})

        def combine_for_element(elem_id: str, coeffs: list[tuple[float, str]]) -> dict[str, float]:
            result = {k: 0.0 for k in force_keys}
            for factor, case_name in coeffs:
                cf = get_case_forces(case_name, elem_id)
                for k in force_keys:
                    result[k] += factor * cf[k]
            return result

        # 对每个构件取各组合的最大绝对值（包络设计）
        all_forces = {}
        for el in model["elements"]:
            eid = str(el["id"])
            combos = [
                combine_for_element(eid, [(1.3, "Dead"), (1.5, "Live")]),
                combine_for_element(eid, [(1.3, "Dead"), (1.5, "Wind")]),
                combine_for_element(eid, [(1.3, "Dead"), (1.5, "Live"), (0.9, "Wind")]),
                combine_for_element(eid, [(1.3, "Dead"), (1.3, "Seismic")]),
                combine_for_element(eid, [(1.0, "Dead"), (1.5, "Wind")]),
            ]
            env = {k: 0.0 for k in force_keys}
            for combo in combos:
                for k in force_keys:
                    if abs(combo[k]) > abs(env[k]):
                        env[k] = combo[k]
            all_forces[eid] = env

        elements_results = []
        passed_count = 0
        failed_count = 0
        max_stress = 0
        max_deflection = 0

        for el in model["elements"]:
            sec = sects.get(el["section_id"])
            if sec is None:
                continue
            mat = mats.get(sec.get("material_id", "Q235"))
            if mat is None:
                continue

            ni = node_coords.get(el["node_i"], (0, 0, 0))
            nj = node_coords.get(el["node_j"], (0, 0, 0))
            length = math.sqrt((nj[0]-ni[0])**2 + (nj[1]-ni[1])**2 + (nj[2]-ni[2])**2)

            forces = all_forces.get(str(el["id"]), {"N": 0, "Vy": 0, "Vz": 0, "T": 0, "My": 0, "Mz": 0})

            dx = abs(nj[0] - ni[0])
            dy = abs(nj[1] - ni[1])

            # 挠度限值基于实际构件长度
            el_params = {
                "slenderness_limit": slenderness_limit,
                "deflection_limit": length / deflection_limit_ratio if length > 0 else 0.01,
            }
            check_result = self._check_element(el, forces, sec, mat, length, el_params)
            check_result["id"] = el["id"]
            check_result["type"] = get_element_label(el.get("type", "beam"), dx, dy)
            check_result["section"] = el.get("section_id", "")
            check_result["story"] = get_story(el.get("type", "beam"), ni[2], nj[2], dx, dy)
            check_result["node_i"] = el["node_i"]
            check_result["node_j"] = el["node_j"]
            elements_results.append(check_result)

            if check_result["pass"]:
                passed_count += 1
            else:
                failed_count += 1

            max_stress = max(max_stress, check_result.get("stress_ratio", 0))
            max_deflection = max(max_deflection, check_result.get("deflection_ratio", 0))

        return {
            "elements": elements_results,
            "summary": {
                "total_elements": len(elements_results),
                "passed": passed_count,
                "failed": failed_count,
                "max_stress_ratio": round(max_stress, 6),
                "max_deflection_ratio": round(max_deflection, 6)
            }
        }


if __name__ == "__main__":
    server = SteelCodeCheck()
    server.run_cli()
