"""CAIAO Server 单元测试 (v2.0)

测试覆盖：
- 原子 Server (5 个): 建模、荷载、分析、校核、报告
- 新 Server (v2.0+): 3D导出、llm-gateway(元数据)、LLM参数提取(纯计算)、LLM Agent编排(纯编排)
- CAIAO Hub: 自动发现、工具路由
- Pipeline: 直接模式 + Hub 调度模式
- get_metadata(): 所有 Server 元数据验证
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ── 原始 5 个原子 Server 测试 ─────────────────────────────────────

def test_frame_generator():
    """测试模型生成器"""
    from servers.steel_frame_generator import SteelFrameGenerator
    s = SteelFrameGenerator()
    result = s.call_tool("generate_frame", {
        "grid_x": [6.0, 6.0],
        "grid_y": [6.0],
        "num_stories": 2,
        "story_heights": [4.0, 3.5],
    })
    assert "error" not in result
    assert len(result["nodes"]) == 18  # (2+1) levels × 3×2 grid = 18
    assert len(result["elements"]) > 0
    node_ids = [n["id"] for n in result["nodes"]]
    assert node_ids == list(range(1, len(node_ids) + 1))
    nids = set(node_ids)
    for el in result["elements"]:
        assert el["node_i"] in nids
        assert el["node_j"] in nids


def test_load_generator():
    """测试荷载生成器"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.steel_load_generator import SteelLoadGenerator
    gen = SteelFrameGenerator()
    model = gen.call_tool("generate_frame", {
        "grid_x": [6.0, 6.0], "grid_y": [6.0],
        "num_stories": 2, "story_heights": [4.0, 3.5],
    })
    loader = SteelLoadGenerator()
    result = loader.call_tool("apply_loads", {"model": model})
    assert "error" not in result
    assert "load_cases" in result
    assert len(result["load_cases"]) >= 2
    assert "boundary_conditions" in result
    assert len(result["boundary_conditions"]) > 0


def test_runner():
    """测试分析运行器"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.steel_load_generator import SteelLoadGenerator
    from servers.opensees_runner import OpenSeesRunner
    gen = SteelFrameGenerator()
    loader = SteelLoadGenerator()
    runner = OpenSeesRunner()
    model = gen.call_tool("generate_frame", {
        "grid_x": [6.0], "grid_y": [6.0],
        "num_stories": 1, "story_heights": [4.0],
    })
    loaded = loader.call_tool("apply_loads", {"model": model})
    result = runner.call_tool("run_analysis", {
        "loaded_model": loaded, "load_case_name": "Dead"
    })
    assert "error" not in result
    assert "displacements" in result
    assert "element_forces" in result
    assert result["summary"]["max_displacement"] >= 0


def test_code_check():
    """测试规范校核"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.steel_load_generator import SteelLoadGenerator
    from servers.opensees_runner import OpenSeesRunner
    from servers.steel_code_check import SteelCodeCheck
    gen = SteelFrameGenerator()
    loader = SteelLoadGenerator()
    runner = OpenSeesRunner()
    checker = SteelCodeCheck()
    model = gen.call_tool("generate_frame", {
        "grid_x": [6.0], "grid_y": [6.0],
        "num_stories": 1, "story_heights": [4.0],
    })
    loaded = loader.call_tool("apply_loads", {"model": model})
    analysis = []
    for lc in ["Dead", "Live"]:
        r = runner.call_tool("run_analysis", {
            "loaded_model": loaded, "load_case_name": lc
        })
        analysis.append(r)
    result = checker.call_tool("check_code", {
        "model": model, "analysis_results": analysis
    })
    assert "error" not in result
    assert "elements" in result
    assert "summary" in result
    assert result["summary"]["total_elements"] > 0


def test_report_generator():
    """测试报告生成"""
    from servers.report_generator import ReportGenerator
    import tempfile
    reporter = ReportGenerator()
    fake_check = {
        "elements": [
            {"id": 1, "stress_ratio": 0.5, "stability_ratio": 0.3,
             "deflection_ratio": 0.1, "slenderness_ratio": 80.0,
             "pass": True, "messages": []}
        ],
        "summary": {"total_elements": 1, "passed": 1, "failed": 0,
                     "max_stress_ratio": 0.5, "max_deflection_ratio": 0.1}
    }
    output = os.path.join(tempfile.gettempdir(), "steel_frame_test_report.html")
    result = reporter.call_tool("generate_report", {
        "check_results": fake_check,
        "model_meta": {"name": "Test"},
        "load_case_names": ["Dead"],
        "output_path": output
    })
    assert "error" not in result
    assert os.path.exists(output)
    with open(output, "r", encoding="utf-8") as f:
        content = f.read()
    assert "校核" in content or "check" in content.lower()
    os.remove(output)


def test_pipeline():
    """测试全流程管线（直接模式，保持向后兼容）"""
    from servers.steel_frame_pipeline import SteelFramePipeline
    pipeline = SteelFramePipeline()
    result = pipeline.call_tool("run_full_pipeline", {
        "grid_x": [6.0, 6.0],
        "grid_y": [6.0],
        "num_stories": 2,
        "story_heights": [4.0, 3.5],
        "name": "Test"
    })
    assert "error" not in result
    assert result["status"] == "completed"
    assert "report_path" in result
    assert os.path.exists(result["report_path"])


def test_list_tools():
    """测试所有 Server 的 list_tools"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.steel_load_generator import SteelLoadGenerator
    from servers.opensees_runner import OpenSeesRunner
    from servers.steel_code_check import SteelCodeCheck
    from servers.report_generator import ReportGenerator
    from servers.steel_frame_pipeline import SteelFramePipeline

    for cls in [SteelFrameGenerator, SteelLoadGenerator, OpenSeesRunner,
                SteelCodeCheck, ReportGenerator, SteelFramePipeline]:
        s = cls()
        tools = s.list_tools()
        assert isinstance(tools, list), f"{cls.__name__} list_tools not a list"
        assert len(tools) > 0, f"{cls.__name__} has no tools"
        for t in tools:
            assert "name" in t
            assert "description" in t
            assert "inputSchema" in t


# ── v2.0 新测试 ────────────────────────────────────────────────────

def test_get_metadata():
    """测试所有 Server 的 get_metadata() (v2.0)"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.steel_load_generator import SteelLoadGenerator
    from servers.opensees_runner import OpenSeesRunner
    from servers.steel_code_check import SteelCodeCheck
    from servers.report_generator import ReportGenerator
    from servers.steel_frame_pipeline import SteelFramePipeline
    from servers.three_d_exporter import ThreeDExporter
    from servers.llm_param_extractor import LLMParamExtractor
    from servers.llm_agent_orchestrator import LLMAgentOrchestrator
    from servers.llm_gateway import LLMGateway
    from servers.cli_orchestrator import CliOrchestrator

    all_servers = [
        SteelFrameGenerator(), SteelLoadGenerator(), OpenSeesRunner(),
        SteelCodeCheck(), ReportGenerator(), SteelFramePipeline(),
        ThreeDExporter(), LLMParamExtractor(), LLMAgentOrchestrator(),
        LLMGateway(), CliOrchestrator(),
    ]
    for s in all_servers:
        meta = s.get_metadata()
        assert isinstance(meta, dict), f"{s.__class__.__name__} metadata not a dict"
        assert "name" in meta, f"{s.__class__.__name__} missing name"
        assert "version" in meta
        assert "category" in meta
        assert "tools" in meta
        assert "dependencies" in meta
        assert "compatibility" in meta
        assert meta["compatibility"]["caiao_spec"] == "1.0"


def test_hub_auto_discover():
    """测试 Hub 自动发现和工具路由"""
    from caiao_hub import Hub
    hub = Hub()
    assert hub.get_server_count() >= 5, f"Expected >=5 servers, got {hub.get_server_count()}"
    assert hub.get_tool_count() >= 5

    # 验证核心工具可发现（in_process 工具；run_analysis 为子进程工具，需显式注册）
    for tool_name in ["generate_frame", "apply_loads",
                       "check_code", "generate_report"]:
        tool_def = hub.find_tool(tool_name)
        assert tool_def is not None, f"Tool '{tool_name}' not found in Hub"
        assert "name" in tool_def
        assert "description" in tool_def

    # 子进程工具不会自动发现，需通过 register_subprocess 注册后验证路由
    hub.register_subprocess({
        "name": "fea_runner",
        "command": sys.executable,
        "args": ["-u", "-m", "servers.opensees_runner"],
        "lazy": True,
        "tools": ["run_analysis"],
    })
    assert hub.find_tool("run_analysis") is not None, "Subprocess tool 'run_analysis' should be routable after register_subprocess"


def test_hub_call_tool():
    """测试 Hub 调用工具"""
    from caiao_hub import Hub
    hub = Hub()

    result = hub.call_tool("generate_frame", {
        "grid_x": [6.0], "grid_y": [6.0],
        "num_stories": 1, "story_heights": [4.0],
    })
    assert "error" not in result
    assert "nodes" in result
    assert "elements" in result
    assert len(result["nodes"]) > 0
    assert len(result["elements"]) > 0


def test_hub_invalid_tool():
    """测试 Hub 调用不存在的工具"""
    from caiao_hub import Hub
    hub = Hub()
    result = hub.call_tool("nonexistent_tool", {})
    assert "error" in result


def test_3d_export():
    """测试 3D 数据导出"""
    from servers.steel_frame_generator import SteelFrameGenerator
    from servers.three_d_exporter import ThreeDExporter
    gen = SteelFrameGenerator()
    model = gen.call_tool("generate_frame", {
        "grid_x": [6.0], "grid_y": [6.0],
        "num_stories": 1, "story_heights": [4.0],
    })
    exporter = ThreeDExporter()
    result = exporter.call_tool("export_3d_model", {"model": model})
    assert "error" not in result
    assert "three_d_data" in result
    data = result["three_d_data"]
    assert "nodes" in data
    assert "elements" in data
    assert "bounding_box" in data
    assert "section_dimensions" in data


def test_pipeline_through_hub():
    """测试通过 Hub 调度的全流程管线"""
    from caiao_hub import Hub
    from servers.steel_frame_pipeline import SteelFramePipeline

    hub = Hub()
    pipeline = SteelFramePipeline(hub)
    hub.register(pipeline)

    # 注册子进程求解器（run_analysis 为计算型 Server，不参与自动发现）
    hub.register_subprocess({
        "name": "fea_runner",
        "command": sys.executable,
        "args": ["-u", "-m", "servers.opensees_runner"],
        "lazy": True,
        "tools": ["run_analysis"],
    })

    result = hub.call_tool("run_full_pipeline", {
        "grid_x": [6.0], "grid_y": [6.0],
        "num_stories": 1, "story_heights": [4.0],
        "name": "HubTest"
    })
    assert "error" not in result, f"Pipeline failed: {result.get('error')}"
    assert result["status"] == "completed"
    assert os.path.exists(result["report_path"])


def test_cli_orchestrator():
    """测试 CLI 编排器（工程模式）"""
    from caiao_hub import Hub
    from servers.cli_orchestrator import CliOrchestrator

    hub = Hub()
    orchestrator = CliOrchestrator(hub)
    hub.register(orchestrator)

    result = hub.call_tool("run_cli_command", {
        "mode": "engineering",
        "quick": True,
        "output_dir": "./output",
    })
    assert "error" not in result, f"CLI orchestrator failed: {result.get('error')}"
    eng_result = result.get("result", {})
    assert eng_result.get("status") == "completed"


# ── v2.0 CAIAO 化 LLM 层测试 ──────────────────────────────────────

def test_llm_gateway_metadata():
    """测试 llm-gateway 元数据和工具列表（纯计算，无网络）"""
    from servers.llm_gateway import LLMGateway
    gateway = LLMGateway()

    # 元数据
    meta = gateway.get_metadata()
    assert meta["name"] == "llm-gateway"
    assert meta["category"] == "ai_interface"
    assert meta["compatibility"]["caiao_spec"] == "1.0"

    # 工具有两个：chat_completion + stream_chat
    tools = gateway.list_tools()
    assert len(tools) >= 2
    tool_names = {t["name"] for t in tools}
    assert "chat_completion" in tool_names
    assert "stream_chat" in tool_names

    # 验证 input_schema 完备
    for t in tools:
        assert "description" in t
        assert "inputSchema" in t
        assert t["inputSchema"]["type"] == "object"


def test_llm_gateway_no_api_key():
    """测试 llm-gateway 在无 API Key 时返回明确的错误"""
    from servers.llm_gateway import LLMGateway
    gateway = LLMGateway()

    # 不设环境变量，不传入 api_key
    result = gateway.call_tool("chat_completion", {
        "messages": [{"role": "user", "content": "hello"}],
    })
    assert "error" in result
    assert "API key" in result["error"]


def test_llm_param_extractor_pure_computation():
    """测试 llm-param-extractor 在无 Hub 时返回合理的错误（纯计算 Server 校验）"""
    from servers.llm_param_extractor import LLMParamExtractor
    extractor = LLMParamExtractor()  # hub=None

    result = extractor.call_tool("extract_params_from_text", {
        "prompt": "test",
    })
    # 因为 hub=None，应提示需要 Hub
    assert "error" in result
    assert "Hub" in result["error"]


def test_llm_agent_orchestrator_metadata():
    """测试 llm-agent-orchestrator 元数据（纯编排 Server）"""
    from servers.llm_agent_orchestrator import LLMAgentOrchestrator
    orch = LLMAgentOrchestrator()

    meta = orch.get_metadata()
    assert meta["name"] == "llm-agent-orchestrator"
    assert meta["category"] == "orchestration"
    assert len(meta["tools"]) == 1
    assert meta["tools"][0]["name"] == "execute_with_llm"


def test_llm_agent_orchestrator_no_hub():
    """测试 llm-agent-orchestrator 在无 Hub 时返回错误"""
    from servers.llm_agent_orchestrator import LLMAgentOrchestrator
    orch = LLMAgentOrchestrator()  # hub=None

    result = orch.call_tool("execute_with_llm", {
        "prompt": "test",
    })
    assert "error" in result
    assert "Hub" in result["error"]


if __name__ == "__main__":
    tests = [
        test_frame_generator, test_load_generator, test_runner,
        test_code_check, test_report_generator, test_pipeline, test_list_tools,
        # v2.0 新测试
        test_get_metadata, test_hub_auto_discover, test_hub_call_tool,
        test_hub_invalid_tool, test_3d_export, test_pipeline_through_hub,
        test_cli_orchestrator,
        # v2.0 CAIAO 化 LLM 层测试
        test_llm_gateway_metadata, test_llm_gateway_no_api_key,
        test_llm_param_extractor_pure_computation,
        test_llm_agent_orchestrator_metadata, test_llm_agent_orchestrator_no_hub,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {t.__name__}: {e}")
    print(f"\n{passed}/{len(tests)} tests passed")

