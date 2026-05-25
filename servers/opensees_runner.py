"""
有限元分析运行器 Server (opensees_runner)

自研矩阵位移法实现（3D 空间梁单元）。
从 StructureClaw 萃取：执行线性静力分析。
输入：带荷载的模型 JSON，输出位移和内力。

由于 OpenSeesPy 环境受限，采用纯 Python 矩阵位移法，
保留将来切换为 OpenSeesPy 的能力。
"""

import math
import numpy as np
from servers.base import CAIAOServer, tool


class OpenSeesRunner(CAIAOServer):
    """有限元分析运行器。

    使用矩阵位移法（直接刚度法）对钢框架进行线性静力分析。
    支持 3D 空间梁单元，每节点 6 自由度。
    """

    server_name = "fea-runner"
    server_version = "1.0.0"
    server_category = "structural_analysis"
    server_description = "使用矩阵位移法对钢框架执行线性静力分析，输出位移和单元内力"
    server_dependencies = ["numpy"]

    def __init__(self):
        super().__init__()

    # ── 3D 梁单元刚度矩阵（局部坐标系）─────────────────────────

    def _beam_stiffness_local(self, E: float, G: float, A: float, Iy: float, Iz: float,
                               J: float, L: float) -> np.ndarray:
        """计算 3D 梁单元在局部坐标系下的 12x12 刚度矩阵。

        局部坐标系：x'沿杆轴，y'和z'为截面主轴。
        自由度顺序：[ux, uy, uz, rx, ry, rz]_i, [ux, uy, uz, rx, ry, rz]_j
        """
        k = np.zeros((12, 12))

        # 轴向刚度
        k[0, 0] = E * A / L
        k[0, 6] = -E * A / L
        k[6, 0] = -E * A / L
        k[6, 6] = E * A / L

        # 扭转刚度
        k[3, 3] = G * J / L
        k[3, 9] = -G * J / L
        k[9, 3] = -G * J / L
        k[9, 9] = G * J / L

        # 弯曲 y 平面（绕 z 轴 → 对应 DOF 1,5,7,11）
        L2, L3 = L * L, L * L * L
        k[1, 1] = 12 * E * Iz / L3
        k[1, 5] = 6 * E * Iz / L2
        k[1, 7] = -12 * E * Iz / L3
        k[1, 11] = 6 * E * Iz / L2

        k[5, 1] = 6 * E * Iz / L2
        k[5, 5] = 4 * E * Iz / L
        k[5, 7] = -6 * E * Iz / L2
        k[5, 11] = 2 * E * Iz / L

        k[7, 1] = -12 * E * Iz / L3
        k[7, 5] = -6 * E * Iz / L2
        k[7, 7] = 12 * E * Iz / L3
        k[7, 11] = -6 * E * Iz / L2

        k[11, 1] = 6 * E * Iz / L2
        k[11, 5] = 2 * E * Iz / L
        k[11, 7] = -6 * E * Iz / L2
        k[11, 11] = 4 * E * Iz / L

        # 弯曲 z 平面（绕 y 轴 → 对应 DOF 2,4,8,10）
        k[2, 2] = 12 * E * Iy / L3
        k[2, 4] = -6 * E * Iy / L2
        k[2, 8] = -12 * E * Iy / L3
        k[2, 10] = -6 * E * Iy / L2

        k[4, 2] = -6 * E * Iy / L2
        k[4, 4] = 4 * E * Iy / L
        k[4, 8] = 6 * E * Iy / L2
        k[4, 10] = 2 * E * Iy / L

        k[8, 2] = -12 * E * Iy / L3
        k[8, 4] = 6 * E * Iy / L2
        k[8, 8] = 12 * E * Iy / L3
        k[8, 10] = 6 * E * Iy / L2

        k[10, 2] = -6 * E * Iy / L2
        k[10, 4] = 2 * E * Iy / L
        k[10, 8] = 6 * E * Iy / L2
        k[10, 10] = 4 * E * Iy / L

        return k

    # ── 坐标变换矩阵 ──────────────────────────────────────────

    def _transformation_matrix(self, xi: np.ndarray, xj: np.ndarray,
                                y_axis: np.ndarray | None = None) -> np.ndarray:
        """计算从局部到全局的 12x12 变换矩阵。

        x' 沿杆轴方向，z' 尽可能竖直向上，y' 由右手定则确定。
        """
        L_vec = xj - xi
        L = np.linalg.norm(L_vec)
        if L < 1e-12:
            L = 1e-12
        x_prime = L_vec / L

        # z' 方向：尽量取全局 Z 方向（竖直），但需与 x' 正交
        if y_axis is None:
            z_global = np.array([0.0, 0.0, 1.0])
            if abs(np.dot(x_prime, z_global)) > 0.999:
                z_global = np.array([0.0, 1.0, 0.0])
            y_prime = np.cross(z_global, x_prime)
            y_norm = np.linalg.norm(y_prime)
            if y_norm < 1e-12:
                y_prime = np.array([0.0, 1.0, 0.0])
            else:
                y_prime = y_prime / y_norm
            z_prime = np.cross(x_prime, y_prime)
        else:
            z_prime = np.cross(x_prime, y_axis)
            z_prime = z_prime / np.linalg.norm(z_prime)
            y_prime = np.cross(z_prime, x_prime)

        R = np.zeros((3, 3))
        R[0, :] = x_prime
        R[1, :] = y_prime
        R[2, :] = z_prime

        T = np.zeros((12, 12))
        for i in range(4):
            T[3*i:3*i+3, 3*i:3*i+3] = R
        return T

    # ── 组装全局刚度矩阵 ──────────────────────────────────────

    def _assemble_system(self, model: dict) -> tuple[np.ndarray, dict, dict, dict]:
        """组装全局刚度矩阵、构建节点自由度映射。"""
        nodes = model["nodes"]
        elements = model["elements"]
        sects = {s["id"]: s for s in model["sections"]}
        mats = {m["id"]: m for m in model["materials"]}

        n_nodes = len(nodes)
        ndof = 6 * n_nodes
        K = np.zeros((ndof, ndof))

        # 节点 ID → 起始 DOF 索引
        node_list = sorted(nodes, key=lambda n: n["id"])
        dof_map = {}
        for i, n in enumerate(node_list):
            dof_map[n["id"]] = 6 * i

        node_coords = {n["id"]: np.array([n["x"], n["y"], n["z"]]) for n in nodes}

        for el in elements:
            sec = sects.get(el["section_id"])
            if sec is None:
                continue
            mat = mats.get(sec.get("material_id", "Q235"))
            if mat is None:
                continue

            E = mat["E"]
            nu = mat.get("nu", 0.3)
            G = E / (2 * (1 + nu))
            A = sec.get("A", 0.01)
            Iy = sec.get("Iy", A**3/12)
            Iz = sec.get("Ix", A**3/12)  # Ix in schema = Iz for bending about z
            # For torsion, approximate J = Iy + Iz for thin-walled (simplified)
            J_val = (sec.get("Ix", 0) + sec.get("Iy", 0)) / 2

            xi = node_coords[el["node_i"]]
            xj = node_coords[el["node_j"]]
            L = np.linalg.norm(xj - xi)

            if L < 1e-6:
                continue

            k_local = self._beam_stiffness_local(E, G, A, Iy, Iz, J_val, L)
            T = self._transformation_matrix(xi, xj)
            k_global = T.T @ k_local @ T

            # 自由度索引
            dof_i = dof_map[el["node_i"]]
            dof_j = dof_map[el["node_j"]]
            idxs = list(range(dof_i, dof_i + 6)) + list(range(dof_j, dof_j + 6))

            for a in range(12):
                for b in range(12):
                    K[idxs[a], idxs[b]] += k_global[a, b]

        return K, dof_map, node_list, node_coords

    # ── 施加荷载 ──────────────────────────────────────────────

    def _apply_loads(self, load_case: dict, dof_map: dict, ndof: int,
                     node_coords: dict) -> np.ndarray:
        """将荷载工况转换为全局荷载向量。"""
        F = np.zeros(ndof)
        nodes_by_id = {}
        for nid, dof in dof_map.items():
            nodes_by_id[nid] = dof

        for load in load_case.get("loads", []):
            nid = load.get("node_id")
            eid = load.get("element_id")
            ltype = load.get("type", "point")
            direction = load.get("direction", "global_z")
            vals = load.get("values", {})

            dir_map = {"global_x": 0, "global_y": 1, "global_z": 2}

            if nid is not None and nid in dof_map:
                dof_start = dof_map[nid]
                d = dir_map.get(direction, 2)
                if "P" in vals:
                    F[dof_start + d] += vals["P"]
                F[dof_start + d] += vals.get("Px", 0) if d == 0 else 0
                F[dof_start + d] += vals.get("Py", 0) if d == 1 else 0
                F[dof_start + d] += vals.get("Pz", 0) if d == 2 else 0

            elif eid is not None and ltype == "uniform":
                # 均布荷载等效为杆端节点力
                if "q" in vals:
                    q = vals["q"]
                    # 找到单元两端节点
                    for el_info in [(eid, nid) for eid in [eid]]: ...
        return F

    def _apply_uniform_to_nodes(self, F: np.ndarray, eid: int, q: float,
                                 elements: list, nodes_by_id_coords: dict,
                                 dof_map: dict):
        """将均布荷载等效为两端节点力（简支梁等效）。"""
        el = None
        for e in elements:
            if e["id"] == eid:
                el = e
                break
        if el is None:
            return

        dof_i = dof_map.get(el["node_i"])
        dof_j = dof_map.get(el["node_j"])
        if dof_i is None or dof_j is None:
            return

        # 近似：均布荷载在 z 方向，等效为两端各 q*L/2（简化处理）
        # 实际应该等效为 qL/2 的集中力 + 固端弯矩 qL²/12
        xi = nodes_by_id_coords[el["node_i"]]
        xj = nodes_by_id_coords[el["node_j"]]
        L = np.linalg.norm(xj - xi)
        f_end = q * L / 2

        F[dof_i + 2] += f_end
        F[dof_j + 2] += f_end

    # ── 提取结果 ──────────────────────────────────────────────

    def _extract_results(self, U: np.ndarray, F: np.ndarray, model: dict,
                         dof_map: dict, node_list: list,
                         node_coords: dict, sects: dict, mats: dict) -> dict:
        """从位移向量提取位移和内力。"""
        # 位移
        displacements = {}
        max_disp = 0
        max_disp_node = None
        for n in node_list:
            dof = dof_map[n["id"]]
            disp = U[dof:dof+6].tolist()
            displacements[str(n["id"])] = disp
            mag = np.linalg.norm(U[dof:dof+3])
            if mag > max_disp:
                max_disp = float(mag)
                max_disp_node = n["id"]

        # 内力（从单元位移计算）
        element_forces = {}
        for el in model["elements"]:
            sec = sects.get(el["section_id"])
            if sec is None:
                continue
            mat = mats.get(sec.get("material_id", "Q235"))
            if mat is None:
                continue

            dof_i = dof_map[el["node_i"]]
            dof_j = dof_map[el["node_j"]]

            xi = node_coords[el["node_i"]]
            xj = node_coords[el["node_j"]]
            L = np.linalg.norm(xj - xi)
            if L < 1e-6:
                continue

            # 获取局部位移
            u_global = np.concatenate([U[dof_i:dof_i+6], U[dof_j:dof_j+6]])
            T = self._transformation_matrix(xi, xj)
            u_local = T @ u_global

            E = mat["E"]
            A = sec.get("A", 0.01)
            Iy = sec.get("Iy", A * A / 12)
            Iz = sec.get("Ix", A * A / 12)

            # 轴力：EA * (Δu_x / L)
            N = E * A * (u_local[6] - u_local[0]) / L

            # 剪力 Vy（z方向弯曲）：面内剪力
            Vy = 12 * E * Iz / (L**3) * (u_local[1] - u_local[7]) \
                 + 6 * E * Iz / (L**2) * (u_local[5] + u_local[11])

            # 剪力 Vz（y方向弯曲）：面外剪力
            Vz = 12 * E * Iy / (L**3) * (u_local[2] - u_local[8]) \
                 - 6 * E * Iy / (L**2) * (u_local[4] + u_local[10])

            # 弯矩 My = 绕 y 轴，由 z 向位移引起
            My = -6 * E * Iy / (L**2) * (u_local[2] - u_local[8]) \
                 + 4 * E * Iy / L * u_local[4] + 2 * E * Iy / L * u_local[10]

            # 弯矩 Mz = 绕 z 轴，由 y 向位移引起
            Mz = 6 * E * Iz / (L**2) * (u_local[1] - u_local[7]) \
                 + 4 * E * Iz / L * u_local[5] + 2 * E * Iz / L * u_local[11]

            element_forces[str(el["id"])] = {
                "N": round(float(N), 4),
                "Vy": round(float(Vy), 4),
                "Vz": round(float(Vz), 4),
                "T": 0.0,
                "My": round(float(My), 4),
                "Mz": round(float(Mz), 4)
            }

        return {
            "displacements": displacements,
            "element_forces": element_forces,
            "summary": {
                "max_displacement": round(max_disp, 6),
                "max_displacement_node": max_disp_node
            }
        }

    # ── 主工具 ─────────────────────────────────────────────────

    @tool(
        name="run_analysis",
        description="对钢框架执行线性静力有限元分析。输入带荷载的模型，输出位移和单元内力。",
        input_schema={
            "type": "object",
            "required": ["loaded_model", "load_case_name"],
            "properties": {
                "loaded_model": {
                    "type": "object",
                    "description": "带荷载的结构模型（由 steel_load_generator 生成）"
                },
                "load_case_name": {
                    "type": "string",
                    "description": "要分析的荷载工况名称，如 Dead, Live, Wind, Seismic"
                }
            }
        }
    )
    def run_analysis(self, input_data: dict) -> dict:
        loaded_model = input_data["loaded_model"]
        load_case_name = input_data["load_case_name"]
        model = loaded_model["model"]

        # 组装系统
        K, dof_map, node_list, node_coords = self._assemble_system(model)
        ndof = K.shape[0]

        sects = {s["id"]: s for s in model["sections"]}
        mats = {m["id"]: m for m in model["materials"]}

        # 构建荷载向量
        F = np.zeros(ndof)
        bc = loaded_model.get("boundary_conditions", [])

        # 找荷载工况
        load_case = None
        for lc in loaded_model.get("load_cases", []):
            if lc["name"] == load_case_name:
                load_case = lc
                break

        if load_case is None:
            return {"error": f"Load case '{load_case_name}' not found"}

        elements = model["elements"]
        node_coords_map = {n["id"]: np.array([n["x"], n["y"], n["z"]]) for n in model["nodes"]}

        for load in load_case.get("loads", []):
            nid = load.get("node_id")
            eid = load.get("element_id")
            ltype = load.get("type", "point")
            vals = load.get("values", {})

            if nid is not None and nid in dof_map:
                dof = dof_map[nid]
                F[dof + 0] += vals.get("Px", 0) or vals.get("P", 0)
                F[dof + 1] += vals.get("Py", 0)
                F[dof + 2] += vals.get("Pz", 0)

            elif eid is not None:
                if "q" in vals:
                    self._apply_uniform_to_nodes(F, eid, vals["q"], elements, node_coords_map, dof_map)

        # 施加边界条件（消去法）
        constrained_dofs = set()
        for bc_item in bc:
            nid = bc_item["node_id"]
            if nid in dof_map:
                dof_start = dof_map[nid]
                for i, restrained in enumerate(bc_item["restraints"]):
                    if restrained:
                        constrained_dofs.add(dof_start + i)

        # 简化处理：对于被约束的 DOF，置零刚度矩阵对应行列，对角线设大值
        K_mod = K.copy()
        F_mod = F.copy()
        for cd in constrained_dofs:
            K_mod[cd, :] = 0
            K_mod[:, cd] = 0
            K_mod[cd, cd] = 1e20
            F_mod[cd] = 0

        # 求解
        try:
            U = np.linalg.solve(K_mod, F_mod)
        except np.linalg.LinAlgError as e:
            return {"error": f"Matrix singular or solve failed: {str(e)}"}

        # 提取结果
        results = self._extract_results(U, F, model, dof_map, node_list, node_coords, sects, mats)
        results["load_case"] = load_case_name

        return results


if __name__ == "__main__":
    server = OpenSeesRunner()
    server.run_cli()
