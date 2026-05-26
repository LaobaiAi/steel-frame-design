# LLM 集成指南（v2.0 CAIAO 化改造）

> 本文档说明 Steel Frame Design v2.0 CAIAO 化后的 LLM 集成架构与使用方法。

---

## 架构概览

CAIAO 化改造的核心变化：将 LLM 通信抽象为原子 Server `llm_gateway`，所有需要 LLM 能力的 Server 通过 Hub 调用它，不再直接发 HTTP 请求。

```
改造前：                          改造后（CAIAO 化）：

LLMParamExtractor                  LLMParamExtractor (纯计算)
  └── _call_llm() → requests.post    └── Hub → llm_gateway → LLM API

LLMAgentLoop                       LLMAgentOrchestrator (合并 Server)
  └── _call_llm() → requests.post    └── Hub → llm_gateway → LLM API
    └── Hub → 其他工具                  └── Hub → 其他工具

                                     llm_gateway (原子 Server) ★
                                       └── chat_completion() / stream_chat()
                                       └── 唯一包含网络逻辑的 Server
                                       └── API Key 优先从环境变量读取
```

### 三层架构

| 层 | Server | 类别 | 职责 |
|---|--------|------|------|
| **通信层** | `llm_gateway.py` | 原子 Server | **唯一**发 HTTP 请求的 Server。提供 `chat_completion`（非流式）和 `stream_chat`（流式） |
| **计算层** | `llm_param_extractor.py` | 原子 Server | 纯计算：JSON 解析、Schema 校验、默认值填充。通过 Hub → `llm_gateway` 获取 LLM 输出 |
| **编排层** | `llm_agent_orchestrator.py` | 合并 Server | 纯编排：ReAct 循环，通过 Hub 动态发现工具，通过 Hub → `llm_gateway` 获取 LLM 响应 |

---

## 1. 环境变量配置

CAIAO 化后，API Key 优先从服务端环境变量读取，前端配置作为可选覆盖：

```bash
# 服务端环境变量（推荐）
export LLM_API_KEY=sk-your-api-key
export LLM_BASE_URL=https://api.openai.com/v1    # 可选，默认值
export LLM_MODEL=gpt-4o-mini                      # 可选，默认值
```

配置优先级：**环境变量 > 前端传入 > 默认值**

---

## 2. LLM 参数提取模式

LLM Server 调用链路：

```
用户文本 → Hub.call_tool("extract_params_from_text", ...)
         → LLMParamExtractor.extract_params_from_text()
         → Hub.call_tool("chat_completion", messages, ...)
         → LLMGateway.chat_completion() → requests.post → LLM API
         → JSON 解析（纯计算）
         → 默认值填充（纯计算）
         → 结构化参数
```

### CLI 调用

```bash
# API Key 来自环境变量
python cli/main.py run --mode llm-param \
  --prompt "设计一个三层钢框架办公楼，柱距6米"

# 或手动传入（作为环境变量覆盖）
python cli/main.py run --mode llm-param \
  --prompt "设计一个三层钢框架办公楼，柱距6米" \
  --api-key sk-xxx \
  --model gpt-4o-mini
```

---

## 3. LLM Agent 自主编排模式

Agent 调用链路：

```
用户描述 → Hub.call_tool("execute_with_llm", ...)
         → LLMAgentOrchestrator.execute()
         → Hub.list_all_tools() 动态发现工具
         → Hub.call_tool("chat_completion", messages, tools, ...)
         → LLMGateway → LLM API（返回 tool_calls）
         → Hub.call_tool(tool_name, args) 执行原子 Server
         → 智能摘要结果 → 下一轮 ReAct
```

### CLI 调用

```bash
python cli/main.py run --mode llm-agent \
  --prompt "设计一个两层钢框架，用Q235钢，校核所有荷载工况，并生成报告"
```

---

## 4. 流式对话（SSE）

新的 SSE 端点允许前端实时接收 LLM 响应：

```bash
curl -X POST http://localhost:8000/api/llm/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "你是一个结构工程师"},
      {"role": "user", "content": "设计一个三层办公楼"}
    ]
  }'

# 响应（SSE 格式）：
# data: {"type": "token", "content": "好的"}
# data: {"type": "token", "content": "，"}
# data: {"type": "done"}
```

---

## 5. 与 v1.x 的关键区别

| 特性 | v1.x | v2.0 CAIAO 化 |
|------|------|----------------|
| LLM 通信 | 每个 Server 各自 `requests.post` | 统一经 `llm_gateway` |
| API Key | 必须通过前端/CLI 传入 | 优先环境变量，前端可选覆盖 |
| 参数提取器 | 直接调 LLM API + 解析 | 纯计算，通过 Hub 调 `llm_gateway` |
| Agent 循环 | `llm_agent_loop.py` | `llm_agent_orchestrator.py`（合并 Server） |
| 流式响应 | 不支持 | SSE (`POST /api/llm/stream`) |
| 工具结果回传 | 完整 JSON | 智能摘要（节省 80-90% Token） |
| 测试 | 无网络依赖隔离 | 纯计算测试 + 网关元数据测试 |

---

## 6. 注意事项

1. **API Key 安全**：优先通过服务端环境变量 `LLM_API_KEY` 配置，避免在前端代码中硬编码
2. **环境变量优先级**：`LLM_API_KEY` > 前端 `api_key` 参数 > 无（返回错误）
3. **llm_gateway 是唯一网络入口**：所有 LLM 调用必须通过此 Server，新增功能也需遵循此约束
4. **Agent 编排器不自带网络**：作为合并 Server，它只编排不通信，LLM 调用委托给 `llm_gateway`
