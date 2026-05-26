# Contributing to XuanwuAI Steel Frame Design

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [Development Setup](#development-setup)
3. [Branch Strategy](#branch-strategy)
4. [Commit Convention](#commit-convention)
5. [Code Style](#code-style)
6. [Pull Request Process](#pull-request-process)
7. [Testing](#testing)
8. [Project-Specific Conventions](#project-specific-conventions)

---

## Project Architecture

```
servers/                   CAIAO Atomic Servers (Python)
  base.py                  Server base class + @tool decorator
  steel_frame_generator.py Parametric frame modeling
  steel_load_generator.py  Load & boundary condition application
  opensees_runner.py       FEA (Matrix Displacement Method)
  steel_code_check.py      GB50017 code check
  report_generator.py      HTML report generation
  steel_frame_pipeline.py  Full pipeline orchestrator (merge Server)

cli/main.py                CLI entry point
schemas/                   JSON Schema definitions
templates/                 Jinja2 report template
examples/                  Sample parameter files
tests/                     Unit & integration tests
docs/                      Development manual, distillation guide
```

**Data flow**: YAML params → Frame Generator → Load Generator → FEA Runner → Code Check → Report Generator → output/

---

## Development Setup

### Prerequisites

- Python 3.10+
- pip

### Install

```bash
git clone https://github.com/LaobaiAi/steel-frame-design.git
cd steel-frame-design
pip install -r requirements.txt
```

### Run Development

```bash
# Quick demo
python cli/main.py run --quick

# Custom parameters
python cli/main.py run --input examples/sample.yaml --output-dir ./my_results

# Call a single Server directly
python servers/steel_frame_generator.py generate_frame \
  '{"grid_x":[6,6,6],"grid_y":[6,6],"num_stories":4,"story_heights":[4,3.5,3.5,3.5]}'
```

---

## Branch Strategy

| Branch type | Pattern | Purpose |
|---|---|---|
| `master` | — | Production-ready, always deployable |
| Feature | `feature/` | New capabilities (e.g., `feature/nonlinear-opensees`) |
| Fix | `fix/` | Bug fixes (e.g., `fix/stability-coefficient`) |
| Refactor | `refactor/` | Code restructuring, no behavior change |

**Rules**:
- Branch from `master`, merge back to `master`
- Keep branches short-lived (< 3 days ideal)
- Rebase on `master` before opening a PR
- Never force-push to `master`

---

## Commit Convention

This project enforces **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)** with project-specific scopes.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Usage |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `style` | Formatting, whitespace (no logic change) |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Tooling, dependencies, build scripts |
| `perf` | Performance improvement |

### Scopes

| Scope | Applies to |
|---|---|
| `frame` | Frame generator server (`servers/steel_frame_generator.py`) |
| `load` | Load generator server (`servers/steel_load_generator.py`) |
| `fea` | FEA runner server (`servers/opensees_runner.py`) |
| `check` | Code check server (`servers/steel_code_check.py`) |
| `report` | Report generator server (`servers/report_generator.py`) |
| `pipeline` | Pipeline orchestrator (`servers/steel_frame_pipeline.py`) |
| `cli` | CLI entry point (`cli/main.py`) |
| `schema` | JSON Schema definitions (`schemas/`) |
| `caiao` | CAIAO base class, Hub, or protocol (`servers/base.py`, `caiao_hub.py`) |
| `llm` | LLM gateway, agent, and param extractor servers |\n| `api` | Web API server (`servers/web_api_server.py`) |
| `frontend` | React frontend application (`frontend/`) |
| `docs` | Documentation (README, CONTRIBUTING, etc.) |
| `ci` | GitHub Actions, CI/CD |

### Examples

```bash
# New feature
feat(frame): add irregular frame topology support

# Bug fix
fix(check): correct stability coefficient for a-curve when λ > 100

# Refactor
refactor(fea): extract element stiffness matrix into standalone function

# Documentation
docs: add CONTRIBUTING.md with commit conventions and code style

# Test
test(pipeline): add end-to-end integration test for 4-story frame

# Multi-scope (use comma)
feat(frame,load): add inclined column and wind load on curved roof
```

### Rules

1. **Type and scope are mandatory** — every commit must include both
2. **Description in English**, imperative mood, lowercase, no period at end
3. **Description ≤ 72 characters**
4. **One logical change per commit** — don't mix unrelated fixes
5. **Body optional but encouraged** for non-obvious changes: explain *why*, not *what*
6. **Breaking changes**: add `!` after type/scope and `BREAKING CHANGE:` in footer

```
feat!(caiao): change tool input schema to require explicit units

BREAKING CHANGE: all tool callers must now pass dimensions in meters
and forces in kN. Previously mm and N were accepted.
```

### Prohibited

- ❌ `update`, `changes`, `wip`, `tmp`, `misc` as types
- ❌ Vague descriptions: `fix bug`, `update code`, `changes`
- ❌ Amending published commits (force-push to shared branches)
- ❌ Mixing unrelated changes in one commit
- ❌ Empty commit messages
- ❌ `--no-verify` or `--no-gpg-sign` flags (fix the underlying issue instead)

---

## Code Style

### Python (All Servers + CLI)

- **[Black](https://black.readthedocs.io/)** formatting, line length 120
- **Type hints** on all function signatures (`def foo(x: int) -> str:`)
- **Google-style docstrings** for public functions (one-liner preferred)
- **Imports**: standard library → third-party → local, alphabetically within groups
- **No `*` imports**
- **Logging** over `print()`: use `logging.getLogger(__name__)`
- **Pydantic / dataclasses** for structured data where appropriate

```python
# Preferred
def generate_frame(grid_x: list[float], grid_y: list[float], num_stories: int) -> dict[str, Any]:
    """Generate a parametric steel frame model from grid parameters."""
    ...

# Avoid
def generate_frame(grid_x, grid_y, num_stories):
    ...
```

### CAIAO Server Convention

CAIAO is our project's naming layer on top of the standard MCP SDK. All CAIAO servers follow this skeleton:

```python
"""
CAIAO Server — <domain>
"""
import json
import logging
from servers.base import CAIAOServer, tool

app = CAIAOServer("<domain>")

@app.list_tools()
def list_tools() -> list[dict]:
    return [t.to_dict() for t in app.tools]

@app.call_tool()
def call_tool(name: str, arguments: dict) -> dict:
    try:
        result = app.dispatch(name, arguments)
        return {"result": json.dumps(result)}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    app.run()
```

**Protocol rules**:
- Always return structured dicts, never raw strings
- Serialize results with `json.dumps`
- Catch all exceptions and return `{"error": str(e)}`
- Tool names use `snake_case`
- Each Server is **atomic** — single responsibility, zero cross-domain logic
- Pipeline Servers **merge only** — orchestrate, never embed domain logic

**CAIAO naming conventions**:

| Context | Convention | Example |
|---------|-----------|---------|
| Class name | `CAIAO` + PascalCase | `CAIAOServer` |
| Filename | descriptive lowercase | `steel_frame_generator.py` |
| Git scope | domain-specific | `feat(frame): add ...` |
| Tool name | `snake_case` | `generate_frame` |

---

## Pull Request Process

### Before Opening

- [ ] Branch is rebased on latest `master`
- [ ] All tests pass locally (`python tests/test_servers.py`)
- [ ] Manual smoke test performed (run `python cli/main.py run --quick`, verify output)
- [ ] Commit history is clean (meaningful messages, logical grouping)

### PR Title

Follow the same format as commits: `<type>(<scope>): <description>`

```
feat(frame): add irregular frame topology support
fix(check): correct stability coefficient for a-curve
```

### PR Body

```markdown
## Summary
- <what this PR does and why>

## Test plan
- [ ] Step 1
- [ ] Step 2

## Screenshots (if report template change)
```

### Review Requirements

- At least one approving review
- All CI checks green
- No unresolved review threads
- Reviewer verifies the full pipeline: YAML → frame → loads → FEA → code check → report

---

## Testing

### Unit & Integration Tests (`tests/`)

```bash
# Run all tests
python tests/test_servers.py

# End-to-end integration test
python cli/main.py run --quick && python tests/test_servers.py
```

- Test each Server independently with known inputs and expected outputs
- Test the full pipeline end-to-end with `--quick` mode
- Use JSON Schema validation to verify all inter-Server I/O

### Integration Smoke Test

Before merging, manually verify:

1. Run `python cli/main.py run --quick`
2. Verify `output/model.json` contains expected nodes and elements
3. Verify `output/loaded_model.json` has applied loads
4. Verify `output/check_results.json` has code check results for all elements
5. Open `output/report.html` in a browser — confirm it renders correctly

---

## Project-Specific Conventions

### Data Flow: JSON Between Servers

Each Server reads JSON from the previous step and writes JSON for the next:

```
model.json → loaded_model.json → analysis_result.json → check_result.json → report.html
```

**Rules**:
- Every inter-Server boundary must conform to the corresponding JSON Schema in `schemas/`
- Never break backward compatibility without a `BREAKING CHANGE` commit
- Optional fields must have sensible defaults

### JSON Schema Validation

All input/output schemas are in `schemas/`:

| Schema | Server | Validates |
|--------|--------|-----------|
| `model.schema.json` | Frame Generator output | Nodes, elements, sections |
| `load.schema.json` | Load Generator output | Load cases, boundary conditions |
| `analysis_result.schema.json` | FEA Runner output | Displacements, forces |
| `code_check_result.schema.json` | Code Check output | Utilization ratios, pass/fail |

**When adding a new field**: update the schema first, then the Server code.

### Section Library Convention

New H-section profiles follow this pattern in `steel_frame_generator.py`:

```python
SECTION_LIBRARY = {
    "HW350x350x12x19": {
        "H": 350, "B": 350, "tw": 12, "tf": 19,
        "A": ..., "Ix": ..., "Iy": ..., ...
    },
    # Add new sections here
}
```

- Name format: `{Type}{H}x{B}x{tw}x{tf}` (e.g., `HW400x400x13x21`)
- All geometric properties must be from GB/T 11263
- Include full mechanical properties (A, Ix, Iy, Wx, Wy, ix, iy)

### Material Grade Convention

Material grades are defined with full mechanical properties:

```python
MATERIAL_LIBRARY = {
    "Q235": {"fy": 235, "E": 206000, "G": 79000},
    "Q355": {"fy": 355, "E": 206000, "G": 79000},
    # Add new grades here
}
```

- Name format: `Q` + yield strength (e.g., `Q460`)
- Values per GB/T 1591 or GB/T 700

---

## References

- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Black — The Uncompromising Code Formatter](https://black.readthedocs.io/)
- [GB50017-2017 钢结构设计标准](https://www.mohurd.gov.cn/)
- [CAIAO Server Architecture](https://github.com/LaobaiAi/Demolition-Simulator)
