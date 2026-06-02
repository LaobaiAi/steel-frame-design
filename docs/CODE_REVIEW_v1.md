# 钢框架设计系统 — 阶段代码审查报告 v2.0

> 审查日期：2026-06-02　|　审查范围：全项目 41 核心源文件　|　约 4,500 行 Python + 3,500 行 TypeScript

---

## 目录

1. [项目概况](#1-项目概况)
2. [架构评价](#2-架构评价)
3. [严重问题 (P0)](#3-严重问题-p0)
4. [高优先级问题 (P1)](#4-高优先级问题-p1)
5. [中优先级问题 (P2)](#5-中优先级问题-p2)
6. [低优先级问题 (P3)](#6-低优先级问题-p3)
7. [可借鉴的国际专业手册](#7-可借鉴的国际专业手册)
8. [综合评分](#8-综合评分)
9. [改进路线图](#9-改进路线图)

---

## 1. 项目概况

**XuanwuAI Steel Frame Design** 是一个基于 CAIAO 原子 Server 架构的钢结构自动化设计管线。支持 CLI、Web API 和 Web 前端三种入口，覆盖参数化建模 → 荷载施加 → 有限元分析 → GB50017 规范验算 → HTML 报告生成全流程。

### 审查的文件清单

| 类别 | 文件 | 行数 |
|------|------|------|
| 调度中心 | `caiao_hub.py` | 406 |
| Server 基类 | `servers/base.py` | 211 |
| 原子 Server | `steel_frame_generator.py` | 228 |
| | `steel_load_generator.py` | 227 |
| | `opensees_runner.py` | 685 |
| | `steel_code_check.py` | 586 |
| | `report_generator.py` | 147 |
| | `three_d_exporter.py` | 187 |
| | `llm_gateway.py` | 277 |
| | `llm_param_extractor.py` | 220 |
| 合并 Server | `steel_frame_pipeline.py` | 203 |
| | `cli_orchestrator.py` | 222 |
| | `llm_agent_orchestrator.py` | 308 |
| | `web_api_server.py` | 560 |
| CLI | `cli/main.py` | 268 |
| 测试 | `tests/test_servers.py` | 408 |
| 其他 | schema 文件 (5), docs (5), templates (1) | — |

---

## 2. 架构评价

### 2.1 亮点 ✅

| 方面 | 评价 | 说明 |
|------|------|------|
| **CAIAO 原子 Server 模式** | ★★★★★ | `@tool` 装饰器 + `list_tools()`/`call_tool()` 契约设计清晰，与 MCP 协议对齐，具备前瞻性。每个 Server 功能单一、零间接依赖。 |
| **Hub 调度解耦** | ★★★★★ | `in_process` 直调 + `subprocess` 进程隔离双模式，计算型 Server 崩溃不牵连主进程。`register_subprocess()` 支持惰性启动。 |
| **双引擎 FEA** | ★★★★☆ | OpenSeesPy (C扩展) 主选 + 自研矩阵位移法 (纯 Python) 后备，自动降级。进程隔离设计正确。 |
| **三层 LLM 架构** | ★★★★☆ | 通信层 `llm_gateway` → 计算层 `llm_param_extractor` → 编排层 `llm_agent_orchestrator`，分层清晰。Agent 通过 Hub 动态发现工具而非硬编码。 |
| **前端 3D 可视化** | ★★★★☆ | React Three Fiber + Zustand，变形叠加 + 应力比颜色映射 + 剖切面。 |
| **项目持久化** | ★★★★☆ | 管道运行后自动归档 ML 友好 JSON 格式，input/output 分层结构便于训练。 |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────┐
│                      用户入口                            │
│     CLI (cli/main.py)    Web (http://localhost:8000)     │
└─────────────┬───────────────────┬───────────────────────┘
              │                   │
    ┌─────────▼───────┐   ┌──────▼──────────┐
    │ CliOrchestrator │   │  WebAPIServer   │  ← 合并 Server
    └─────────┬───────┘   └──────┬──────────┘
              │                  │
         ┌────▼──────────────────▼────┐
         │        CAIAO Hub           │  ← 轻量调度中心
         │  tool_registry (in_proc)   │
         │  subprocess_registry       │
         └────┬──────────────┬────────┘
              │              │
    ┌─────────▼──────┐  ┌───▼────────────┐
    │  原子 Server    │  │  子进程 Server  │
    │                │  │                │
    │ generate_frame │  │ opensees_runner│
    │ apply_loads    │  │ (进程隔离)      │
    │ check_code     │  └────────────────┘
    │ generate_report│
    │ export_3d      │
    │ llm_gateway    │
    └────────────────┘
```

---

## 3. 严重问题 (P0)

> **定义**：影响计算正确性/安全性，必须立即修复。

### 3.1 GB50017 稳定系数仅实现 a 类曲线

**文件**：`servers/steel_code_check.py` line 320-327

**问题**：稳定系数 φ 计算中 α 取值固定 0.41（a 类曲线），但 GB50017-2017 第 7.2.1 条 + 附录 D 规定了四类截面曲线：

| 曲线类型 | 系数 α₁ | 适用场景 |
|----------|---------|---------|
| a 类 | 0.41 | 热轧无缝钢管 |
| **b 类** | **0.65** | **H 型钢强轴、焊接箱形截面** |
| c 类 | 0.73 | H 型钢弱轴、焊接工字形截面 |
| d 类 | 1.35 | 厚壁焊接截面 |

H 型钢绕强轴 (x-x) 应为 **b 类**，绕弱轴 (y-y) 应为 **c 类**。当前全部按 a 类计算，导致 **稳定系数偏高（偏不安全）**。

**修复建议**：

```python
# 应改为：
def phi(lambda_bar: float, curve_type: str = "b") -> float:
    """GB50017-2017 附录 D 稳定系数"""
    alpha_map = {"a": 0.41, "b": 0.65, "c": 0.73, "d": 1.35}
    alpha = alpha_map.get(curve_type, 0.65)
    if lambda_bar <= 0.215:
        return 1.0 - alpha * lambda_bar ** 2
    inner = (1 + alpha * (lambda_bar - 0.215) + lambda_bar ** 2) ** 2 - 4 * lambda_bar ** 2
    if inner <= 0:
        return 0.1
    return (1 + alpha * (lambda_bar - 0.215) + lambda_bar ** 2 - math.sqrt(inner)) / (2 * lambda_bar ** 2)
```

同时需要根据截面类型自动选择曲线类型：
- 柱强轴 (x-x)：b 类
- 柱弱轴 (y-y)：c 类

---

### 3.2 仅做轴心受压校核，未做压弯构件平面内/外稳定校核

**文件**：`servers/steel_code_check.py` line 334

**问题**：当前仅做 `N/(φ·A·f) ≤ 1.0`，但钢框架柱本质上是**压弯构件**。

GB50017-2017 第 8.2 条要求：
- **平面内稳定**：`N/(φx·A) + βmx·Mx/(γx·W1x·(1-0.8·N/NEx')) ≤ f`
- **平面外稳定**：`N/(φy·A) + η·βtx·Mx/(φb·W1x) ≤ f`

`_generate_calc_processes` (line 32-273) 中虽然有这些公式的展示文本，但 `_check_element` (line 275-370) 并未实际执行压弯稳定计算。

**修复建议**：在 `_check_element` 中增加压弯稳定计算：

```python
# 平面内稳定
beta_mx = 1.0  # 无横向荷载时取 1.0
NEx = math.pi**2 * E * A / (1.1 * lambda_x**2)
denom = 1.0 - 0.8 * N / NEx  # 若 NEx < N 取 0.2
plane_in_ratio = (N / (phi_x * A * fy)
    + beta_mx * My / (gamma_x * Wx * fy * max(denom, 0.2)))

# 平面外稳定
beta_tx = 1.0
eta = 1.0
phi_b = 1.0  # 近似, 应按 GB50017 附录 C 计算
plane_out_ratio = (N / (phi_y * A * fy)
    + eta * beta_tx * My / (phi_b * Wx * fy))
```

---

### 3.3 柱计算长度系数取 1.0

**文件**：`servers/steel_code_check.py` line 69

**问题**：计算长度直接取构件几何长度：

```python
l0_cm = length_cm  # 未乘任何系数
```

钢框架柱的计算长度系数 μ 应根据 GB50017-2017 附录 E 确定：
- 无侧移框架底层柱：μ ≈ 0.65~1.0
- 有侧移框架底层柱：μ ≈ 2.0~∞

直接取 1.0 会**低估长细比**，导致稳定性校核偏不安全。

**修复建议**：至少支持两种模式：
```python
# 增加参数 effective_length_factor
K_factor = params.get("effective_length_factor", {"column": 1.0, "beam": 1.0})
l0 = length * K_factor.get(el_type, 1.0)
```

---

## 4. 高优先级问题 (P1)

> **定义**：影响代码可维护性和可靠性，应在下一迭代中解决。

### 4.1 错误处理三种模式混用

**涉及文件**：`caiao_hub.py`, 所有 `servers/*.py`

**问题**：当前同时存在三种错误传递方式：

| 方式 | 示例 | 位置 |
|------|------|------|
| `return {"error": "..."}` | 最常用 | 所有 `call_tool()` |
| `raise RuntimeError(...)` | 子进程通信失败 | `caiao_hub.py:94, 116` |
| `return None` | 惰性启动失败 | `caiao_hub.py:304` |

调用方必须 try-except、判空、判 error 三种方式全部覆盖。

**修复建议**：将所有异常/Nil 返回值统一为 `{"error": "..."}` 格式：

```python
# caiao_hub.py
# 原来 raise RuntimeError → 改为 return {"error": ...}
def _send_request(self, method, params=None):
    ...
    if "error" in response:
        return response  # 透传 error 而非 raise

# 原来 return None → 改为 return {"error": ...}
def _ensure_subprocess(self, tool_name):
    ...
    except Exception as e:
        return {"error": f"Subprocess '{mgr.name}' failed: {e}"}
```

---

### 4.2 截面数据库不完整

**文件**：`servers/steel_frame_generator.py` line 13-21

**问题**：仅内置 7 种 H 型钢截面 (HW300~HW400, HM244~HM390)：

- ❌ 缺少 HN 窄翼缘系列 (HN200x100 ~ HN900x300，约 30 种)
- ❌ 缺少热轧无缝钢管截面
- ❌ 缺少焊接箱形截面
- ❌ 硬编码在 Python 代码中，无法扩展

**修复建议**：参考 **GB/T 11263-2017《热轧 H 型钢和剖分 T 型钢》**，创建外部配置文件：

```
sections/
  h_beam.yaml      # H 型钢全系列 (~100 种)
  square_tube.yaml # 方钢管
  pipe.yaml        # 圆钢管
```

---

### 4.3 缺少 FEA 数值精度验证

**文件**：`tests/test_servers.py`

**问题**：当前测试仅验证：
- 程序不报错 ✓
- 返回结构包含某些 key ✓
- 位移值 ≥ 0 ✓

但**未验证数值精度**：
- 自研矩阵位移法 vs OpenSeesPy 结果偏差？
- 简支梁挠度解析解 vs FEA 误差？
- 悬臂柱屈曲荷载理论值 vs FEA？

**修复建议**：增加 Golden File 测试：

```python
def test_simple_beam_deflection():
    """验证简支梁跨中挠度与解析解的偏差 < 1%"""
    # 5m 简支梁, 10kN 集中力, H300x150
    # 解析解: δ = PL³/(48EI) = ...
    ...
    assert abs(fea_deflection - analytical) / analytical < 0.01
```

---

### 4.4 结构化日志缺失

**涉及文件**：全部

**问题**：所有日志均使用 `print()` 输出，无日志级别、无时间戳、无调用链追踪。

**修复建议**：引入 `structlog` 或至少 `logging`：

```python
import logging
logger = logging.getLogger(__name__)

# 原来
print(f"[Hub] 惰性启动子进程 Server '{mgr.name}'...")

# 改为
logger.info("惰性启动子进程 Server", name=mgr.name)
```

---

### 4.5 模型 Schema 命名混乱

**文件**：`schemas/model.schema.json`, `servers/opensees_runner.py`

**问题**：惯性矩命名混淆：

| Schema 中 | 代码中使用 | 力学含义 |
|-----------|-----------|---------|
| `Ix` | 作为 `Iz` | 绕强轴的惯性矩 |
| `Iy` | 作为 `Iy` | 绕弱轴的惯性矩 |

截面库中 `Ix` 存的是强轴惯性矩 (如 2.05e-4 m⁴)，正确。但当用于矩阵位移法时，代码注释说 "Ix in schema = Iz for bending" — 命名混乱。

**修复建议**：Schema 应使用清晰命名：
- `I_yy` (绕 y-y 轴，强轴)
- `I_zz` (绕 z-z 轴，弱轴)

或在文档中明确约定。

---

## 5. 中优先级问题 (P2)

> **定义**：影响扩展性和规范性，可排入后续迭代。

### 5.1 荷载生成过于简化

| 荷载类型 | 当前实现 | 规范要求 (GB50009-2012) |
|---------|---------|------------------------|
| 风荷载 | 体型系数固定 1.3 | 迎风面 0.8, 背风面 -0.5, 侧面 -0.7 |
| 风压高度系数 | 未考虑 | μz 随高度变化 (A/B/C/D 类地面粗糙度) |
| 风振系数 | 未考虑 | βz 用于基本自振周期 > 0.25s 的结构 |
| 地震场地类别 | 未考虑 | I~IV 类，影响 Tg |
| 地震影响系数 | 硬编码 0.08 | 应根据烈度、场地、Tg 查表 |

**建议**：增加配置文件 `load_params.yaml`，包含：
```yaml
site:
  ground_roughness: B    # A/B/C/D
  seismic_intensity: 7   # 6/7/8/9
  site_class: II          # I/II/III/IV
  basic_wind_pressure: 0.45  # kN/m²
  terrain_category: B
```

---

### 5.2 设计规范抽象层

**问题**：当前全系统硬编码 GB50017，无法支持多国规范。

**建议**：定义 `CodeChecker` Protocol 接口，使 GB50017 / AISC 360-22 / EN 1993-1-1 可插拔：

```python
from typing import Protocol

class CodeChecker(Protocol):
    def check_strength(self, element, forces, section, material) -> CheckResult: ...
    def check_stability(self, element, forces, section, material) -> CheckResult: ...
    def check_deflection(self, element, displacement, length) -> CheckResult: ...
    def get_load_combinations(self) -> list[LoadCombo]: ...
```

---

### 5.3 `_generate_calc_processes` 方法过长

**文件**：`servers/steel_code_check.py` line 32-273 (242 行，30+ 参数)

**问题**：违反单一职责原则，四个验算和内力组合全部揉在一个方法里。

**建议拆分为**：
```
_check_element()
 ├── _check_strength()       → StrengthResult
 ├── _check_stability()      → StabilityResult
 ├── _check_deflection()     → DeflectionResult
 ├── _check_slenderness()    → SlendernessResult
 └── _build_force_combos()   → ForceComboData
```

---

### 5.4 Web API 安全加固

**文件**：`servers/web_api_server.py`

| 问题 | 行号 | 风险 |
|------|------|------|
| CORS `allow_origins=["*"]` | 208 | 任意来源可调用 API |
| API Key 通过请求体传递 | 各处 | 应通过 `Authorization: Bearer` header |
| 无速率限制 | — | 可被恶意刷流量 |
| 前端静态文件路径遍历 | 522 | `file_path = os.path.join(_FRONTEND_DIST, full_path)` 未防护 |


**修复建议**：

```python
# CORS 限制
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
)

# API Key header 传递
api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
```

---

### 5.5 统一错误处理后的 Result 类型

**文件**：`servers/base.py`

**建议**：为 `call_tool()` 返回值增加类型约束：

```python
from typing import TypedDict

class ToolResult(TypedDict, total=False):
    # 二选一，never both
    data: dict    # 成功时
    error: str    # 失败时
```

---

## 6. 低优先级问题 (P3)

> **定义**：改善型优化，可长期规划。

### 6.1 前端大组件拆分

| 文件 | 大小 | 建议 |
|------|------|------|
| `InputPanel.tsx` | 53 KB | 拆分为 `ParamForm`, `LLMChat`, `QuickPresets` |
| `ThreeCanvas.tsx` | 45 KB | 拆分为 `SceneSetup`, `ElementRenderer`, `DeformationOverlay` |
| `ResultsPanel.tsx` | 40 KB | 拆分为 `SummaryCard`, `ElementTable`, `DetailModal` |

### 6.2 引入 pydantic 做输入验证

当前用手写 JSON Schema 校验，`pydantic` 可同时完成类型验证和序列化。

### 6.3 CI/CD 增加覆盖率门槛

```yaml
# .github/workflows/ci.yml
- name: Test with coverage
  run: pytest --cov=servers --cov-report=xml --cov-fail-under=60
```

---

## 7. 可借鉴的国际专业手册

### 7.1 软件工程

| 手册/著作 | 关键借鉴 |
|-----------|---------|
| **"Clean Architecture"** — Robert C. Martin | 依赖倒置原则：当前 Hub 已做到，但 `_generate_calc_processes` 应拆分 |
| **"Domain-Driven Design"** — Eric Evans | 领域建模：将 `CodeChecker`、`LoadGenerator`、`FEASolver` 作为领域实体建模 |
| **"Building Evolutionary Architectures"** — Ford/Parsons/Kua | 适应变化的架构：当前 `@tool` 契约已做到，建议增加 fitness functions 做持续验证 |
| **"Architecture Patterns with Python"** — Percival/Gregory | Unit of Work / Repository 模式：用于截面数据库和数据管道 |
| **"Effective Python" (2nd Ed)** — Brett Slatkin | Dataclasses、Contextlib、结构化并发 |
| **"Robust Python"** — Patrick Viafore | 类型系统充分利用：`Protocol`, `Literal`, `TypedDict`, `NewType` |
| **"Refactoring"** — Martin Fowler | 长方法拆分、重复代码消除、Feature Envy 处理 |

### 7.2 结构工程规范

| 规范 | 建议应用方向 |
|------|-------------|
| **GB50017-2017《钢结构设计标准》** | 第 6-8 章 + 附录 D/E/C — 稳定系数、计算长度、整体稳定系数 |
| **GB50009-2012《建筑结构荷载规范》** | 第 8 章 — 风荷载 μz、βz，第 5 章 — 活荷载折减 |
| **GB50011-2010《建筑抗震设计规范》** | 第 5.1-5.2 节 — 地震影响系数曲线、底部剪力法完整参数 |
| **GB/T 11263-2017《热轧 H 型钢》** | 附录 A — 完整截面几何特性数据库 |
| **AISC 360-22** (美国) | 设计规范抽象层的参考实现，使架构支持多国规范 |
| **EN 1993-1-1** (欧洲) | 同上，6 个截面分类曲线体系 |
| **ASCE 7-22** (美国荷载) | 荷载组合系数对照参考 |

### 7.3 专业软件参考

| 软件 | 可借鉴的设计模式 |
|------|-----------------|
| **OpenSees** (UC Berkeley) | 模块化求解器架构、Tcl/Python 双层接口 |
| **ETABS/SAP2000** (CSI) | 截面数据库管理、荷载组合自动生成 |
| **RFEM** (Dlubal) | 多规范插件架构、结果可视化报告 |
| **Oasys GSA** (Arup) | 计算引擎与 UI 分离、API-first 设计 |

---

## 8. 综合评分

| 维度 | 评分 | 说明 |
|------|:---:|------|
| **架构设计** | 8/10 | CAIAO 模式先进，Hub 解耦清晰。设计规范抽象层缺失。 |
| **计算正确性** | 5/10 | 稳定校核不完整，P0 三项问题直接影响工程可靠性。 |
| **代码可维护性** | 6/10 | Server 拆分合理，但 `_generate_calc_processes` 方法过长 (242 行 30+ 参数)。 |
| **错误处理** | 5/10 | 三种模式 (dict error / raise / None) 混用，需统一。 |
| **测试覆盖** | 4/10 | 仅 20 个用例，无 FEA 精度验证，无 Golden File 测试。 |
| **文档** | 7/10 | README 完善，docs/ 质量高。缺少 API 文档和 ADR。 |
| **安全性** | 5/10 | CORS 全开，API Key 明文传参，无速率限制。 |
| **前端体验** | 7/10 | Three.js 可视化效果好，组件偏大 (3 个 40KB+ 组件)。 |
| **日志与可观测性** | 3/10 | 全部 print()，无级别、无时间戳、无结构化。 |
| **综合** | **6.0/10** | 可用 Demo，完成 P0-P1 整改后可达 7.5/10 (生产级)。 |

### 各维度评分图

```
架构设计    ████████░░  8
计算正确性  █████░░░░░  5
可维护性    ██████░░░░  6
错误处理    █████░░░░░  5
测试覆盖    ████░░░░░░  4
文档        ███████░░░  7
安全性      █████░░░░░  5
前端体验    ███████░░░  7
可观测性    ███░░░░░░░  3
─────────────────────
综合        ██████░░░░  6.0
```

---

## 9. 改进路线图

### Phase 1 — 安全加固 (1-2 周)

```
□ P0-1: 实现 b/c 类稳定系数曲线
□ P0-2: 增加压弯构件平面内/外稳定校核
□ P0-3: 增加计算长度系数参数
□ P1-4: 统一错误处理为 {"error": "..."} 模式
□       增加数值回归测试 (简支梁、悬臂柱)
```

### Phase 2 — 可靠性提升 (2-4 周)

```
□ P1-1: 截面数据库外置 (GB/T 11263 全系列)
□ P1-2: 结构化日志 (structlog)
□ P1-3: Schema 命名统一 (I_yy / I_zz)
□ P1-4: 荷载参数完善 (场地类别、粗糙度、Tg)
□ P2-2: 设计规范 CodeChecker Protocol 定义
```

### Phase 3 — 规范化 (4-8 周)

```
□ P2-1: Web API 安全加固 (CORS / API Key header / rate limit)
□ P2-3: _generate_calc_processes 方法拆分
□ P2-4: 引入 pydantic 验证
□ P3-1: 前端大组件拆分
□ P3-2: CI/CD 覆盖率门槛 ≥60%
```

### Phase 4 — 扩展 (长期)

```
□ 支持 AISC 360-22 设计规范
□ 支持 EN 1993-1-1 设计规范
□ 非线性分析（P-Δ 效应）
□ 动力分析（振型分解反应谱法）
□ 结果数据库持久化 (SQLite/PostgreSQL)
□ 自动化优化设计 (截面优选)
```

---

> **审查人**：代码审查 Agent
> **审查日期**：2026-06-02
> **下次审查建议**：Phase 1 完成后重新审查，重点验证 P0 修复和数值精度
