"""
Playwright screenshot capture for XuanwuAI Steel Frame Design.

Usage:
  python scripts/take_screenshots.py

Requires:
  pip install playwright
  python -m playwright install chromium
"""

import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ASSETS_DIR = Path(__file__).resolve().parent.parent / "docs" / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

FRONTEND_URL = "http://localhost:3000"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def take_screenshot(page, name: str, **kwargs):
    path = ASSETS_DIR / name
    page.screenshot(path=str(path), **kwargs)
    print(f"  [OK] {name} ({os.path.getsize(path)} bytes)")
    return path


def wait_for_app(page):
    page.wait_for_load_state("networkidle")
    time.sleep(1)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            device_scale_factor=2,
        )
        page = context.new_page()

        # ── 1. Hero / Landing Page (full page) ──
        print("[1/6] Capturing hero landing page...")
        page.goto(FRONTEND_URL)
        wait_for_app(page)
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(1.5)
        take_screenshot(page, "screenshot-hero.png", full_page=True)

        # ── 2. Click into the design flow ──
        print("[2/6] Clicking '开始使用' to enter design flow...")
        try:
            start_btn = page.get_by_text("开始使用")
            start_btn.first.click()
            print("  Clicked '开始使用'")
        except Exception:
            try:
                page.locator("button:has-text('开始使用')").first.click()
            except Exception as e:
                print(f"  [WARN] Could not click start: {e}")

        wait_for_app(page)
        time.sleep(1)

        # We should now be in the InputPanel

        # ── 3. Submit the form to run pipeline ──
        print("[3/6] Running pipeline via '生成并分析'...")
        try:
            run_btn = page.get_by_text("生成并分析")
            run_btn.click()
            print("  Clicked '生成并分析', pipeline running...")
        except Exception:
            try:
                page.locator("button:has-text('生成并分析')").click()
            except Exception as e:
                print(f"  [WARN] Could not click run: {e}")

        # Wait for pipeline to complete (background task, might take a while)
        print("  Waiting for pipeline...")
        time.sleep(8)

        # ── 4. Take screenshot at current step (likely modeling with 3D view) ──
        print("[4/6] Capturing 3D viewer...")
        take_screenshot(page, "screenshot-3d-viewer.png")

        # Navigate to loads step
        for _ in range(3):
            try:
                next_btn = page.get_by_text("下一步").first
                if next_btn.is_visible(timeout=500):
                    next_btn.click()
                    time.sleep(2)
            except Exception:
                pass
            try:
                sidebar_tab = page.locator("text=荷载施加")
                if sidebar_tab.is_visible(timeout=500):
                    sidebar_tab.click()
                    time.sleep(1)
            except Exception:
                pass

        time.sleep(2)
        take_screenshot(page, "screenshot-loads.png")

        # Navigate to check/results step
        for _ in range(3):
            try:
                next_btn = page.get_by_text("下一步").first
                if next_btn.is_visible(timeout=500):
                    next_btn.click()
                    time.sleep(2)
            except Exception:
                pass

        time.sleep(2)
        take_screenshot(page, "screenshot-storyboard.png")

        # ── 5. Report HTML ──
        print("[5/6] Capturing HTML report...")
        report_path = OUTPUT_DIR / "report.html"
        if report_path.exists():
            page.goto(f"file://{report_path.resolve()}")
            wait_for_app(page)
            time.sleep(1)
            take_screenshot(page, "screenshot-report.png", full_page=True)

        # ── 6. Pipeline flow indicator ──
        print("[6/6] Capturing pipeline flow...")
        page.goto(FRONTEND_URL)
        wait_for_app(page)
        page.evaluate("window.scrollTo(0, 400)")
        time.sleep(1)
        take_screenshot(page, "screenshot-pipeline-flow.png")

        print(f"\n[DONE] All screenshots captured to {ASSETS_DIR}")
        browser.close()


if __name__ == "__main__":
    main()
