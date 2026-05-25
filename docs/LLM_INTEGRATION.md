# LLM 集成指南

> 本文档说明 Steel Frame Design v2.0 中的两个 LLM 集成层面的使用方法与配置。

---

## 概述

v2.0 提供了两个 LLM 集成层面：

| 层面 | Server | 说明 |
|------|--------|------|
| **参数提取层** | `llm_param_extractor.py` | 将自然语言描述转为结构化设计参数 YAML |
| **Agent 自主编排层** | `llm_agent_loop.py` | LLM 自主发现工具、规划步骤、执行全流程 |

两层均可通过 CLI 调用，也可通过 Hub 编程式调用。

---

## 1. LLM 参数提取模式

### 使用场景
用户用自然语言描述设计需求（如"设计一个三层钢结构办公楼"），系统自动提取参数并执行全流程。

### CLI 调用

```bash
python cli/main.py run --mode llm-param \
  --prompt "设计一个三层钢框架办公楼，柱距6米，每层3.5米高，Q355钢材" \
  --api-key sk-your-api-key \
  --model gpt-4o-mini
```

### 编程式调用

```python
from caiao_hub import Hub
from servers.llm_param_extractor import LLMParamExtractor
from servers.cli_orchestrator import CliOrchestrator

hub = Hub()
hub.register(LLMParamExtractor())
hub.register(CliOrchestrator(hub))

result = hub.call_tool("run_cli_command", {
    "mode": "llm-param",
    "prompt": "设计一个三层钢框架办公楼，6米柱距，Q355钢",
    "llm_config": {
        "api_key": "sk-xxx",
        "model": "gpt-4o-mini"
    }
})
```

### 参数提取 System Prompt

提取器使用预定义的 System Prompt，指导 LLM 输出严格的 JSON 格式。支持的参数包括：
- `grid_x`, `grid_y` — 柱距
- `num_stories`, `story_heights` — 层数、层高
- `column_section`, `beam_section` — 截面选型
- `material` — 材料 (Q235/Q355)
- `dead_load`, `live_load`, `wind_pressure`, `seismic_intensity` — 荷载

### 错误处理
- LLM API 不可达 → 返回 `{"error": "LLM API call failed: ..."}`
- JSON 解析失败 → 尝试提取 `{` 到 `}` 之间的内容
- API key 未提供 → 返回 `{"error": "LLM API key is required"}`

---

## 2. LLM Agent 自主编排模式

### 使用场景
LLM 作为 Agent，自主发现所有可用工具，规划执行步骤，通过 ReAct 循环完成钢框架设计全流程。**Agent 自己决定何时调用哪个工具**。

### CLI 调用

```bash
python cli/main.py run --mode llm-agent \
  --prompt "设计一个两层钢框架，用Q235钢，校核所有荷载工况，并生成报告" \
  --api-key sk-your-api-key \
  --model gpt-4o
```

### 编程式调用

```python
from caiao_hub import Hub
from servers.llm_agent_loop import LLMAgentLoop

hub = Hub()
agent = LLMAgentLoop(hub)
hub.register(agent)

result = hub.call_tool("execute_with_llm", {
    "prompt": "设计一个两层钢框架...",
    "llm_config": {"api_key": "sk-xxx", "model": "gpt-4o"},
    "max_iterations": 10
})

# 查看执行步骤
for step in result["steps"]:
    print(step)
```

### ReAct 循环

```
User Prompt → LLM 规划 →
  [tool_call: generate_frame] → 结果反馈 →
  [tool_call: apply_loads]    → 结果反馈 →
  [tool_call: run_analysis]   → 结果反馈 →
  [tool_call: check_code]     → 结果反馈 →
  [tool_call: generate_report] → 结果反馈 →
LLM 最终回复（总结设计结果）
```

### 安全限制
- 最大迭代次数：默认 10 次（可配 `max_iterations`），防止死循环
- 每次只执行一个 `tool_call`
- 工具调用失败会反馈给 LLM，Agent 可尝试修复

### Agent System Prompt

Agent 内置 System Prompt 描述：
- 所有可用工具及其功能
- 推荐的执行顺序
- 错误处理策略

---

## 3. LLM 后端配置

### 支持的 LLM 后端

使用 OpenAI 兼容 API 接口，支持：

| 后端 | base_url | model 示例 |
|------|----------|-----------|
| OpenAI | 默认 (https://api.openai.com/v1) | gpt-4o, gpt-4o-mini |
| Azure OpenAI | https://xxx.openai.azure.com | gpt-4 |
| 本地模型 (vLLM/Ollama) | http://localhost:8000/v1 | llama3 |
| 其他兼容提供商 | 自定义 | 自定义 |

### 配置方式

**方式一：CLI 参数**

```bash
python cli/main.py run --mode llm-agent \
  --prompt "..." \
  --api-key sk-xxx \
  --model gpt-4o-mini \
  --base-url https://api.openai.com/v1
```

**方式二：环境变量**

```bash
export OPENAI_API_KEY=sk-xxx
python cli/main.py run --mode llm-agent --prompt "..." --model gpt-4o-mini
```

CLI 会自动读取 `OPENAI_API_KEY` 环境变量。

---

## 4. 两种模式的对比

| 特性 | llm-param (参数提取) | llm-agent (Agent编排) |
|------|---------------------|----------------------|
| 调用 LLM 次数 | 1 次 | N 次 (ReAct循环) |
| LLM 角色 | 文本 → 参数 JSON | 自主规划 + 工具调用 |
| 是否了解工具 | 否 | 是（通过 Hub 获取工具列表） |
| 适用场景 | 快速参数化 | 探索性设计、复杂需求 |
| 推荐模型 | gpt-4o-mini | gpt-4o |
| Token 消耗 | 低 (~500 tokens) | 中 (~2000-5000 tokens) |

---

## 5. 注意事项

1. **API Key 安全**: 不要在代码中硬编码 API Key，使用环境变量或 CLI 参数
2. **网络依赖**: LLM 模式需要网络连接到 API 端点
3. **限流处理**: 连续多次 Agent 调用可能触发 API 限流
4. **工程模式优先**: 如有明确的 YAML 参数文件，优先使用工程模式（无需 LLM，更快更可靠）
5. **Agent 模式推荐模型**: 建议使用 gpt-4o 或同等能力模型，低能力模型可能无法正确编排多步骤任务
