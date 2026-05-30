"""
钢框架全流程演示 CLI 工具 (v2.0 — CAIAO Standard)

用法:
    python cli/main.py run --input examples/sample.yaml --output-dir ./output
    python cli/main.py run --quick
    python cli/main.py run --mode llm-agent --prompt "设计一个三层钢框架..." --api-key sk-xxx

v2.0 变化:
    - 通过 caiao_hub.Hub 统一调度所有 Server
    - 支持 engineering / llm-param / llm-agent 三种模式
    - CLI 自身不含任何流程逻辑，仅解析参数并委托给 Hub
"""

import os
import sys

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from caiao_hub import Hub
from servers.cli_orchestrator import CliOrchestrator

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    RICH = True
except ImportError:
    RICH = False


def print_step(msg: str, status: str = "..."):
    if RICH:
        console = Console()
        color = {"done": "green", "error": "red"}.get(status, "cyan")
        console.print(f"  [{color}]{status:>6}[/{color}] {msg}")
    else:
        print(f"  [{status}] {msg}")


def print_header():
    if RICH:
        console = Console()
        console.print(Panel.fit(
            "[bold cyan]Steel Frame Design v2.0[/bold cyan] — CAIAO Standard\n"
            "钢框架全流程：建模 → 荷载 → 分析 → 校核 → 报告\n"
            "模式：[cyan]engineering[/cyan] | [yellow]llm-param[/yellow] | [magenta]llm-agent[/magenta]",
            border_style="blue"
        ))
    else:
        print("=" * 60)
        print("  Steel Frame Design v2.0 — CAIAO Standard")
        print("  钢框架全流程：建模 → 荷载 → 分析 → 校核 → 报告")
        print("  模式: engineering | llm-param | llm-agent")
        print("=" * 60)


def show_help():
    print_header()
    print("\n用法:")
    print("  python cli/main.py run --quick")
    print("  python cli/main.py run --input <yaml> [--output-dir <dir>]")
    print("  python cli/main.py run --mode llm-agent --prompt \"<描述>\" --api-key <key>")
    print("  python cli/main.py hub-info")
    print("\n命令:")
    print("  run           运行钢框架设计全流程")
    print("  hub-info      显示 Hub 中注册的 Server 和工具")
    print("\n选项 (run):")
    print("  --mode, -m        运行模式: engineering(默认) / llm-param / llm-agent")
    print("  --input, -i       输入参数 YAML 文件（engineering 模式）")
    print("  --output-dir, -o  输出目录 (默认: ./output)")
    print("  --quick, -q       使用快速演示参数")
    print("  --prompt, -p      自然语言设计描述（llm-param / llm-agent 模式）")
    print("  --api-key          LLM API 密钥")
    print("  --model            LLM 模型名称 (默认: gpt-4o-mini)")
    print("  --base-url         LLM API 地址")


def show_hub_info(hub: Hub):
    """显示 Hub 注册信息。"""
    print_header()
    print(f"\n已注册 Server: {hub.get_server_count()} 个")
    print(f"已注册工具:   {hub.get_tool_count()} 个")
    print("\n" + "-" * 50)

    for name in hub.list_server_names():
        entry = hub._tool_registry
        # 找到属于该 Server 的工具
        server_tools = []
        for tool_name, info in entry.items():
            if info["server"].__class__.__name__ == name:
                server_tools.append((tool_name, info["definition"]["description"]))

        if server_tools:
            print(f"\n📦 {name}")
            for tn, td in server_tools:
                print(f"   └─ {tn}: {td[:80]}")


def main():
    args = sys.argv[1:]

    if len(args) == 0:
        show_help()
        return

    command = args[0]

    if command == "hub-info":
        hub = Hub()
        show_hub_info(hub)
        return

    if command != "run":
        print(f"未知命令: {command}")
        return

    # ── 解析参数 ─────────────────────────────────────────────
    mode = "engineering"
    input_file = None
    output_dir = "./output"
    quick = False
    prompt = None
    api_key = os.environ.get("OPENAI_API_KEY", "")
    model = "gpt-4o-mini"
    base_url = None

    i = 1
    while i < len(args):
        if args[i] in ("--mode", "-m") and i + 1 < len(args):
            mode = args[i + 1]
            i += 2
        elif args[i] in ("--input", "-i") and i + 1 < len(args):
            input_file = args[i + 1]
            i += 2
        elif args[i] in ("--output-dir", "-o") and i + 1 < len(args):
            output_dir = args[i + 1]
            i += 2
        elif args[i] in ("--quick", "-q"):
            quick = True
            i += 1
        elif args[i] in ("--prompt", "-p") and i + 1 < len(args):
            prompt = args[i + 1]
            i += 2
        elif args[i] == "--api-key" and i + 1 < len(args):
            api_key = args[i + 1]
            i += 2
        elif args[i] == "--model" and i + 1 < len(args):
            model = args[i + 1]
            i += 2
        elif args[i] == "--base-url" and i + 1 < len(args):
            base_url = args[i + 1]
            i += 2
        else:
            i += 1

    print_header()

    # ── 初始化 Hub 并注册编排器 ──────────────────────────────
    print_step("初始化 CAIAO Hub，自动发现 Server...")
    hub = Hub()

    # 手动注册需要 hub 的合并 Server
    orchestrator = CliOrchestrator(hub)
    hub.register(orchestrator)

    # 注册需要 hub 引用的 Server（覆盖自动发现的 hub=None 实例）
    from servers.llm_agent_orchestrator import LLMAgentOrchestrator
    from servers.llm_param_extractor import LLMParamExtractor

    agent_orch = LLMAgentOrchestrator(hub)
    param_extractor = LLMParamExtractor(hub)
    hub.register(agent_orch)
    hub.register(param_extractor)  # 覆盖自动发现的实例，使提取器可通过 Hub 调 llm_gateway

    print_step(f"Hub 就绪: {hub.get_server_count()} Server, {hub.get_tool_count()} 工具")

    # ── 构建参数 ─────────────────────────────────────────────
    if mode == "engineering" and not input_file and not quick:
        quick = True  # 无输入文件时默认 quick

    llm_config = None
    if mode in ("llm-param", "llm-agent"):
        llm_config = {"api_key": api_key, "model": model}
        if base_url:
            llm_config["base_url"] = base_url

    cli_input = {
        "mode": mode,
        "input_file": input_file,
        "output_dir": output_dir,
        "prompt": prompt,
        "llm_config": llm_config,
        "quick": quick,
    }

    # ── 执行 ─────────────────────────────────────────────────
    if mode == "engineering":
        print_step("启动工程模式...")
    elif mode == "llm-param":
        print_step(f"启动 LLM 参数提取模式 (model={model})...")
    elif mode == "llm-agent":
        print_step(f"启动 LLM Agent 模式 (model={model})...")

    result = hub.call_tool("run_cli_command", cli_input)

    if "error" in result:
        print_step(f"执行失败: {result['error']}", "error")
        return

    # ── 显示结果 ─────────────────────────────────────────────
    if mode == "engineering" or mode == "llm-param":
        pipeline = result.get("result", {})
        for step in pipeline.get("steps", []):
            step_name = step["step"]
            if step_name == "generate_frame":
                print_step(f"生成模型: {step['nodes']} 节点, {step['elements']} 单元", "done")
            elif step_name == "apply_loads":
                print_step(f"施加荷载: {step['load_cases']}", "done")
            elif step_name.startswith("run_analysis"):
                lc = step_name.split("/")[-1]
                print_step(f"分析 {lc}: max disp = {step['max_disp']:.6f} m", "done")
            elif step_name == "check_code":
                print_step(f"规范校核: {step['passed']}/{step['passed']+step['failed']} 通过", "done")
            elif step_name == "generate_report":
                print_step(f"生成报告: {step['path']}", "done")

        if "three_d_path" in pipeline:
            print_step(f"导出 3D 数据: {pipeline['three_d_path']}", "done")

        if RICH:
            console = Console()
            summary = pipeline["check_results"]["summary"]
            table = Table(title="校核结果汇总")
            table.add_column("指标", style="cyan")
            table.add_column("值", style="green")
            table.add_row("总构件数", str(summary["total_elements"]))
            table.add_row("通过数", str(summary["passed"]))
            table.add_row("未通过数", str(summary["failed"]))
            table.add_row("最大应力比", f"{summary['max_stress_ratio']:.4f}")
            table.add_row("最大挠度比", f"{summary['max_deflection_ratio']:.4f}")
            console.print("\n")
            console.print(table)
        else:
            s = pipeline["check_results"]["summary"]
            print(f"\n{'='*40}")
            print(f"校核结果: {s['passed']}/{s['total_elements']} 通过")
            print(f"最大应力比: {s['max_stress_ratio']:.4f}")
            print(f"最大挠度比: {s['max_deflection_ratio']:.4f}")

        print("\n输出文件:")
        for name, path in pipeline.get("output_files", {}).items():
            print(f"  {name}: {path}")
        print(f"\n完成！报告: {pipeline.get('report_path', '')}")

    elif mode == "llm-agent":
        agent = result.get("result", {})
        final = agent.get("final_response", "")
        all_steps = agent.get("steps", [])
        print(f"\nLLM Agent 响应:\n{final}\n")
        print(f"执行步骤 ({len(all_steps)} 步):")
        for s in all_steps:
            if s.get("type") == "tool_call":
                summary = s.get("result_summary", {})
                if "error" in summary:
                    print(f"  [{s.get('tool')}] ERROR: {summary['error']}")
                else:
                    print(f"  [{s.get('tool')}] {summary}")
            elif s.get("type") == "final_response":
                print("  [Agent] 最终回复")


if __name__ == "__main__":
    main()
