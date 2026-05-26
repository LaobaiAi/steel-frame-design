"""
CAIAO Hub — 轻量调度中心

遵循 CAIAO 标准 v1.0，提供 Server 注册、发现和工具调用路由。
Hub 自身不包含任何业务逻辑，仅是路由代理。

支持两种运行模式：
  - in_process：主进程内直调（适用于非计算型编排 Server）
  - subprocess：独立子进程 stdio 通信（适用于计算型求解器 Server）

设计原则：
  - 零业务逻辑
  - 松耦合 — Server 间绝不直接 import
  - 进程隔离 — 计算型 Server 崩溃不牵连主进程
  - 无状态 — 每次 call_tool 独立执行
"""

import importlib
import inspect
import json
import os
import subprocess
import sys
import time
from typing import Any


# 确保 servers 在 sys.path 中
_SERVERS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "servers")
if _SERVERS_DIR not in sys.path:
    sys.path.insert(0, _SERVERS_DIR)


class SubprocessManager:
    """管理一个 CAIAO 子进程 Server 的生命周期和通信。

    通过 stdin/stdout JSON 行协议与子进程通信。
    子进程运行 ``run_stdio_loop()`` 循环（见 base.CAIAOServer）。
    """

    def __init__(self, name: str, command: str, args: list[str],
                 cwd: str | None = None, lazy: bool = True):
        self.name = name
        self.command = command
        self.args = args
        self.cwd = cwd
        self.lazy = lazy
        self._process: subprocess.Popen | None = None
        self._req_id = 0

    def start(self) -> list[dict]:
        """启动子进程并获取其工具列表。

        Returns:
            list[dict] — 工具描述列表（name, description, inputSchema）
        """
        if self.is_running:
            return []

        self._process = subprocess.Popen(
            [self.command] + self.args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=self.cwd,
            text=True,
            bufsize=1,
        )

        # 发送 list_tools 获取 Server 能力声明
        return self._send_request("list_tools")

    def call_tool(self, tool_name: str, input_data: dict) -> dict:
        """调用子进程中的工具。

        如果子进程未运行（惰性模式），自动启动。
        """
        if not self.is_running:
            if self.lazy:
                tools = self.start()
                if not self.is_running:
                    return {"error": f"Subprocess '{self.name}' failed to start"}
            else:
                return {"error": f"Subprocess '{self.name}' is not running"}

        return self._send_request("call_tool", {
            "tool_name": tool_name,
            "input": input_data,
        })

    def _send_request(self, method: str, params: dict | None = None) -> Any:
        """发送 JSON 请求到子进程，等待响应。"""
        if not self._process or self._process.stdin is None or self._process.stdout is None:
            raise RuntimeError(f"Subprocess '{self.name}' not connected")

        self._req_id += 1
        request = {
            "method": method,
            "params": params or {},
            "id": self._req_id,
        }

        self._process.stdin.write(json.dumps(request) + "\n")
        self._process.stdin.flush()

        line = self._process.stdout.readline()
        if not line:
            retcode = self._process.poll()
            stderr_out = self._read_stderr()
            raise RuntimeError(
                f"Subprocess '{self.name}' died (rc={retcode}): {stderr_out}"
            )

        response = json.loads(line)
        if "error" in response:
            raise RuntimeError(response["error"])
        return response.get("result")

    def _read_stderr(self) -> str:
        """读取子进程 stderr 中剩余的内容。"""
        try:
            return self._process.stderr.read() if self._process.stderr else ""
        except Exception:
            return ""

    def stop(self):
        """终止子进程。"""
        if self._process and self._process.poll() is None:
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
                self._process.wait(timeout=3)
        self._process = None

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.poll() is None


class Hub:
    """CAIAO 轻量调度中心。

    同时管理 in_process 和 subprocess 两种 Server:

        hub = Hub()                          # 自动扫描 servers/ 注册 in_process Server
        hub.register(MyServer(hub))          # 手动注册 in_process Server
        hub.register_subprocess({...})       # 注册子进程 Server（惰性启动）

        result = hub.call_tool("run_analysis", {...})
        tools  = hub.list_all_tools()
    """

    def __init__(self, server_dir: str | None = None):
        """初始化 Hub，自动扫描并注册所有非子进程 CAIAO Server。

        Args:
            server_dir: servers 目录路径，默认为项目根目录下的 servers/
        """
        self._server_dir = server_dir or _SERVERS_DIR

        # in_process 注册表: tool_name -> {"server": instance, "definition": tool_spec}
        self._tool_registry: dict[str, dict[str, Any]] = {}

        # in_process Server 实例列表
        self._servers: list[Any] = []

        # subprocess 管理器: name -> SubprocessManager
        self._subprocess_managers: dict[str, SubprocessManager] = {}

        # subprocess 注册表: tool_name -> SubprocessManager
        self._subprocess_tool_registry: dict[str, SubprocessManager] = {}

        # 自动发现 in_process Server（跳过 _caiao_subprocess = True 的）
        self._auto_discover()

    # ── 自动发现（in_process）───────────────────────────────────

    def _auto_discover(self):
        """扫描 servers/ 目录，自动发现并实例化所有非子进程 CAIAOServer 子类。"""
        if not os.path.isdir(self._server_dir):
            return

        from servers.base import CAIAOServer

        for filename in os.listdir(self._server_dir):
            if filename.startswith("_") or not filename.endswith(".py"):
                continue

            module_name = filename[:-3]
            if module_name == "base":
                continue

            try:
                module = importlib.import_module(f"servers.{module_name}")
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if not issubclass(obj, CAIAOServer) or obj is CAIAOServer:
                        continue
                    # 跳过标记为子进程的 Server（由 register_subprocess 管理）
                    if getattr(obj, '_caiao_subprocess', False):
                        continue
                    try:
                        instance = obj()
                        self._register_server(instance)
                    except Exception as e:
                        print(f"[Hub] 跳过实例化 {obj.__name__}: {e}")
            except BaseException as e:
                print(f"[Hub] 跳过加载模块 {module_name}: {e}")

    # ── 注册 in_process Server ──────────────────────────────────

    def register(self, server_instance):
        """手动注册一个 in_process CAIAO Server 实例。

        对于需要特殊构造参数（如 hub 引用）的 Server，
        应创建实例后手动注册，而非依赖自动扫描。
        """
        self._register_server(server_instance)

    def _register_server(self, server_instance):
        """内部：将一个 Server 实例的工具注册到工具表。"""
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

    # ── 注册 subprocess Server ──────────────────────────────────

    def register_subprocess(self, config: dict):
        """注册一个子进程 CAIAO Server（惰性启动，首次调用时 spawn）。

        Config 参数:
            name: str             — Server 名称（唯一标识）
            command: str          — 可执行文件，默认 sys.executable
            args: list[str]       — 命令行参数
            cwd: str (可选)       — 工作目录
            lazy: bool (默认 True) — 是否首次调用时再启动
            tools: list[str] (可选) — 已知工具名列表（用于静态注册）

        用法:
            hub.register_subprocess({
                "name": "fea_runner",
                "command": sys.executable,
                "args": ["-u", "-m", "servers.opensees_runner"],
                "cwd": project_root,
                "lazy": True,
                "tools": ["run_analysis"],
            })
        """
        name = config["name"]
        mgr = SubprocessManager(
            name=name,
            command=config.get("command", sys.executable),
            args=config["args"],
            cwd=config.get("cwd"),
            lazy=config.get("lazy", True),
        )
        self._subprocess_managers[name] = mgr

        # 如果有已知工具名，先静态注册（工具实际可用性在首次启动后保证）
        for tool_name in config.get("tools", []):
            self._subprocess_tool_registry[tool_name] = mgr

        print(f"[Hub] 注册子进程 Server '{name}' (lazy={mgr.lazy})")

    def _ensure_subprocess(self, tool_name: str) -> SubprocessManager | None:
        """确保某个工具对应的子进程已经启动。

        Args:
            tool_name: 工具名称

        Returns:
            SubprocessManager 或 None（未注册）
        """
        mgr = self._subprocess_tool_registry.get(tool_name)
        if mgr is None:
            return None

        if mgr.is_running:
            return mgr

        # 惰性启动
        print(f"[Hub] 惰性启动子进程 Server '{mgr.name}'...")
        try:
            tools = mgr.start()
            # 将子进程工具注册到 subprocess_tool_registry
            for tool_def in tools:
                tname = tool_def.get("name", "")
                if tname:
                    self._subprocess_tool_registry[tname] = mgr
            print(f"[Hub] 子进程 '{mgr.name}' 就绪 ({len(tools)} tools)")
            return mgr
        except Exception as e:
            print(f"[Hub] 子进程 '{mgr.name}' 启动失败: {e}")
            return None

    # ── 工具发现与调用 ──────────────────────────────────────────

    def find_tool(self, tool_name: str) -> dict | None:
        """查找工具定义。"""
        # 先查 in_process
        entry = self._tool_registry.get(tool_name)
        if entry:
            return entry["definition"]

        # subprocess 工具需要启动后才能获取完整定义
        mgr = self._subprocess_tool_registry.get(tool_name)
        if mgr:
            return {"name": tool_name, "source": "subprocess", "server": mgr.name}

        return None

    def call_tool(self, tool_name: str, input_data: dict) -> dict:
        """通过 Hub 调用工具。

        自动路由到对应的 Server（in_process 直调 / subprocess stdio）。

        Args:
            tool_name: 工具名称
            input_data: 工具输入参数字典

        Returns:
            工具执行结果字典，含 {"error": "..."} 当失败时
        """
        # 1) 优先 in_process
        entry = self._tool_registry.get(tool_name)
        if entry:
            return entry["server"].call_tool(tool_name, input_data)

        # 2) subprocess（惰性启动）
        mgr = self._ensure_subprocess(tool_name)
        if mgr:
            try:
                result = mgr.call_tool(tool_name, input_data)
                return result if isinstance(result, dict) else {"result": result}
            except Exception as e:
                return {"error": f"Subprocess tool '{tool_name}' failed: {e}"}

        return {
            "error": f"Tool '{tool_name}' not found. "
                     f"Available: {list(self._tool_registry.keys()) + list(self._subprocess_tool_registry.keys())}"
        }

    # ── Server 生命周期 ─────────────────────────────────────────

    def start_all(self):
        """启动所有非惰性的子进程 Server。

        惰性子进程（lazy=True）在首次 call_tool 时自动启动。
        """
        for name, mgr in self._subprocess_managers.items():
            if not mgr.lazy:
                try:
                    tools = mgr.start()
                    for tool_def in tools:
                        tname = tool_def.get("name", "")
                        if tname:
                            self._subprocess_tool_registry[tname] = mgr
                    print(f"[Hub] 子进程 '{name}' 已启动 ({len(tools)} tools)")
                except Exception as e:
                    print(f"[Hub] 子进程 '{name}' 启动失败: {e}")

    def stop_all(self):
        """停止所有子进程 Server。"""
        for name, mgr in self._subprocess_managers.items():
            try:
                mgr.stop()
                print(f"[Hub] 子进程 '{name}' 已停止")
            except Exception as e:
                print(f"[Hub] 子进程 '{name}' 停止异常: {e}")

    # ── 查询 ────────────────────────────────────────────────────

    def list_all_tools(self) -> list[dict]:
        """列出所有已注册工具的完整定义列表（含子进程中已发现的）。"""
        tools = [entry["definition"] for entry in self._tool_registry.values()]

        # 对 subprocess 工具，仅列出已启动的
        started = {mgr.name for mgr in self._subprocess_managers.values() if mgr.is_running}
        for tname, mgr in self._subprocess_tool_registry.items():
            if mgr.name in started:
                tools.append({"name": tname, "source": "subprocess", "server": mgr.name})

        return tools

    def list_server_names(self) -> list[str]:
        """列出所有已注册 Server 的标识。"""
        names = [s.__class__.__name__ for s in self._servers]
        names += list(self._subprocess_managers.keys())
        return names

    def get_server_count(self) -> int:
        return len(self._servers) + len(self._subprocess_managers)

    def get_tool_count(self) -> int:
        return len(self._tool_registry) + len(self._subprocess_tool_registry)
