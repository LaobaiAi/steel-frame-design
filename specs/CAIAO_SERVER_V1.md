# CAIAO Server 规范 v1.0

> 本文档定义 CAIAO Server 的标准契约、目录结构、版本管理和测试要求。
> 所有接入 CAIAO 生态的 Server 必须符合本规范。

---

## 1. CAIAO Server 契约

每个 CAIAO Server 必须实现以下三个接口：

### 1.1 `list_tools() → list[dict]`

返回该 Server 提供的所有工具描述。每个工具描述必须包含：

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `name` | string | ✅ | 工具唯一标识，建议使用蛇形命名 (snake_case) |
| `description` | string | ✅ | 工具功能描述，AI Agent 据此判断何时调用 |
| `inputSchema` | object | ✅ | JSON Schema 格式的输入参数定义 |

```json
[
  {
    "name": "generate_frame",
    "description": "根据网格参数生成钢框架结构模型...",
    "inputSchema": {
      "type": "object",
      "required": ["grid_x", "grid_y"],
      "properties": { ... }
    }
  }
]
```

### 1.2 `call_tool(tool_name: str, input_data: dict) → dict`

执行指定工具，返回结果字典。

- 调用不存在的工具：返回 `{"error": "Tool 'xxx' not found"}`
- 执行异常：返回 `{"error": "Tool 'xxx' execution failed: ..."}`
- 正常执行：返回业务结果 dict，不应包含 `error` 键

### 1.3 `get_metadata() → dict`

返回 Server 元数据：

```json
{
  "name": "model-generator",
  "version": "1.0.0",
  "category": "structural_modeling",
  "description": "参数化生成钢框架结构模型...",
  "tools": [
    {"name": "generate_frame", "description": "..."}
  ],
  "dependencies": ["numpy"],
  "compatibility": {
    "caiao_spec": "1.0",
    "mcp": true
  }
}
```

| 字段 | 说明 |
|------|------|
| `name` | Server 标识名，建议与目录名一致 |
| `version` | 语义化版本号 (SemVer) |
| `category` | 分类标签，如 structural_modeling, code_compliance, visualization |
| `description` | 自然语言描述 |
| `tools` | 工具摘要列表 (name + description) |
| `dependencies` | Python 包依赖列表 |
| `compatibility.caiao_spec` | 遵循的规范版本，当前固定 "1.0" |
| `compatibility.mcp` | 是否支持 MCP 协议 |

### 1.4 `run_stdio_loop()` (可选)

启动 stdio JSON 循环，用于将来 MCP 集成。当前可用作调试入口。

---

## 2. 目录结构约定

```
my-server/
├── servers/
│   ├── base.py                    # CAIAOServer 基类 + @tool 装饰器
│   ├── my_domain_server.py        # 原子 Server（一个 .py 文件一个 Server）
│   └── ...
├── caiao_hub.py                   # 轻量调度中心（自动发现 Server）
├── schemas/                       # JSON Schema 定义
├── tests/                         # 测试文件
└── docs/                          # 文档
```

### 命名规则

- **Server 文件**: `{domain}_{function}.py`（如 `steel_frame_generator.py`）
- **工具名称**: `{verb}_{noun}`（如 `generate_frame`, `check_code`）
- **Server 类名**: PascalCase（如 `SteelFrameGenerator`）
- **合并 Server**: 名以 `pipeline`、`orchestrator` 结尾

---

## 3. 原子 Server 设计原则

### 3.1 单一职责
一个 Server 只承担一项域能力，不应"既建模又分析又出报告"。

### 3.2 零间接依赖
Server 间**绝不直接 import**。所有跨 Server 通信通过 Hub 传递 JSON。

```python
# ❌ 禁止
from servers.other_server import OtherServer

# ✅ 允许
hub.call_tool("other_tool", input_data)
```

### 3.3 无状态
`call_tool()` 每次调用独立，不依赖实例状态。输入足够即输出。

### 3.4 纯计算
Server 不包含 GUI、网络、数据库逻辑。文件 I/O 仅限于通过参数指定的路径。

---

## 4. 合并 Server 模式

合并 Server (Pipeline / Orchestrator) 的本质是**编排**：

- 不包含领域计算逻辑
- 通过 Hub 顺序/条件调用原子 Server
- 数据传递：上游输出 → 下游输入
- 错误处理：任一步骤失败，立即返回明确错误信息

```python
class MyPipeline(CAIAOServer):
    def __init__(self, hub=None):
        super().__init__()
        self._hub = hub

    def run_pipeline(self, input_data):
        out_a = self._hub.call_tool("tool_a", input_data)
        out_b = self._hub.call_tool("tool_b", {"input_from_a": out_a})
        return out_b
```

---

## 5. 版本管理

| 规则 | 说明 |
|------|------|
| 版本格式 | `MAJOR.MINOR.PATCH`（SemVer） |
| MAJOR | 不兼容的 API 修改（工具删减、输入Schema变更） |
| MINOR | 新增工具、向后兼容的功能增加 |
| PATCH | Bug 修复、性能优化 |

版本号在 `server_version` 类属性中声明。

---

## 6. 依赖声明格式

```python
class MyServer(CAIAOServer):
    server_dependencies = ["numpy>=1.24", "pyyaml>=6.0"]
```

- 只声明 Server 自身的直接依赖
- 使用 pip 兼容的包名和版本约束
- 不声明 Python 标准库

---

## 7. 测试要求

每个 CAIAO Server 应包含：

| 测试类型 | 最小要求 |
|----------|----------|
| `list_tools()` | 验证返回列表非空、每个工具含 name/description/inputSchema |
| `get_metadata()` | 验证返回完整元数据 |
| `call_tool()` 正常输入 | 至少一个正向测试用例 |
| `call_tool()` 异常输入 | 验证错误返回含 `error` 键 |
| Hub 集成测试 | 验证 `find_tool()` 和 `call_tool()` 路由正常 |
| 端到端测试 | Pipeline 全流程跑通 |

---

## 8. 与 MCP 的兼容性

CAIAO Server 已预对齐 MCP 协议：

| CAIAO 接口 | MCP 对应 |
|------------|----------|
| `list_tools()` | `tools/list` |
| `call_tool(name, input)` | `tools/call` |
| `get_metadata()` | 扩展元数据（MCP 1.0 未标准化） |
| `run_stdio_loop()` | MCP stdio transport |

迁移到 MCP 只需将 `run_stdio_loop()` 中的手写 JSON 循环替换为 MCP SDK 的 transport，业务代码零改动。

---

## 9. 生态贡献 Checklist

向 CAIAO Server 生态贡献新 Server 时，请确认：

### 代码
- [ ] 继承 `CAIAOServer`，使用 `@tool` 注册
- [ ] 单一 `.py` 文件，无跨 Server import
- [ ] 类属性声明：`server_name`, `server_version`, `server_category`, `server_dependencies`
- [ ] `get_metadata()` 返回完整信息
- [ ] `__main__` 块支持 `run_cli()`

### 输入输出
- [ ] `@tool` 的 `input_schema` 每个字段有 `description`
- [ ] 返回纯 dict，可 JSON 序列化
- [ ] 错误时返回 `{"error": "..."}`

### 文档
- [ ] 模块 docstring 说明蒸馏来源、功能、依赖
- [ ] 工具 `description` 写清功能和适用条件

### 测试
- [ ] 至少一个正向测试用例
- [ ] 边界/异常输入测试
- [ ] Hub 集成测试通过
