# Steel Frame Design 开发手册

> **版本**: v2.0 — CAIAO Standard
> **最后更新**: 2026-05-25

---

## 0. v2.0 升级概要（全 CAIAO 化）

v2.0 完成了从"CAIAO 使用者"到"CAIAO 标准参考实现"的架构升级。

### 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| **CAIAO Hub** | `caiao_hub.py` | 轻量调度中心：自动发现、工具注册、路由代理 |
| **3D 导出器** | `servers/three_d_exporter.py` | 将模型导出为 Three.js 可渲染的 3D JSON |
| **LLM 参数提取器** | `servers/llm_param_extractor.py` | 自然语言 → 设计参数 YAML |
| **LLM Agent 循环** | `servers/llm_agent_loop.py` | ReAct 循环：LLM 自主发现工具并编排全流程 |
| **CLI 编排器** | `servers/cli_orchestrator.py` | 三种模式统一入口 (engineering/llm-param/llm-agent) |
| **前端 3D 可视化** | `frontend/` | Three.js 钢框架 3D 查看器 |
| **CAIAO 规范** | `specs/CAIAO_SERVER_V1.md` | Server 标准契约文档 |
| **3D 数据 Schema** | `schemas/three_d_data.schema.json` | 3D 数据接口格式 |

### 架构变化

```
v1.0 (直接 import)              v2.0 (Hub 调度)
┌────────────┐                  ┌────────────┐
│   CLI      │                  │   CLI      │
│   main.py  │                  │   main.py  │
└─────┬──────┘                  └─────┬──────┘
      │                               │
┌─────▼──────┐                  ┌─────▼──────┐
│  Pipeline  │                  │ CliOrches- │
│  (import   │                  │  trator    │
│   各Server)│                  │  (Hub调度) │
└─┬──┬──┬──┬─┘                  └─────┬──────┘
  │  │  │  │                          │
  ▼  ▼  ▼  ▼                    ┌─────▼──────┐
 Gen Load Run Check              │ CAIAO Hub  │
                                 │ find/call  │
                                 └─┬──┬──┬──┬─┘
                                   ▼  ▼  ▼  ▼
                                  Gen Load Run Check ...
```

**核心变化**: Server 间不再直接 import，所有调用通过 `Hub.call_tool()` 传递 JSON。

### 向后兼容

- `python cli/main.py run --quick` — 完全兼容，底层已升级为 Hub 调度
- `python cli/main.py run --input sample.yaml` — 完全兼容
- Pipeline 直接实例化仍可用（`SteelFramePipeline()` 不加 hub 参数时自动回退）

### 新增调用方式

```bash
# LLM 参数提取模式
python cli/main.py run --mode llm-param --prompt "设计一个三层钢框架..." --api-key sk-xxx

# LLM Agent 模式
python cli/main.py run --mode llm-agent --prompt "校核两层钢结构..." --api-key sk-xxx

# 3D 数据导出
python servers/three_d_exporter.py export_3d_model '{"model": {...}}'

# 前端 3D 查看
cd frontend && python -m http.server 8000
```

---

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

### 5.4 CAIAO 与 MCP 常见问答

#### Q1: CAIAO 和 MCP 有什么区别？为什么不直接做成 MCP Server？

CAIAO 和 MCP 是不同层面的概念：

```
┌─────────────────────────────────┐
│    AI 助手 (Claude Desktop 等)   │  ← 说 MCP "语言"
├─────────────────────────────────┤
│    MCP 协议层 (stdio transport)  │  ← 标准通信协议（AI 世界通用）
├─────────────────────────────────┤
│    CAIAO Server                 │  ← 你的内部架构
│    (list_tools / call_tool)     │     统一接口、自动注册、CLI 调试
└─────────────────────────────────┘
```

- **MCP (Model Context Protocol)** = 行业标准协议，是 AI 客户端和工具服务器之间公认的通信"语言"。类比 HTTP 之于浏览器。
- **CAIAO Server** = 本项目的内部工具框架，提供 `@tool` 装饰器自动注册、`list_tools()`/`call_tool()` 统一接口、`run_cli()` 调试入口。这些能力**现在就在被 Pipeline 和 CLI 使用**，不依赖 MCP。

如果一开始就绑 MCP SDK：
- Pipeline 中编排 5 个 Server 需要启动子进程、走 stdio JSON-RPC → 过度工程
- CLI 调试无法直接 `import` 调用 → 每次都要起子进程
- 引入 MCP SDK 依赖，但当前完全用不到 AI 调用

CAIAO 并非"多做了一层"，而是**你现在实际依赖的统一框架**，MCP 只是将来会追加的一种访问入口。

#### Q2: `run_stdio_loop()` 那 128 行是必要的吗？

本质是**协议质检垫脚石**。那 128 行手写 JSON-RPC 循环让你今天就能：
- 手工通过 stdin/stdout 单独测试每个 Server
- 验证 `list_tools()` 返回格式、`call_tool()` 参数传递是否与 MCP 协议对齐

将来升级到 MCP SDK 时，这 128 行被 SDK 的 `stdio_server()` 替代（约 10 行），但 5 个 Server 的业务逻辑一个字不改。对比：

```python
# 现在 — 手工质检（128行）
for line in sys.stdin:
    request = json.loads(line)
    if method == "list_tools":
        response = server.list_tools()
    elif method == "call_tool":
        response = server.call_tool(...)
    print(json.dumps(response))

# 将来 — MCP SDK 接管（~10行）
@mcp_server.list_tools()
async def list_tools():
    return [Tool(**t) for t in caiao_server.list_tools()]

@mcp_server.call_tool()
async def call_tool(name, arguments):
    result = caiao_server.call_tool(name, arguments)
    return [TextContent(type="text", text=json.dumps(result))]

asyncio.run(stdio_server(mcp_server))
```

**质检通过 → 换标准件 → 直接用，业务逻辑不碰。**

#### Q3: 将来整合到 MCP 要改多少代码？

只改每个 Server 文件底部的 `__main__` 块（把 128 行手写循环换成 MCP SDK 的 `stdio_server()`），其余全部不变：

| 组件 | 改动 |
|------|------|
| 5 个业务 Server 的业务逻辑 | **0 行** |
| `@tool` 装饰器 | **0 行** |
| `CAIAOServer.list_tools()` | **0 行** |
| `CAIAOServer.call_tool()` | **0 行** |
| Pipeline 编排代码 | **0 行** |
| CLI 入口 | **0 行** |
| `run_stdio_loop()` 手写循环 | **交换为 MCP SDK transport** |

因为 `list_tools()` 输出格式与 MCP `tools/list` 兼容，`call_tool()` 语义与 MCP `tools/call` 一致——接口已在 CAIAO 设计阶段就对齐了 MCP 标准。

#### Q4: 什么时候才真的需要 MCP？

**当 AI 助手需要直接调用你的工具时。** 当前主要使用场景是：
- CLI 批量运行：`python cli/main.py run --input sample.yaml`
- Pipeline 进程内编排：`self._checker.call_tool("check_code", data)`

这两种场景完全不需要 MCP 协议。MCP 的唯一价值在于：让外部 AI 客户端（如 Claude Desktop、CodeBuddy）通过标准协议发现并调用你的 `check_code`、`run_analysis` 等工具。

当需要 AI 调用时，在 AI 客户端配置中添加一行：
```json
{
  "mcpServers": {
    "steel-code-check": {
      "command": "python",
      "args": ["servers/steel_code_check.py"]
    }
  }
}
```

然后 AI 就能自动发现所有 `@tool` 注册的工具并调用它们。

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
