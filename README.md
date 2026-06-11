<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/XuanwuAI-0891b2?style=for-the-badge">
    <img alt="XuanwuAI" src="https://img.shields.io/badge/XuanwuAI-0e7490?style=for-the-badge">
  </picture>
</p>

<h1 align="center">XuanwuAI Steel Frame Design</h1>

<p align="center">
  <b>AI-powered parametric steel frame design pipeline</b><br/>
  YAML / LLM Prompt → Frame Generation → Load Application → FEA → GB50017 Code Check → Report → 3D Visualization
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
  <a href="#quick-start">Quick Start</a> ·
  <a href="#key-features">Why</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="./README_CN.md">中文</a>
</p>

<p align="center">
  <img src="docs/assets/screenshot-hero.png" alt="XuanwuAI Steel Frame Design" width="85%" style="border-radius: 8px; border: 1px solid #30363d;">
</p>

---

## Try It Now

| 方式 | 怎么做 |
|---|---|
| **☁️ 在线体验**（推荐） | 点击上方绿色按钮 → 等 1 分钟 → 浏览器自动打开 |
| **🐳 Docker** | `docker compose up` → 打开 http://localhost:8000 |
| **⌨️ CLI** | `python cli/main.py run --quick` |

---

## Xuanwu · Brand Philosophy

*Abyssal Computation*

> **Wisdom computes all things; Stability governs heaven and earth.**

**Xuanwu**, the god of the North in Chinese mythology, is a divine hybrid of **tortoise and serpent** — the perfect embodiment of *ultimate stability* and *adaptive intelligence* in unity.

| Symbol | Meaning | In XuanwuAI |
|--------|---------|-------------|
| 🛡️ **Tortoise** (Aegis) | Absolute defense, order, and unshakable foundation | The rock-solid physics engine kernel and precise rule system that anchor every simulation |
| 🐍 **Serpent** (Python) | Agility, wisdom, and precise execution | The high-level AI algorithms that autonomously plan, adapt, and devise optimal strategies in complex environments |

XuanwuAI is part of the **Four Symbols AI** family, each embodying a cardinal virtue:

| Deity | Element | Virtue | Domain |
|-------|---------|--------|--------|
| **QinglongAI** | Wood | Generative Creation | Generative AI, creative intelligence |
| **ZhuqueAI** | Fire | Connective Flame | Intelligent interaction, human-AI experience |
| **BaihuAI** | Metal | Purifying Shield | AI-native security, adversarial defense |
| **XuanwuAI** | Water | **Abyssal Computation** | Complex simulation, strategic decision-making |

> Xuanwu corresponds to the **Water element** — depth, wisdom, and the power to mirror reality within digital worlds. As the foundation of the Four Symbols, it provides the computational bedrock upon which creation, connection, and defense are built.

---

## What is XuanwuAI Steel Frame Design?

Steel Frame Design is a **CAIAO-native atomic Server pipeline** for automated steel structure design. Distilled from **[StructureClaw](https://github.com/structureclaw/structureclaw)** and built atop the **[CAIAO Server architecture](https://github.com/LaobaiAi/Demolition-Simulator)**, it supports three interaction modes:

- **Engineering mode** — a single YAML parameter file drives the complete workflow: parametric frame generation, load application, finite element analysis, GB50017 code checking, HTML report generation, and 3D visualization export
- **LLM Param Extraction mode** — describe your design in natural language, let the LLM extract structured parameters, then run the full engineering pipeline
- **LLM Agent mode** — an LLM agent autonomously plans and executes the entire workflow through the Hub, with natural language progress reporting

Each step in the pipeline is an independent, reusable, LLM-callable atomic Server. This project produced the first batch of CAIAO atomic Servers for the structural engineering domain, laying standardized groundwork for future integration into the CAIAO Hub and MCP ecosystem.

```bash
python cli/main.py run --quick   # one command, end to end
```

---

## Demo

| CLI One-Command Pipeline | Web UI 3D Viewer |
|---|---|
| ![CLI Demo](docs/assets/demo-cli.png) | ![3D Viewer](docs/assets/screenshot-3d-viewer.png) |

| Storyboard Design Flow | Load Visualization |
|---|---|
| ![Storyboard](docs/assets/screenshot-storyboard.png) | ![Loads](docs/assets/screenshot-loads.png) |

---

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│              │    │              │    │              │    │              │    │              │    │              │
│   Frame      │───▶│   Load       │───▶│   FEA        │───▶│   Code Check  │───▶│   Report     │───▶│   3D Export   │
│   Generator  │    │   Generator  │    │   Runner     │    │   GB50017     │    │   Generator  │    │   (Three.js)  │
│              │    │              │    │              │    │              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼                   ▼
   model.json       loaded_model.json    analysis_result.json   check_result.json     report.html       three_d_data.json

                      ┌───────────────────────────────────────────────────────────────────┐
                      │                        CAIAO Hub                                  │
                      │   Server registration, tool routing, subprocess isolation           │
                      └───────────────────────────────────────────────────────────────────┘
                                  ↕                        ↕                        ↕
                      ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
                      │  Web API     │          │  CLI          │          │  LLM Agent   │
                      │  (FastAPI)   │          │  Orchestrator │          │  Gateway     │
                      └──────────────┘          └──────────────┘          └──────────────┘
                            ↕
                      ┌──────────────┐
                      │  Frontend     │
                      │  React+Vite   │
                      │  3D Viewer    │
                      └──────────────┘
```

### CAIAO Protocol

Every solver and analysis tool runs as an independent CAIAO Server communicating via the `list_tools()` / `call_tool(name, input)` lightweight contract, with I/O strictly validated against JSON Schema. The Pipeline Server (merger) orchestrates atomic Servers sequentially — containing zero domain logic itself.

This architecture ensures **isolation** (one crash doesn't cascade), **language agnosticism** (any language with stdio can be a CAIAO Server), and **plug-and-play extensibility** (add a new code standard by writing one file).

| Principle | Meaning |
|-----------|---------|
| **Atomic** | Single responsibility — each Server does one thing |
| **Contract-driven** | Unified `list_tools()` / `call_tool()` interface, JSON Schema validated |
| **Merge, don't modify** | Pipeline Servers orchestrate only, never embed domain logic |
| **AI-native** | Tool descriptions and schemas are complete — LLM Agents call directly |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | Python 3.10+ / TypeScript (frontend) |
| **FEA Engine** | Matrix Displacement Method (built-in) / OpenSeesPy (optional) |
| **Numerical** | NumPy |
| **Reporting** | Jinja2 (with string-builder fallback) |
| **Config** | PyYAML |
| **Web API** | FastAPI + Uvicorn |
| **Frontend** | React 19 + Vite + TypeScript + TailwindCSS |
| **3D Visualization** | Three.js (via React Three Fiber) |
| **Terminal UI** | Rich |
| **Contract Validation** | jsonschema |
| **Architecture** | CAIAO Atomic Server + CAIAO Hub |

---

## Key Features

### Core Workflow
- **Three Interaction Modes** — YAML-driven engineering mode, LLM parameter extraction, and full LLM Agent autonomous design
- **Automatic Load Derivation** — Dead, live, wind, and seismic loads automatically converted to element/node forces
- **Matrix Displacement Method** — Built-in 3D beam-element stiffness solver, zero compilation required
- **GB50017 Code Check** — Per-element strength, stability, slenderness, and deflection verification
- **HTML Report** — Jinja2-rendered report with model overview, check summary table, and key metrics
- **3D Visualization Export** — Three.js-compatible JSON with deformation overlay and stress-ratio color mapping

### Engineering
- **40 Built-in H-Sections** — 20 HW (wide-flange) + 20 HM (medium-flange) from GB/T 11263
- **4 Material Grades** — Q235, Q355, Q390, Q420 with full mechanical properties
- **Simplified Equivalent Loads** — Floor uniform loads → beam line loads via tributary area method
- **Base Shear Method** — Seismic action per simplified code provisions
- **Stability Coefficients** — a-curve formula per GB50017
- **Load Combinations** — 5 GB50017 combinations (1.3D+1.5L, 1.3D+1.5W, 1.3D+1.5L+0.9W, 1.3D+1.3S, 1.0D+1.5W)

### Web UI

| Web UI | |
|---|---|
| **8-Step Storyboard** — Guided design flow from parameters through results<br/>**3D Model Viewer** — Interactive Three.js viewer with orbit controls, element selection, deformation toggle<br/>**Stress Ratio Color Mapping** — Green-to-red gradient reflecting utilization ratios<br/>**Dark Theme** — Full dark-mode UI with TailwindCSS | ![3D Viewer](docs/assets/screenshot-3d-viewer.png) |

### AI Readiness
- **LLM-Callable Servers** — Complete `@tool` metadata with descriptions and schemas
- **Stdio-Loop Ready** — Each Server has `run_stdio_loop()` for future MCP upgrade
- **Schema-Validated I/O** — Every inter-Server boundary enforced via jsonschema

---

## Quick Start

### Prerequisites

- Python 3.10+
- pip
- Node.js 18+ (for frontend)

### Install

```bash
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design
pip install -r requirements.txt
cd frontend && npm install && cd ..
```

### Run — CLI

```bash
# Quick demo: 4-story office building, 3×2 bays, Q355 steel
python cli/main.py run --quick

# Custom parameters
python cli/main.py run --input examples/sample.yaml --output-dir ./my_results

# LLM param extraction: describe in natural language
python cli/main.py run --mode llm-param --prompt "设计一个三层办公楼，每层4米高，6米跨度" --api-key sk-xxx

# LLM Agent: autonomous design with progress reporting
python cli/main.py run --mode llm-agent --prompt "设计一个三层钢框架..." --api-key sk-xxx

# Inspect outputs
ls output/          # model.json, loaded_model.json, check_results.json, report.html, three_d_data.json
```

### Run — Web UI (Frontend + API)

```bash
# Terminal 1: start the FastAPI backend
python servers/web_api_server.py

# Terminal 2: start the development frontend
cd frontend && npm run dev
```

Then open http://localhost:3000 in your browser.

### Call a Server Directly

```bash
python servers/steel_frame_generator.py generate_frame \
  '{"grid_x":[6,6,6],"grid_y":[6,6],"num_stories":4,"story_heights":[4,3.5,3.5,3.5]}'
```

### Input Parameters

```yaml
# examples/sample.yaml
grid_x: [6.0, 6.0, 6.0]           # X-direction bay widths (m)
grid_y: [6.0, 6.0]                 # Y-direction bay widths (m)
num_stories: 4                     # Number of stories
story_heights: [4.0, 3.5, 3.5, 3.5]  # Story heights (m)
column_section: HW350x350x12x19    # Column section (20 HW options)
beam_section: HM340x250x9x14       # Beam section (20 HM options)
material: Q355                     # Steel grade: Q235 / Q355 / Q390 / Q420
name: Sample Office Building       # Project name
dead_load: 2.0                     # Dead load (kN/m²)
live_load: 3.0                     # Live load (kN/m²)
wind_pressure: 0.45                # Basic wind pressure (kN/m²)
seismic_intensity: 0.08            # Seismic influence coefficient
```

---

## Project Structure

```
steel-frame-design/
├── caiao_hub.py                       # CAIAO Hub — Server registry & tool routing
├── servers/                           # CAIAO Atomic Servers
│   ├── base.py                        # Server base class + @tool decorator
│   ├── steel_frame_generator.py       # Parametric frame modeling
│   ├── steel_load_generator.py        # Load & boundary condition application
│   ├── opensees_runner.py             # FEA (Matrix Displacement Method)
│   ├── steel_code_check.py            # GB50017 code check
│   ├── report_generator.py            # HTML report generation
│   ├── three_d_exporter.py            # 3D visualization data export (Three.js)
│   ├── steel_frame_pipeline.py        # Full pipeline orchestrator (merge Server)
│   ├── web_api_server.py              # FastAPI Web API (merge Server)
│   ├── cli_orchestrator.py            # CLI orchestration (merge Server)
│   ├── llm_param_extractor.py         # LLM natural language → structured params
│   ├── llm_agent_orchestrator.py      # LLM Agent autonomous workflow
│   ├── llm_gateway.py                 # LLM API gateway (OpenAI-compatible)
│   └── defaults.py                    # Shared defaults: sections, materials, colors
├── cli/
│   └── main.py                        # CLI entry point (3 modes)
├── frontend/                          # React + Vite + TypeScript web UI
│   ├── src/                           # Components, pages, hooks
│   ├── tests/                         # Frontend tests
│   ├── index.html                     # Entry HTML
│   ├── vite.config.ts                 # Vite config (API proxy to :8000)
│   └── package.json
├── schemas/                           # JSON Schema definitions
│   ├── model.schema.json
│   ├── load.schema.json
│   ├── analysis_result.schema.json
│   ├── code_check_result.schema.json
│   └── three_d_data.schema.json
├── templates/                         # Jinja2 report template
├── examples/                          # Sample parameter files
├── tests/                             # Unit & integration tests
├── docs/                              # Quickstart, dev manual, distillation guide, LLM integration
└── output/                            # Runtime outputs (gitignored)
```

---

## Testing

```bash
# Run all tests
python tests/test_servers.py

# End-to-end integration test
python cli/main.py run --quick && python tests/test_servers.py
```

---

## Feature Status

| Feature | Status |
|---------|--------|
| Parametric regular frame modeling | ✅ Done |
| Dead / Live / Wind / Seismic load generation | ✅ Done |
| 3D elastic matrix displacement analysis | ✅ Done |
| GB50017 strength & stability check | ✅ Done |
| Load combinations (5 combos per GB50017) | ✅ Done |
| CLI one-command + 3 modes (engineering / llm-param / llm-agent) | ✅ Done |
| HTML report generation | ✅ Done |
| 3D visualization export (Three.js) | ✅ Done |
| CAIAO Hub — Server registry & subprocess isolation | ✅ Done |
| Web API (FastAPI) — REST + SSE streaming | ✅ Done |
| Web Dashboard — React + Vite + TailwindCSS | ✅ Done |
| 40 built-in H-sections (20 HW + 20 HM) | ✅ Done |
| 4 material grades (Q235 / Q355 / Q390 / Q420) | ✅ Done |
| LLM Parameter Extraction (natural language → YAML) | ✅ Done |
| LLM Agent autonomous workflow | ✅ Done |
| OpenSeesPy nonlinear integration | 🔜 Planned |
| Irregular frame topology support | 🔜 Planned |
| MCP (stdio JSON-RPC) protocol upgrade | 🔜 Planned |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start (CN)](docs/quickstart.md) | Chinese quick start guide — backend, frontend, CLI modes |
| [DEVELOPMENT_MANUAL.md](docs/DEVELOPMENT_MANUAL.md) | Complete technical manual — architecture, Server design details, I/O examples |
| [INDEPENDENT_SERVER_MANUAL.md](docs/CAIAO_INDEPENDENT_SERVER_DEVELOPMENT_MANUAL.md) | Guide for developing standalone CAIAO Servers outside this project |
| [CAIAO_DISTILLATION_GUIDE.md](docs/CAIAO_DISTILLATION_GUIDE.md) | Distillation methodology — how to extract domain skills into CAIAO Servers |
| [LLM_INTEGRATION.md](docs/LLM_INTEGRATION.md) | LLM integration guide — param extraction & agent mode |

---

## Related Resources

- [StructureClaw](https://github.com/structureclaw/structureclaw) — Source of distilled structural engineering capabilities
- [Demolition-Simulator (CAIAO)](https://github.com/LaobaiAi/Demolition-Simulator) — CAIAO Server ecosystem and application platform
- [OpenSeesPy Docs](https://openseespydoc.readthedocs.io/)

---

## Contributing

Contributions are welcome! Whether it's a new feature, bug fix, or documentation improvement:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License © 2026
