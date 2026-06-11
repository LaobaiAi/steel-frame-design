"""
Generate CLI demo terminal GIF via Playwright.
Renders a terminal-style HTML page showing the CLI pipeline output.
"""

import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ASSETS_DIR = Path(__file__).resolve().parent.parent / "docs" / "assets"

# Terminal output content (simulated clean version)
CLI_OUTPUT = [
    ("+------------------------------------------------+", "green"),
    ("|  Steel Frame Design v2.0 — CAIAO Standard       |", "cyan"),
    ("|  Now: Modeling -> Loads -> FEA -> Check -> Report |", "cyan"),
    ("|  Mode: engineering | llm-param | llm-agent       |", "cyan"),
    ("+------------------------------------------------+", "green"),
    ("", ""),
    ("     ... Initializing CAIAO Hub, auto-registering Servers...", "yellow"),
    ("     ... Hub ready: 14 Servers, 14 tools", "green"),
    ("     ... Running engineering mode...", "yellow"),
    ("", ""),
    ("    done  Generate model: 60 nodes, 116 elements", "green"),
    ("    done  Apply loads: Dead, Live, Wind, Seismic", "green"),
    ("    done  FEA Dead: max disp = 0.0105 m", "cyan"),
    ("    done  FEA Live: max disp = 0.0128 m", "cyan"),
    ("    done  FEA Wind: max disp = 0.0127 m", "cyan"),
    ("    done  FEA Seismic: max disp = 0.0354 m", "cyan"),
    ("    done  Code check (GB50017): 116/116 passed", "green"),
    ("    done  Generate report: output/report.html", "green"),
    ("    done  Export 3D data: output/model_3d.json", "green"),
    ("", ""),
    ("     Check Summary", "white"),
    ("+---------------------+", "green"),
    ("| Metric       | Value |", "white"),
    ("+---------------------+", "green"),
    ("| Total        | 116   |", "white"),
    ("| Passed       | 116   |", "green"),
    ("| Failed       | 0     |", "red"),
    ("| Max ratio    | 0.616 |", "yellow"),
    ("| Max drift    | 0.343 |", "yellow"),
    ("+---------------------+", "green"),
    ("", ""),
    ("Output files:", "white"),
    ("  model.json         - Frame model", "white"),
    ("  loaded_model.json  - Loaded model", "white"),
    ("  check_results.json - GB50017 results", "white"),
    ("  report.html        - HTML report", "white"),
    ("  3d_data.json       - Three.js 3D data", "white"),
]

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><style>
body {{
    margin: 0; padding: 20px;
    background: #0d1117;
    font-family: 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.5;
}}
.terminal {{
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}}
.title-bar {{
    background: #21262d;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #30363d;
}}
.dot {{
    width: 12px; height: 12px; border-radius: 50%;
}}
.dot-r {{ background: #ff5f56; }}
.dot-y {{ background: #ffbd2e; }}
.dot-g {{ background: #27c93f; }}
.title-text {{
    color: #8b949e;
    font-size: 12px;
    margin-left: 8px;
}}
.content {{
    padding: 16px 20px;
}}
.line {{
    white-space: pre;
    min-height: 21px;
}}
.green {{ color: #3fb950; }}
.cyan {{ color: #79c0ff; }}
.yellow {{ color: #d29922; }}
.red {{ color: #f85149; }}
.white {{ color: #e6edf3; }}
.prompt {{ color: #7ee787; }}
</style></head>
<body>
<div class="terminal">
    <div class="title-bar">
        <span class="dot dot-r"></span>
        <span class="dot dot-y"></span>
        <span class="dot dot-g"></span>
        <span class="title-text">steel-frame-design — python cli/main.py run --quick</span>
    </div>
    <div class="content">
        <div class="line"><span class="prompt">$</span> <span class="white">python cli/main.py run --quick</span></div>
        {lines}
    </div>
</div>
</body>
</html>
"""


def main():
    lines_html = ""
    for text, color in CLI_OUTPUT:
        if text:
            lines_html += f'        <div class="line"><span class="{color}">{text}</span></div>\n'
        else:
            lines_html += '        <div class="line">&nbsp;</div>\n'

    html = HTML_TEMPLATE.format(lines=lines_html)

    html_path = ASSETS_DIR / "_cli_demo.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 820, "height": 700},
            device_scale_factor=2,
        )
        page.goto(f"file://{html_path.resolve()}")
        page.wait_for_load_state("networkidle")
        time.sleep(0.5)

        # Save as PNG
        out = ASSETS_DIR / "demo-cli.png"
        page.screenshot(path=str(out))
        print(f"[OK] demo-cli.png ({out.stat().st_size} bytes)")

        browser.close()

    # Cleanup temp HTML
    html_path.unlink()


if __name__ == "__main__":
    main()
