<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/XuanwuAI-0891b2?style=for-the-badge">
    <img alt="XuanwuAI" src="https://img.shields.io/badge/XuanwuAI-0e7490?style=for-the-badge">
  </picture>
</p>

<h1 align="center">XuanwuAI Steel Frame Design</h1>

<p align="center">
  <b>AI 驱动的参数化钢框架设计全流程管线</b><br/>
  YAML → 框架生成 → 荷载施加 → 有限元分析 → GB50017 规范验算 → 报告
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-blue?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/numpy-numeric-013243?logo=numpy&logoColor=white" alt="NumPy">
  <img src="https://img.shields.io/badge/GB50017-compliant-red" alt="GB50017">
  <img src="https://img.shields.io/badge/CAIAO-Server%20Native-orange" alt="CAIAO">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#核心特性">为什么</a> ·
  <a href="#架构">架构</a> ·
  <a href="#项目结构">结构</a> ·
  <a href="#文档">文档</a> ·
  <a href="#贡献">贡献</a> ·
  <a href="./README.md">English</a>
</p>

---

## 玄武 · 品牌哲学

渊默之算 · Abyssal Computation

> **智算万物，稳驭天地。**

**玄武**，中国神话中的北方之神，是**龟与蛇**的神圣合体 — *极致稳定*与*灵活智能*的完美化身。

| 象征 | 含义 | 在 XuanwuAI 中 |
|------|------|----------------|
| 🛡️ **龟**（护盾） | 绝对防御、秩序与不可动摇的基础 | 坚如磐石的物理引擎内核和精确规则系统，为每次模拟提供锚点 |
| 🐍 **蛇**（Python） | 灵动、智慧与精准执行 | 高层 AI 算法，在复杂环境中自主规划、适应并制定最优策略 |

XuanwuAI 属于**四象 AI**家族，每个成员象征一种核心美德：

| 神祇 | 元素 | 美德 | 领域 |
|------|------|------|------|
| **QinglongAI** 青龙 | 木 | 创生之智 · Generative Creation | 生成式 AI，创造智能 |
| **ZhuqueAI** 朱雀 | 火 | 燎原之火 · Connective Flame | 智能交互，人机体验 |
| **BaihuAI** 白虎 | 金 | 肃金之盾 · Purifying Shield | AI 原生安全，对抗防御 |
| **XuanwuAI** 玄武 | 水 | **渊默之算 · Abyssal Computation** | 复杂仿真，策略决策 |

> 玄武对应**水**— 深邃、智慧，以及在数字世界中映射现实的力量。作为四象之基，它为创生、连接和防御提供计算基石。

---

## XuanwuAI Steel Frame Design 是什么？

Steel Frame Design 是一个**CAIAO 原子 Server 管线**，用于自动化钢结构设计。从 **[StructureClaw](https://github.com/structureclaw/structureclaw)** 蒸馏而来，构建于 **[CAIAO Server 架构](https://github.com/LaobaiAi/Demolition-Simulator)** 之上，只需一个 YAML 参数文件即可运行完整的结构工程工作流 — 参数化框架生成、荷载施加、有限元分析、GB50017 规范验算和 HTML 报告生成 — 零 GUI 依赖。

管线中的每一步都是一个独立的、可复用的、LLM 可调用的原子 Server。本项目产出了结构工程领域首批 CAIAO 原子 Server，为未来集成到 CAIAO Hub 和 MCP 生态奠定了标准化基础。

```bash
python cli/main.py run --quick   # 一条命令，端到端
```

---

## 架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│              │    │              │    │              │    │              │    │              │
│   框架生成    │───▶│   荷载生成    │───▶│   有限元分析  │───▶│   规范验算    │───▶│   报告生成    │
│   Frame Gen  │    │   Load Gen   │    │   FEA        │    │   GB50017     │    │   Report Gen │
│              │    │              │    │              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼
   model.json       loaded_model.json    analysis_result.json   check_result.json     report.html
```

### CAIAO 协议

每个求解器和分析工具都以独立 CAIAO Server 运行，通过 `list_tools()` / `call_tool(name, input)` 轻量契约通信，I/O 严格经 JSON Schema 校验。Pipeline Server（合并器）按顺序编排原子 Server — 本身不含任何领域逻辑。

此架构确保**隔离性**（一个崩溃不会级联）、**语言无关性**（任何支持 stdio 的语言都可成为 CAIAO Server）、以及**即插即用扩展性**（添加新规范只需写一个文件）。

| 原则 | 含义 |
|------|------|
| **原子性** | 单一职责 — 每个 Server 只做一件事 |
| **契约驱动** | 统一 `list_tools()` / `call_tool()` 接口，JSON Schema 校验 |
| **合并而非修改** | Pipeline Server 仅编排，不嵌入领域逻辑 |
| **AI 原生** | 工具描述和 Schema 完整 — LLM Agent 可直接调用 |

### 技术栈

| 层级 | 技术 |
|------|------|
| **语言** | Python 3.10+ |
| **FEA 引擎** | 矩阵位移法（内置）/ OpenSeesPy（可选） |
| **数值计算** | NumPy |
| **报告** | Jinja2（含字符串构建器降级方案） |
| **配置** | PyYAML |
| **终端 UI** | Rich |
| **契约校验** | jsonschema |
| **架构** | CAIAO Atomic Server |

---

## 核心特性

### 工作流
- **一个 YAML，一条命令** — 在单个 YAML 文件中输入网格尺寸、层数、荷载和截面
- **自动荷载推导** — 恒载、活载、风载和地震荷载自动转换为单元/节点力
- **矩阵位移法** — 内置 3D 梁单元刚度求解器，零编译
- **GB50017 规范验算** — 逐单元强度、稳定性、长细比和挠度校验
- **HTML 报告** — Jinja2 渲染的报告，含模型概览、验算汇总表和关键指标

### 工程能力
- **7 种内置 H 型钢** — GB/T 11263 的 HW/HM 系列
- **材料牌号** — Q235、Q355 及完整力学性能
- **简化等效荷载** — 楼面均布荷载 → 梁线荷载（按从属面积法）
- **底部剪力法** — 按简化规范条款计算地震作用
- **稳定系数** — 按 GB50017 a 类曲线公式

### AI 就绪
- **LLM 可调用 Server** — 完整的 `@tool` 元数据，含描述和 Schema
- **Stdio-Loop 就绪** — 每个 Server 含 `run_stdio_loop()`，可升级 MCP
- **Schema 校验 I/O** — 每个 Server 间接口均由 jsonschema 强制约束

---

## 快速开始

### 前置条件

- Python 3.10+
- pip

### 安装

```bash
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design
pip install -r requirements.txt
```

### 运行

```bash
# 快速演示：4 层办公楼，3×2 跨，Q355 钢
python cli/main.py run --quick

# 自定义参数
python cli/main.py run --input examples/sample.yaml --output-dir ./my_results

# 查看输出
ls output/          # model.json, loaded_model.json, check_results.json, report.html
```

### 直接调用单个 Server

```bash
python servers/steel_frame_generator.py generate_frame \
  '{"grid_x":[6,6,6],"grid_y":[6,6],"num_stories":4,"story_heights":[4,3.5,3.5,3.5]}'
```

### 输入参数

```yaml
# examples/sample.yaml
grid_x: [6.0, 6.0, 6.0]           # X 向跨度 (m)
grid_y: [6.0, 6.0]                 # Y 向跨度 (m)
num_stories: 4                     # 层数
story_heights: [4.0, 3.5, 3.5, 3.5]  # 层高 (m)
column_section: HW350x350x12x19    # 柱截面
beam_section: HM340x250x9x14       # 梁截面
material: Q355                     # 钢材牌号 (Q235 / Q355 / Q460)
name: Sample Office Building       # 项目名称
dead_load: 2.0                     # 恒载 (kN/m²)
live_load: 3.0                     # 活载 (kN/m²)
wind_pressure: 0.45                # 基本风压 (kN/m²)
seismic_intensity: 0.08            # 地震影响系数
```

---

## 项目结构

```
steel-frame-design/
├── servers/                           # CAIAO 原子 Server
│   ├── base.py                        # Server 基类 + @tool 装饰器
│   ├── steel_frame_generator.py       # 参数化框架建模
│   ├── steel_load_generator.py        # 荷载与边界条件施加
│   ├── opensees_runner.py             # 有限元分析（矩阵位移法）
│   ├── steel_code_check.py            # GB50017 规范验算
│   ├── report_generator.py            # HTML 报告生成
│   └── steel_frame_pipeline.py        # 全流程编排器（合并 Server）
├── cli/
│   └── main.py                        # CLI 入口
├── schemas/                           # JSON Schema 定义
│   ├── model.schema.json
│   ├── load.schema.json
│   ├── analysis_result.schema.json
│   └── code_check_result.schema.json
├── templates/                         # Jinja2 报告模板
├── examples/                          # 示例参数文件
├── tests/                             # 单元 & 集成测试
├── docs/                              # 决策日志、开发手册、蒸馏指南
└── output/                            # 运行时输出（已 gitignore）
```

---

## 测试

```bash
# 运行所有测试
python tests/test_servers.py

# 端到端集成测试
python cli/main.py run --quick && python tests/test_servers.py
```

---

## 功能状态

| 功能 | 状态 |
|------|------|
| 参数化规则框架建模 | ✅ 已完成 |
| 恒载 / 活载 / 风载 / 地震荷载生成 | ✅ 已完成 |
| 二维弹性矩阵位移分析 | ✅ 已完成 |
| GB50017 强度与稳定性验算 | ✅ 已完成 |
| CLI 一键命令 + HTML 报告 | ✅ 已完成 |
| OpenSeesPy 非线性集成 | 🔜 计划中 |
| 不规则框架拓扑支持 | 🔜 计划中 |
| MCP (stdio JSON-RPC) 协议升级 | 🔜 计划中 |
| Web 仪表盘可视化 | 🔜 计划中 |

---

## 文档

| 文档 | 说明 |
|------|------|
| [DEVELOPMENT_MANUAL.md](docs/DEVELOPMENT_MANUAL.md) | 完整技术手册 — 架构、Server 设计细节、I/O 示例 |
| [CAIAO_DISTILLATION_GUIDE.md](docs/CAIAO_DISTILLATION_GUIDE.md) | 蒸馏方法论 — 如何将领域技能提取为 CAIAO Server |

---

## 相关资源

- [StructureClaw](https://github.com/structureclaw/structureclaw) — 结构工程能力蒸馏来源
- [Demolition-Simulator (CAIAO)](https://github.com/LaobaiAi/Demolition-Simulator) — CAIAO Server 生态与应用平台
- [OpenSeesPy 文档](https://openseespydoc.readthedocs.io/)

---

## 贡献

欢迎贡献！无论是新功能、Bug 修复还是文档改进：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 发起 Pull Request

---

## 许可证

MIT License © 2026
