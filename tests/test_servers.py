"""原子 Server 单元测试"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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
    # 验证节点编号连续
    node_ids = [n["id"] for n in result["nodes"]]
    assert node_ids == list(range(1, len(node_ids) + 1))
    # 验证单元引用有效
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
    assert len(result["load_cases"]) >= 2  # Dead + Live at minimum
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
    from servers.steel_code_check import SteelCodeCheck
    from servers.report_generator import ReportGenerator
    import tempfile

    checker = SteelCodeCheck()
    reporter = ReportGenerator()

    # 构建最小校核结果
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
    """测试全流程管线"""
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


if __name__ == "__main__":
    tests = [
        test_frame_generator,
        test_load_generator,
        test_runner,
        test_code_check,
        test_report_generator,
        test_pipeline,
        test_list_tools,
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
