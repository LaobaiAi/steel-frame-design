"""
CAIAO 轻量 Server 基类

每个原子 Server 继承此类，通过 list_tools() 声明能力，
通过 call_tool() 执行，遵守统一的 CAIAO 轻量契约。

CAIAO Server 契约（v1.0）:
- list_tools()    — 声明工具能力
- call_tool()     — 执行工具
- get_metadata()  — 返回 Server 元数据（v2.0 新增）

设计原则：
- 原子化：每个 Server 功能单一，无运行时依赖
- 契约化：统一接口，基于 JSON Schema 通信
- AI 原生：Tool 描述清晰完备，可直接被 LLM Agent 调用
"""

import json
import sys
from typing import Any, Callable

# ── 轻量工具注册装饰器 ───────────────────────────────────────────


def tool(name: str, description: str, input_schema: dict):
    """装饰器：将方法注册为一个 Tool，同时附加元信息。"""
    def decorator(func: Callable):
        func._caiao_tool = {
            "name": name,
            "description": description,
            "inputSchema": input_schema,
        }
        return func
    return decorator


# ── Server 基类 ───────────────────────────────────────────────────


class CAIAOServer:
    """CAIAO 原子 Server 基类。

    契约方法（子类应实现/覆盖）:
        list_tools()    — 返回工具列表
        call_tool()     — 执行工具
        get_metadata()  — 返回 Server 元数据（v2.0 新增）

    用法:
        class MyServer(CAIAOServer):
            @tool("my_tool", "Does something", {...})
            def my_tool(self, input_data: dict) -> dict:
                ...

        if __name__ == "__main__":
            MyServer().run_stdio_loop()
    """

    # ── 类级元信息（子类应覆盖）────────────────────────────────

    server_name: str = ""
    server_version: str = "1.0.0"
    server_category: str = "general"
    server_description: str = ""
    server_dependencies: list[str] = []

    def __init__(self):
        self._tools: dict[str, Callable] = {}
        self._tool_specs: list[dict] = []
        self._discover_tools()

    def _discover_tools(self):
        """自动发现所有带 @tool 装饰器的方法。"""
        for attr_name in dir(self):
            attr = getattr(self, attr_name)
            if callable(attr) and hasattr(attr, "_caiao_tool"):
                spec = attr._caiao_tool.copy()
                self._tool_specs.append(spec)
                self._tools[spec["name"]] = attr

    # ── 契约接口 ──────────────────────────────────────────────

    def list_tools(self) -> list[dict]:
        """返回该 Server 提供的所有工具描述。"""
        return self._tool_specs

    def call_tool(self, tool_name: str, input_data: dict) -> dict:
        """执行指定工具，返回结果字典。"""
        if tool_name not in self._tools:
            return {"error": f"Tool '{tool_name}' not found. Available: {list(self._tools.keys())}"}
        try:
            result = self._tools[tool_name](input_data)
            return result
        except Exception as e:
            return {"error": f"Tool '{tool_name}' execution failed: {str(e)}"}

    # ── 元数据接口（v2.0 新增）────────────────────────────────

    def get_metadata(self) -> dict:
        """返回 Server 元数据，符合 CAIAO Server Spec v1.0。

        Returns:
            dict 包含 name, version, category, description, tools,
            dependencies, compatibility 字段。
        """
        return {
            "name": self.server_name or self.__class__.__name__,
            "version": self.server_version,
            "category": self.server_category,
            "description": self.server_description or (self.__doc__ or "").strip(),
            "tools": [{"name": t["name"], "description": t["description"]}
                       for t in self.list_tools()],
            "dependencies": self.server_dependencies,
            "compatibility": {
                "caiao_spec": "1.0",
                "mcp": True,
            },
        }

    # ── stdio 循环（用于将来 MCP 集成）────────────────────────

    def run_stdio_loop(self):
        """启动 stdio JSON 循环，通过标准输入输出与外部通信。

        协议（轻量版）：
        - 输入：每行一个 JSON，格式 {"method": "...", "params": {...}, "id": ...}
        - 输出：每行一个 JSON 响应
        """
        print(f"[{self.__class__.__name__}] stdio loop started", file=sys.stderr)
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
                method = request.get("method", "")
                req_id = request.get("id")

                if method == "list_tools":
                    response = {"id": req_id, "result": self.list_tools()}
                elif method == "call_tool":
                    tool_name = request.get("params", {}).get("tool_name", "")
                    input_data = request.get("params", {}).get("input", {})
                    result = self.call_tool(tool_name, input_data)
                    response = {"id": req_id, "result": result}
                elif method == "get_metadata":
                    response = {"id": req_id, "result": self.get_metadata()}
                else:
                    response = {"id": req_id, "error": f"Unknown method: {method}"}

                print(json.dumps(response, ensure_ascii=False), flush=True)
            except Exception as e:
                print(json.dumps({"error": str(e)}, ensure_ascii=False), flush=True)

    # ── 调试入口：从命令行参数直接调用 ──────────────────────────

    def run_cli(self, args: list[str] | None = None):
        """从命令行参数直接调用工具（调试用）。

        用法: python server.py tool_name '{"key": "value"}'
        """
        if args is None:
            args = sys.argv[1:]

        if len(args) < 1:
            print(f"Tools: {[t['name'] for t in self.list_tools()]}")
            return

        tool_name = args[0]
        if len(args) >= 2:
            try:
                input_data = json.loads(args[1])
            except json.JSONDecodeError:
                input_data = {}
        else:
            input_data = {}

        result = self.call_tool(tool_name, input_data)
        print(json.dumps(result, indent=2, ensure_ascii=False))


# ── 快捷测试入口 ──────────────────────────────────────────────────

def test_call_tool(server: CAIAOServer, tool_name: str, input_data: dict) -> dict:
    """测试 Helper：调用 server 的某个 tool 并返回结果。

    用法:
        from servers.base import CAIAOServer, test_call_tool
        from servers.steel_frame_generator import SteelFrameGenerator

        server = SteelFrameGenerator()
        result = test_call_tool(server, "generate_frame", {...})
        assert "nodes" in result
    """
    return server.call_tool(tool_name, input_data)
