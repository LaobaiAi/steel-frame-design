# Steel Frame Design 开发手册

## 1. 项目架构全景图

```
                         ┌────────────────────┐
                         │   CLI (main.py)     │
                         │  用户参数 → 全流程   │
                         └────────┬───────────┘
                                  │
                         ┌────────▼───────────┐
                         │  Pipeline Server    │  ← 合并 Server（纯编排）
                         │  run_full_pipeline  │
                         └────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
  ┌───────▼────────┐    ┌────────▼────────┐    ┌────────▼────────┐
  │  Generator     │    │  Load Generator  │    │  OpsRunner      │
  │  generate_frame│───▶│  apply_loads     │───▶│  run_analysis   │
  └────────────────┘    └─────────────────┘    └────────┬────────┘
                                                        │
                                          ┌─────────────▼────────────┐
                                          │  Code Check              │
                                          │  check_code (per element) │
                                          └─────────────┬────────────┘
                                                        │
                                          ┌─────────────▼────────────┐
                                          │  Report Generator        │
                                          │  generate_report → HTML  │
                                          └──────────────────────────┘

  数据流: JSON → JSON → JSON → JSON → JSON → HTML
```

每个原子 Server 都是黑盒：输入 JSON，输出 JSON，互不知晓对方的存在。

## 2. CAIAO Server 契约实现

### 2.1 基类设计（`servers/base.py`）

```python
class CAIAOServer:
    def list_tools(self) -> list[dict]:
        """返回工具列表，每个工具含 name, description, inputSchema"""

    def call_tool(self, tool_name: str, input_data: dict) -> dict:
        """执行工具，返回结果字典"""

    def run_stdio_loop(self):
        """stdio JSON 循环（为 MCP 预留）"""
```

### 2.2 工具注册（`@tool` 装饰器）

```python
@tool(
    name="generate_frame",
    description="根据网格参数生成钢框架结构模型",
    input_schema={...}
)
def generate_frame(self, input_data: dict) -> dict:
    ...
```

装饰器自动收集所有工具的元信息，`list_tools()` 返回时包含完整的 AI-ready 描述。

### 2.3 调用方式

```python
# 直接调用
result = server.call_tool("generate_frame", {...})

# 通过 CLI
python servers/steel_frame_generator.py generate_frame '{...}'

# 通过 stdio（将来 MCP）
echo '{"method":"call_tool","params":{...}}' | python servers/steel_frame_generator.py
```

## 3. 各 Server 设计详述

### 3.1 steel_frame_generator.py — 参数化建模

| 项目 | 内容 |
|------|------|
| **工具** | `generate_frame` |
| **输入** | 网格尺寸、层数、层高、截面选择 |
| **输出** | 符合 `model.schema.json` 的结构模型 |
| **核心算法** | 网格节点坐标计算、顺序编号、单元自动生成 |
| **截面库** | 7 种常用 H 型钢（HW/HM 系列），单位 m |

输入样例：
```json
{
  "grid_x": [6.0, 6.0, 6.0],
  "grid_y": [6.0, 6.0],
  "num_stories": 4,
  "story_heights": [4.0, 3.5, 3.5, 3.5]
}
```

输出样例：
```json
{
  "nodes": [{"id": 1, "x": 0, "y": 0, "z": 0}, ...],
  "elements": [{"id": 1, "node_i": 1, "node_j": 7, "section_id": "HW350x350x12x19", "type": "column"}, ...],
  "sections": [...],
  "materials": [...]
}
```

### 3.2 steel_load_generator.py — 荷载施加

| 项目 | 内容 |
|------|------|
| **工具** | `apply_loads` |
| **输入** | 模型 + 荷载参数 |
| **输出** | 带荷载工况和边界条件的模型 |
| **荷载类型** | 恒载、活载、风荷载（简化）、地震作用（底部剪力法） |

荷载转换策略：
- 楼面均布荷载 → 梁上线荷载（简化从属宽度 3m）
- 风荷载 → 各层迎风面 X 方向节点集中力
- 地震作用 → 底部剪力法，按高度分配至各层

### 3.3 opensees_runner.py — 有限元分析

| 项目 | 内容 |
|------|------|
| **工具** | `run_analysis` |
| **输入** | 带荷载模型 + 工况名 |
| **输出** | 位移和内力 |
| **算法** | 矩阵位移法（直接刚度法），3D 空间梁单元 |
| **每节点 DOF** | 6 (ux, uy, uz, rx, ry, rz) |
| **单元刚度** | 12×12 完整梁单元刚度矩阵 |
| **坐标变换** | 自动计算局部-全局坐标系旋转变换 |
| **求解** | np.linalg.solve，约束 DOF 消去法 |

### 3.4 steel_code_check.py — 规范校核

| 项目 | 内容 |
|------|------|
| **工具** | `check_code` |
| **输入** | 模型 + 分析结果 |
| **输出** | 构件校核结果 |
| **规范依据** | GB50017-2017 钢结构设计标准 |

校核项目：
1. **强度校核**：σ = N/A + My/Wx + Mz/Wy ≤ fy
2. **整体稳定性**：N/(φ·A·fy) ≤ 1.0，φ 按 a 类曲线
3. **挠度校核**：Δ ≤ L/250
4. **长细比校核**：λ ≤ 150

### 3.5 report_generator.py — 报告生成

| 项目 | 内容 |
|------|------|
| **工具** | `generate_report` |
| **输入** | 校核结果 + 模型元信息 |
| **输出** | HTML 报告文件路径 |
| **模板引擎** | Jinja2（降级方案：字符串拼接） |

### 3.6 steel_frame_pipeline.py — 全流程编排

"合并 Server" 模式。不包含任何计算逻辑，纯编排：

```python
model = generator.call_tool("generate_frame", ...)
loaded = loader.call_tool("apply_loads", ...)
for lc in loaded["load_cases"]:
    analysis.append(runner.call_tool("run_analysis", ...))
check = checker.call_tool("check_code", ...)
report = reporter.call_tool("generate_report", ...)
```

## 4. 数据 Schema 设计原则

1. **自描述**：Schema 包含充分的 description，使 AI 能无歧义理解
2. **最小完备**：只包含必要字段，不冗余
3. **可扩展**：未强制 `additionalProperties: false`，允许附加信息
4. **类型严格**：物理量使用 number，索引使用 integer

## 5. CAIAO Server 生态铺垫

### 5.1 独立性保证
- 每个 Server 为独立 `.py` 文件
- 零运行时依赖（不 import 其他 Server）
- 可独立启动和测试

### 5.2 MCP 迁移路径
- 当前：进程内直接调用（Pipeline import 方式）
- 迁移：将 `run_stdio_loop()` 改为 MCP SDK 的 stdio transport
- 成本：零，接口已对齐（`list_tools` / `call_tool`）

### 5.3 接入共享平台
需要增补的内容：
- Server 注册清单（工具列表的标准化描述）
- 版本管理（每个 Server 独立版本号）
- 认证/授权层（CAIAO Hub 级别）
- 健康检查接口

## 6. 难点与解决方案

| 难点 | 解决方案 |
|------|----------|
| OpenSeesPy 不可用 | 实现自研矩阵位移法，3D 梁单元刚度矩阵 |
| 坐标变换复杂 | 自动确定局部坐标系，x'沿杆轴，z'尽量竖直 |
| 荷载等效不精确 | 简化从属面积法，满足演示精度 |
| 稳定系数公式 | 采用 a 类曲线标准公式实现 |

## 7. 后续扩展建议

- [ ] 增加 OpenSeesPy 后端（切换 `opensees_runner.py` 实现）
- [ ] 非线性分析（P-Δ 效应）
- [ ] 更多规范支持（AISC、Eurocode）
- [ ] 截面优化（基于校核结果自动调整截面）
- [ ] Web 展示界面
- [ ] 正式 MCP stdio transport 集成
