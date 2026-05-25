"""
钢框架全流程演示 CLI 工具

用法:
    python cli/main.py run --input examples/sample.yaml --output-dir ./output
    python cli/main.py run --quick  # 使用默认参数快速演示
"""

import sys
import os
import yaml

# 确保项目根目录在 sys.path 中
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from servers.steel_frame_pipeline import SteelFramePipeline

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
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
            "[bold cyan]Steel Frame Design[/bold cyan] — CAIAO 原子 Server 演示\n"
            "钢框架全流程：建模 → 荷载 → 分析 → 校核 → 报告",
            border_style="blue"
        ))
    else:
        print("=" * 60)
        print("  Steel Frame Design — CAIAO 原子 Server 演示")
        print("  钢框架全流程：建模 → 荷载 → 分析 → 校核 → 报告")
        print("=" * 60)


def main():
    args = sys.argv[1:]

    if len(args) == 0:
        print_header()
        print("\n用法:")
        print("  python cli/main.py run --input <yaml> [--output-dir <dir>]")
        print("  python cli/main.py run --quick")
        print("\n选项:")
        print("  --input, -i      输入参数 YAML 文件")
        print("  --output-dir, -o 输出目录 (默认: ./output)")
        print("  --quick, -q      使用默认参数快速演示")
        return

    if args[0] != "run":
        print(f"未知命令: {args[0]}")
        return

    input_file = None
    output_dir = "./output"
    quick = False

    i = 1
    while i < len(args):
        if args[i] in ("--input", "-i") and i + 1 < len(args):
            input_file = args[i + 1]
            i += 2
        elif args[i] in ("--output-dir", "-o") and i + 1 < len(args):
            output_dir = args[i + 1]
            i += 2
        elif args[i] in ("--quick", "-q"):
            quick = True
            i += 1
        else:
            i += 1

    print_header()

    # 加载参数
    if input_file:
        try:
            with open(input_file, "r", encoding="utf-8") as f:
                params = yaml.safe_load(f)
            print(f"\n从文件加载参数: {input_file}")
        except FileNotFoundError:
            print(f"\n[错误] 文件不存在: {input_file}")
            return
        except Exception as e:
            print(f"\n[错误] 读取 YAML 失败: {e}")
            return
    elif quick:
        params = {
            "grid_x": [6.0, 6.0, 6.0],
            "grid_y": [6.0, 6.0],
            "num_stories": 4,
            "story_heights": [4.0, 3.5, 3.5, 3.5],
            "column_section": "HW350x350x12x19",
            "beam_section": "HM340x250x9x14",
            "material": "Q355",
            "name": "示例办公楼",
            "dead_load": 2.0,
            "live_load": 3.0,
            "wind_pressure": 0.45,
            "seismic_intensity": 0.08,
            "output_dir": output_dir
        }
        print("\n使用快速演示参数（4层办公楼，3×2跨）")
    else:
        params = {
            "grid_x": [6.0, 6.0],
            "grid_y": [6.0],
            "num_stories": 3,
            "story_heights": [4.0, 3.5, 3.5],
            "column_section": "HW350x350x12x19",
            "beam_section": "HM340x250x9x14",
            "material": "Q235",
            "name": "示例框架",
            "dead_load": 1.5,
            "live_load": 2.0,
            "wind_pressure": 0.45,
            "seismic_intensity": 0.08,
            "output_dir": output_dir
        }
        print("\n使用默认参数（3层框架，3×2跨）")

    params["output_dir"] = output_dir

    # 执行全流程
    pipeline = SteelFramePipeline()
    print_step(f"启动全流程管线...")

    result = pipeline.call_tool("run_full_pipeline", params)

    if "error" in result:
        print_step(f"管线执行失败: {result['error']}", "error")
        return

    # 显示步骤结果
    for step in result.get("steps", []):
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

    # 输出汇总
    if RICH:
        console = Console()
        summary = result["check_results"]["summary"]
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
        s = result["check_results"]["summary"]
        print(f"\n{'='*40}")
        print(f"校核结果: {s['passed']}/{s['total_elements']} 通过")
        print(f"最大应力比: {s['max_stress_ratio']:.4f}")
        print(f"最大挠度比: {s['max_deflection_ratio']:.4f}")

    print(f"\n输出文件:")
    for name, path in result["output_files"].items():
        print(f"  {name}: {path}")

    print(f"\n完成！报告: {result['report_path']}")


if __name__ == "__main__":
    main()
