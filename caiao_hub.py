"""
CAIAO Hub — 轻量调度中心

遵循 CAIAO 标准 v1.0，提供 Server 注册、发现和工具调用路由。
Hub 自身不包含任何业务逻辑，仅是路由代理。

核心功能：
- 自动扫描 servers/ 目录，发现并注册所有 CAIAOServer 实例
- 维护全局工具注册表 (_tool_registry)
- 提供 find_tool() / call_tool() 供 Pipeline 和其他合并 Server 使用
- 支持手动注册外部 Server（测试/动态加载）

设计原则：
- 零业务逻辑
- 松耦合 — Server 间绝不直接 import
- 无状态 — 每次 call_tool 独立执行
"""

import importlib
import inspect
import os
import sys
from typing import Any

# 确保 servers 在 sys.path 中
_SERVERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "servers")
if _SERVERS_DIR not in sys.path:
    sys.path.insert(0, _SERVERS_DIR)


class Hub:
    """CAIAO 轻量调度中心。

    用法:
        hub = Hub()                          # 自动扫描 servers/ 并注册
        hub.register(MyCustomServer(hub))    # 注册自定义 Server
        result = hub.call_tool("generate_frame", {...})
        tool_def = hub.find_tool("check_code")
    """

    def __init__(self, server_dir: str | None = None):
        """初始化 Hub，自动扫描并注册所有 CAIAO Server。

        Args:
            server_dir: servers 目录路径，默认为项目根目录下的 servers/
        """
        self._server_dir = server_dir or _SERVERS_DIR
        # _tool_registry: tool_name -> {"server": instance, "definition": tool_spec}
        self._tool_registry: dict[str, dict[str, Any]] = {}
        self._servers: list[Any] = []
        self._auto_discover()

    # ── 自动发现 ──────────────────────────────────────────────────

    def _auto_discover(self):
        """扫描 servers/ 目录，自动发现并实例化所有 CAIAOServer 子类。"""
        if not os.path.isdir(self._server_dir):
            return

        # 延迟导入 base，避免循环依赖
        from servers.base import CAIAOServer

        for filename in os.listdir(self._server_dir):
            if filename.startswith("_") or not filename.endswith(".py"):
                continue

            module_name = filename[:-3]  # 去掉 .py
            # 跳过非 Server 模块
            if module_name == "base":
                continue

            try:
                module = importlib.import_module(f"servers.{module_name}")
                # 发现模块中所有 CAIAOServer 子类
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if not issubclass(obj, CAIAOServer) or obj is CAIAOServer:
                        continue
                    try:
                        instance = obj()
                        self._register_server(instance)
                    except Exception as e:
                        print(f"[Hub] 实例化 {obj.__name__} 跳过: {e}")
            except Exception as e:
                print(f"[Hub] 加载模块 {module_name} 跳过: {e}")

    # ── 注册 Server ──────────────────────────────────────────────

    def register(self, server_instance):
        """手动注册一个 CAIAO Server 实例。

        对于需要特殊构造参数（如 hub 引用）的 Server，
        应先创建实例再手动注册，而非依赖自动扫描。

        Args:
            server_instance: CAIAOServer 实例
        """
        self._register_server(server_instance)

    def _register_server(self, server_instance):
        """内部：将一个 Server 实例的工具注册到工具表中。"""
        from servers.base import CAIAOServer

        if not isinstance(server_instance, CAIAOServer):
            return

        self._servers.append(server_instance)

        for tool_spec in server_instance.list_tools():
            tool_name = tool_spec["name"]
            self._tool_registry[tool_name] = {
                "server": server_instance,
                "definition": tool_spec,
            }

    # ── 工具发现与调用 ────────────────────────────────────────────

    def find_tool(self, tool_name: str) -> dict | None:
        """查找工具定义。

        Returns:
            tool_spec dict 或 None
        """
        entry = self._tool_registry.get(tool_name)
        return entry["definition"] if entry else None

    def call_tool(self, tool_name: str, input_data: dict) -> dict:
        """通过 Hub 调用工具。

        根据工具名自动路由到对应 Server 执行。

        Args:
            tool_name: 工具名称（如 "generate_frame", "check_code"）
            input_data: 工具输入参数字典

        Returns:
            工具执行结果字典，含 {"error": "..."} 当失败时
        """
        entry = self._tool_registry.get(tool_name)
        if entry is None:
            return {
                "error": f"Tool '{tool_name}' not found in Hub. "
                         f"Available: {list(self._tool_registry.keys())}"
            }
        return entry["server"].call_tool(tool_name, input_data)

    def list_all_tools(self) -> list[dict]:
        """列出所有已注册工具的完整定义列表。"""
        return [entry["definition"] for entry in self._tool_registry.values()]

    def list_server_names(self) -> list[str]:
        """列出所有已注册 Server 的类名。"""
        return [s.__class__.__name__ for s in self._servers]

    def get_server_count(self) -> int:
        """已注册的 Server 数量。"""
        return len(self._servers)

    def get_tool_count(self) -> int:
        """已注册的工具数量。"""
        return len(self._tool_registry)
