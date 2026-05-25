<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-blue?style=flat-square&logo=python" alt="Python">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/CAIAO-Server%20Native-orange?style=flat-square" alt="CAIAO">
  <img src="https://img.shields.io/badge/GB50017-compliant-red?style=flat-square" alt="GB50017">
</p>

<h1 align="center">XuanwuAI Steel Frame Design</h1>

<p align="center">
  <strong>Parametric steel frame design — one-click full pipeline</strong><br>
  <em>Parametric Modeling → Load Application → FEA → GB50017 Code Check → Report</em>
</p>

<p align="center">
  <a href="#-玄武--xuanwu">Philosophy</a> ·
  <a href="#what-is-xuanwuai-steel-frame-design">About</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#key-features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#project-structure">Structure</a> ·
  <a href="#documentation">Docs</a>
</p>

---

## 玄武 · Xuanwu

渊默之算 · Abyssal Computation

> **Wisdom computes all things; Stability governs heaven and earth.**

**玄武 (Xuanwu)**, the god of the North in Chinese mythology, is a divine hybrid of **tortoise and serpent** — the perfect embodiment of *ultimate stability* and *adaptive intelligence* in unity.

| Symbol | Meaning | In XuanwuAI |
|--------|---------|-------------|
| 🛡️ **Tortoise** (Aegis) | Absolute defense, order, and unshakable foundation | The rock-solid physics engine kernel and precise rule system that anchor every simulation |
| 🐍 **Serpent** (Python) | Agility, wisdom, and precise execution | The high-level AI algorithms that autonomously plan, adapt, and devise optimal demolition strategies in complex environments |

XuanwuAI is part of the **Four Symbols AI** (四象AI) family, each embodying a cardinal virtue:

| Deity | Element | Virtue | Domain |
|-------|---------|--------|--------|
| **QinglongAI** 青龙 | 木 Wood | 创生之智 · Generative Creation | Generative AI, creative intelligence |
| **ZhuqueAI** 朱雀 | 火 Fire | 燎原之火 · Connective Flame | Intelligent interaction, human-AI experience |
| **BaihuAI** 白虎 | 金 Metal | 肃金之盾 · Purifying Shield | AI-native security, adversarial defense |
| **XuanwuAI** 玄武 | 水 Water | **渊默之算 · Abyssal Computation** | Complex simulation, strategic decision-making |

> Xuanwu corresponds to the **Water element** — depth, wisdom, and the power to mirror reality within digital worlds. As the foundation of the Four Symbols, it provides the computational bedrock upon which creation, connection, and defense are built.

---

## What is XuanwuAI Steel Frame Design?

Steel Frame Design is a **CAIAO-native atomic Server pipeline** for automated steel structure design. Distilled from **[StructureClaw](https://github.com/structureclaw/structureclaw)** and built atop the **[CAIAO Server architecture](https://github.com/LaobaiAi/Demolition-Simulator)**, it takes a single YAML parameter file and runs the complete structural engineering workflow — parametric frame generation, load application, finite element analysis, GB50017 code checking, and HTML report generation — with zero GUI dependency.

Each step in the pipeline is an independent, reusable, LLM-callable atomic Server. This project produced the first batch of CAIAO atomic Servers for the structural engineering domain, laying standardized groundwork for future integration into the CAIAO Hub and MCP ecosystem.

```bash
python cli/main.py run --quick   # one command, end to end
```

---

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│              │    │              │    │              │    │              │    │              │
│   Frame      │───▶│   Load       │───▶│   FEA        │───▶│   Code Check  │───▶│   Report     │
│   Generator  │    │   Generator  │    │   Runner     │    │   GB50017     │    │   Generator  │
│              │    │              │    │              │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼                   ▼
   model.json       loaded_model.json    analysis_result.json   check_result.json     report.html
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
| **Language** | Python 3.10+ |
| **FEA Engine** | Matrix Displacement Method (built-in) / OpenSeesPy (optional) |
| **Numerical** | NumPy |
| **Reporting** | Jinja2 (with string-builder fallback) |
| **Config** | PyYAML |
| **Terminal UI** | Rich |
| **Contract Validation** | jsonschema |
| **Architecture** | CAIAO Atomic Server |

---

## Key Features

### Core Workflow
- **One YAML, One Command** — Input grid dimensions, story count, loads, and sections in a single YAML file
- **Automatic Load Derivation** — Dead, live, wind, and seismic loads automatically converted to element/node forces
- **Matrix Displacement Method** — Built-in 3D beam-element stiffness solver, zero compilation required
- **GB50017 Code Check** — Per-element strength, stability, slenderness, and deflection verification
- **HTML Report** — Jinja2-rendered report with model overview, check summary table, and key metrics

### Engineering
- **7 Built-in H-Sections** — HW/HM series from GB/T 11263
- **Material Grades** — Q235, Q355 with full mechanical properties
- **Simplified Equivalent Loads** — Floor uniform loads → beam line loads via tributary area method
- **Base Shear Method** — Seismic action per simplified code provisions
- **Stability Coefficients** — a-curve formula per GB50017

### AI Readiness
- **LLM-Callable Servers** — Complete `@tool` metadata with descriptions and schemas
- **Stdio-Loop Ready** — Each Server has `run_stdio_loop()` for future MCP upgrade
- **Schema-Validated I/O** — Every inter-Server boundary enforced via jsonschema

---

## Quick Start

### Prerequisites

- Python 3.10+
- pip

### Install

```bash
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design
pip install -r requirements.txt
```

### Run

```bash
# Quick demo: 4-story office building, 3×2 bays, Q355 steel
python cli/main.py run --quick

# Custom parameters
python cli/main.py run --input examples/sample.yaml --output-dir ./my_results

# Inspect outputs
ls output/          # model.json, loaded_model.json, check_results.json, report.html
```

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
column_section: HW350x350x12x19    # Column section
beam_section: HM340x250x9x14       # Beam section
material: Q355                     # Steel grade (Q235 / Q355 / Q460)
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
├── servers/                           # CAIAO Atomic Servers
│   ├── base.py                        # Server base class + @tool decorator
│   ├── steel_frame_generator.py       # Parametric frame modeling
│   ├── steel_load_generator.py        # Load & boundary condition application
│   ├── opensees_runner.py             # FEA (Matrix Displacement Method)
│   ├── steel_code_check.py            # GB50017 code check
│   ├── report_generator.py            # HTML report generation
│   └── steel_frame_pipeline.py        # Full pipeline orchestrator (merge Server)
├── cli/
│   └── main.py                        # CLI entry point
├── schemas/                           # JSON Schema definitions
│   ├── model.schema.json
│   ├── load.schema.json
│   ├── analysis_result.schema.json
│   └── code_check_result.schema.json
├── templates/                         # Jinja2 report template
├── examples/                          # Sample parameter files
├── tests/                             # Unit & integration tests
├── docs/                              # Decisions log, dev manual, distillation guide
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
| Parametric regular frame modeling | Done |
| Dead / Live / Wind / Seismic load generation | Done |
| 2D elastic matrix displacement analysis | Done |
| GB50017 strength & stability check | Done |
| CLI one-command + HTML report | Done |
| OpenSeesPy nonlinear integration | Planned |
| Irregular frame topology support | Planned |
| MCP (stdio JSON-RPC) protocol upgrade | Planned |
| Web Dashboard visualization | Planned |

---

## Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT_MANUAL.md](docs/DEVELOPMENT_MANUAL.md) | Complete technical manual — architecture, Server design details, I/O examples |
| [decisions.md](docs/decisions.md) | Design decision log — every key tradeoff documented |
| [CAIAO_DISTILLATION_GUIDE.md](docs/CAIAO_DISTILLATION_GUIDE.md) | Distillation methodology — how to extract domain skills into CAIAO Servers |
| [FULL_PIPELINE_PLAN.md](钢框架全流程蒸馏执行计划.md) | Original execution plan (Chinese) |

---

## Related Resources

- [StructureClaw](https://github.com/structureclaw/structureclaw) — Source of distilled structural engineering capabilities
- [Demolition-Simulator (CAIAO)](https://github.com/LaobaiAi/Demolition-Simulator) — CAIAO Server ecosystem and application platform
- [OpenSeesPy Docs](https://openseespydoc.readthedocs.io/)

---

## License

MIT License © 2026
