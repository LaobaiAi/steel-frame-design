<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/XuanwuAI-0891b2?style=for-the-badge">
    <img alt="XuanwuAI" src="https://img.shields.io/badge/XuanwuAI-0e7490?style=for-the-badge">
  </picture>
</p>

<h1 align="center">XuanwuAI Steel Frame Design</h1>

<p align="center">
  <b>AI 驱动的参数化钢框架设计全流程管线</b><br/>
  YAML / LLM 提示 → 框架生成 → 荷载施加 → 有限元分析 → GB50017 规范验算 → 报告 → 3D 可视化
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-blue?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/GB50017-compliant-red" alt="GB50017">
  <img src="https://img.shields.io/badge/CAIAO-Server%20Native-orange" alt="CAIAO">
  <img src="https://img.shields.io/badge/docker-ready-2496ED?logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/CI-passing-brightgreen?logo=githubactions" alt="CI">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

<p align="center">
  <a href="https://codespaces.new/LaobaiAi/steel-frame-design">
    <img src="https://img.shields.io/badge/🚀%20从这里开始-在线运行-1f8838?style=for-the-badge&logo=github" alt="Open in Codespaces">
  </a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#核心特性">特性</a> ·
  <a href="#演示">演示</a> ·
  <a href="#架构">架构</a> ·
  <a href="https://laobaiai.github.io/steel-frame-design/">官网</a> ·
  <a href="./README.md">English</a>
</p>

<p align="center">
  <img src="docs/assets/screenshot-hero.png" alt="XuanwuAI Steel Frame Design" width="85%" style="border-radius: 8px; border: 1px solid #30363d;">
</p>

---

## 立即体验

| 方式 | 怎么做 |
|---|---|
| **☁️ 在线体验**（推荐） | 点击上方绿色按钮 → 等 1 分钟 → 浏览器自动打开 |
| **🐳 Docker** | `docker compose up` → 打开 http://localhost:8000 |
| **⌨️ CLI** | `python cli/main.py run --quick` |

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

Steel Frame Design 是一个**CAIAO 原子 Server 管线**，用于自动化钢结构设计。从 **[StructureClaw](https://github.com/structureclaw/structureclaw)** 蒸馏而来，构建于 **[CAIAO Server 架构](https://github.com/LaobaiAi/Demolition-Simulator)** 之上，支持三种交互模式：

- **Engineering 模式** — 一个 YAML 参数文件即可驱动完整工作流：参数化框架生成、荷载施加、有限元分析、GB50017 规范验算、HTML 报告生成和 3D 可视化导出
- **LLM 参数提取模式** — 用自然语言描述设计需求，LLM 提取结构化参数后自动执行工程管线
- **LLM Agent 模式** — LLM Agent 通过 Hub 自主规划并执行整个工作流，实时报告进度

管线中的每一步都是一个独立的、可复用的、LLM 可调用的原子 Server。本项目产出了结构工程领域首批 CAIAO 原子 Server，为未来集成到 CAIAO Hub 和 MCP 生态奠定了标准化基础。

```bash
python cli/main.py run --quick   # 一条命令，端到端
```

---

## 演示

| CLI 一行命令管线 | Web UI 3D 查看器 |
|---|---|
| ![CLI 演示](docs/assets/demo-cli.png) | ![3D 查看器](docs/assets/screenshot-3d-viewer.png) |

| 步骤引导流程 | 荷载可视化 |
|---|---|
| ![流程引导](docs/assets/screenshot-storyboard.png) | ![荷载展示](docs/assets/screenshot-loads.png) |

---

## 架构

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│              │    │              │    │              │    │              │    │              │    │              │
│   框架生成    │───▶│   荷载生成    │───▶│   有限元分析  │───▶│   规范验算    │───▶│   报告生成    │───▶│  3D 导出     │
│   Frame Gen  │    │   Load Gen   │    │   FEA        │    │   GB50017     │    │   Report Gen │    │  Three.js    │
│              │    │              │    │              │    │              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼                   ▼
   model.json       loaded_model.json    analysis_result.json   check_result.json     report.html       three_d_data.json

                      ┌───────────────────────────────────────────────────────────────────┐
                      │                        CAIAO Hub                                  │
                      │    Server 注册、工具路由、子进程隔离                                  │
                      └───────────────────────────────────────────────────────────────────┘
                                  ↕                        ↕                        ↕
                      ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
                      │  Web API     │          │  CLI           │          │  LLM Agent    │
                      │  (FastAPI)   │          │  Orchestrator  │          │  Gateway      │
                      └──────────────┘          └──────────────┘          └──────────────┘
                            ↕
                      ┌──────────────┐
                      │  前端         │
                      │  React+Vite   │
                      │  3D 查看器     │
                      └──────────────┘
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
| **语言** | Python 3.10+ / TypeScript（前端） |
| **FEA 引擎** | 矩阵位移法（内置）/ OpenSeesPy（可选） |
| **数值计算** | NumPy |
| **报告** | Jinja2（含字符串构建器降级方案） |
| **配置** | PyYAML |
| **Web API** | FastAPI + Uvicorn |
| **前端** | React 19 + Vite + TypeScript + TailwindCSS |
| **3D 可视化** | Three.js（React Three Fiber） |
| **终端 UI** | Rich |
| **契约校验** | jsonschema |
| **架构** | CAIAO Atomic Server + CAIAO Hub |

---

## 核心特性

### 工作流
- **三种交互模式** — YAML 驱动的 engineering 模式、LLM 参数提取模式、LLM Agent 全自动设计模式
- **自动荷载推导** — 恒载、活载、风载和地震荷载自动转换为单元/节点力
- **矩阵位移法** — 内置 3D 梁单元刚度求解器，零编译
- **GB50017 规范验算** — 逐单元强度、稳定性、长细比和挠度校验
- **HTML 报告** — Jinja2 渲染的报告，含模型概览、验算汇总表和关键指标
- **3D 可视化导出** — Three.js 兼容 JSON 格式，支持变形叠加和应力比颜色映射

### 工程能力
- **40 种内置 H 型钢** — 20 种 HW（宽翼缘）+ 20 种 HM（中翼缘），GB/T 11263
- **4 种材料牌号** — Q235、Q355、Q390、Q420，含完整力学性能
- **简化等效荷载** — 楼面均布荷载 → 梁线荷载（按从属面积法）
- **底部剪力法** — 按简化规范条款计算地震作用
- **稳定系数** — 按 GB50017 a 类曲线公式
- **荷载组合** — 5 种 GB50017 组合（1.3D+1.5L、1.3D+1.5W、1.3D+1.5L+0.9W、1.3D+1.3S、1.0D+1.5W）

### Web UI

| Web UI | |
|---|---|
| **八步引导流程** — 从参数设定到结果查看的引导式设计流<br/>**3D 模型查看器** — 交互式 Three.js 查看器，支持轨道控制、构件选取、变形切换<br/>**应力比颜色映射** — 连续绿→黄→红渐变，直观反映各构件利用率<br/>**深色主题** — 全暗色 UI，TailwindCSS 实现 | ![3D 查看器](docs/assets/screenshot-3d-viewer.png) |

### AI 就绪
- **LLM 可调用 Server** — 完整的 `@tool` 元数据，含描述和 Schema
- **Stdio-Loop 就绪** — 每个 Server 含 `run_stdio_loop()`，可升级 MCP
- **Schema 校验 I/O** — 每个 Server 间接口均由 jsonschema 强制约束

---

## 快速开始

### 前置条件

- Python 3.10+
- pip
- Node.js 18+（前端需要）

### 安装

```bash
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### 运行 — CLI

```bash
# 快速演示：4 层办公楼，3×2 跨，Q355 钢
python cli/main.py run --quick

# 自定义参数
python cli/main.py run --input examples/sample.yaml --output-dir ./my_results

# LLM 参数提取：用自然语言描述
python cli/main.py run --mode llm-param --prompt "设计一个三层办公楼，每层4米高，6米跨度" --api-key sk-xxx

# LLM Agent：全自动设计，实时进度反馈
python cli/main.py run --mode llm-agent --prompt "设计一个三层钢框架..." --api-key sk-xxx

# 查看输出
ls output/          # model.json, loaded_model.json, check_results.json, report.html, three_d_data.json
```

### 运行 — Web UI（前端 + API）

```bash
# 终端 1：启动 FastAPI 后端
python servers/web_api_server.py

# 终端 2：启动前端开发服务器
cd frontend && npm run dev
```

然后在浏览器中打开 http://localhost:3000。

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
column_section: HW350x350x12x19    # 柱截面（20 种 HW 可选）
beam_section: HM340x250x9x14       # 梁截面（20 种 HM 可选）
material: Q355                     # 钢材牌号：Q235 / Q355 / Q390 / Q420
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
├── caiao_hub.py                       # CAIAO Hub — Server 注册与工具路由
├── servers/                           # CAIAO 原子 Server
│   ├── base.py                        # Server 基类 + @tool 装饰器
│   ├── steel_frame_generator.py       # 参数化框架建模
│   ├── steel_load_generator.py        # 荷载与边界条件施加
│   ├── opensees_runner.py             # 有限元分析（矩阵位移法）
│   ├── steel_code_check.py            # GB50017 规范验算
│   ├── report_generator.py            # HTML 报告生成
│   ├── three_d_exporter.py            # 3D 可视化数据导出（Three.js）
│   ├── steel_frame_pipeline.py        # 全流程编排器（合并 Server）
│   ├── web_api_server.py              # FastAPI Web API（合并 Server）
│   ├── cli_orchestrator.py            # CLI 编排器（合并 Server）
│   ├── llm_param_extractor.py         # LLM 自然语言 → 结构化参数
│   ├── llm_agent_orchestrator.py      # LLM Agent 自主工作流
│   ├── llm_gateway.py                 # LLM API 网关（兼容 OpenAI）
│   └── defaults.py                    # 共享默认值：截面、材料、颜色
├── cli/
│   └── main.py                        # CLI 入口（3 种模式）
├── frontend/                          # React + Vite + TypeScript 前端
│   ├── src/                           # 组件、页面、Hooks
│   ├── tests/                         # 前端测试
│   ├── index.html                     # 入口 HTML
│   ├── vite.config.ts                 # Vite 配置（API 代理到 :8000）
│   └── package.json
├── schemas/                           # JSON Schema 定义
│   ├── model.schema.json
│   ├── load.schema.json
│   ├── analysis_result.schema.json
│   ├── code_check_result.schema.json
│   └── three_d_data.schema.json
├── templates/                         # Jinja2 报告模板
├── examples/                          # 示例参数文件
├── tests/                             # 单元 & 集成测试
├── docs/                              # 快速启动、开发手册、蒸馏指南、LLM 集成
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
| 三维弹性矩阵位移分析 | ✅ 已完成 |
| GB50017 强度与稳定性验算 | ✅ 已完成 |
| 5 种 GB50017 荷载组合 | ✅ 已完成 |
| CLI 一键命令 + 3 种模式（engineering / llm-param / llm-agent） | ✅ 已完成 |
| HTML 报告生成 | ✅ 已完成 |
| 3D 可视化导出（Three.js） | ✅ 已完成 |
| CAIAO Hub — Server 注册与子进程隔离 | ✅ 已完成 |
| Web API（FastAPI）— REST + SSE 流式 | ✅ 已完成 |
| Web 前端 — React + Vite + TailwindCSS | ✅ 已完成 |
| 40 种内置 H 型钢（20 HW + 20 HM） | ✅ 已完成 |
| 4 种材料牌号（Q235 / Q355 / Q390 / Q420） | ✅ 已完成 |
| LLM 参数提取（自然语言 → YAML） | ✅ 已完成 |
| LLM Agent 自主工作流 | ✅ 已完成 |
| OpenSeesPy 非线性集成 | 🔜 计划中 |
| 不规则框架拓扑支持 | 🔜 计划中 |
| MCP (stdio JSON-RPC) 协议升级 | 🔜 计划中 |

---

## 文档

| 文档 | 说明 |
|------|------|
| [快速启动](docs/quickstart.md) | 快速启动指南 — 后端、前端、CLI 三种模式 |
| [DEVELOPMENT_MANUAL.md](docs/DEVELOPMENT_MANUAL.md) | 完整技术手册 — 架构、Server 设计细节、I/O 示例 |
| [独立 Server 开发手册](docs/CAIAO_INDEPENDENT_SERVER_DEVELOPMENT_MANUAL.md) | 在本项目外开发独立 CAIAO Server 的指南 |
| [CAIAO_DISTILLATION_GUIDE.md](docs/CAIAO_DISTILLATION_GUIDE.md) | 蒸馏方法论 — 如何将领域技能提取为 CAIAO Server |
| [LLM_INTEGRATION.md](docs/LLM_INTEGRATION.md) | LLM 集成指南 — 参数提取与 Agent 模式 |

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
