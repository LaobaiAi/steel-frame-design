"""Test that clicking '生成并分析' stays on modeling step (no flash-back)"""
import sys, os, time
from playwright.sync_api import sync_playwright

BASE_URL = 'http://localhost:3003'
SCREENSHOT_DIR = '/tmp/caiao_test'
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def test_no_flash_after_generate():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            device_scale_factor=1,
        )
        page = context.new_page()

        # Log console errors
        console_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)

        # ── 1. Load landing page ──
        print('[1/5] Loading landing page...')
        page.goto(BASE_URL, wait_until='networkidle')
        page.wait_for_timeout(2000)
        print('       ✓ Landing page loaded')

        # ── 2. Click "在线体验" to enter input step ──
        print('[2/5] Entering input step...')
        cta = page.get_by_text('在线体验', exact=False)
        if cta.count() == 0:
            cta = page.locator('button').filter(has_text='体验')
        assert cta.count() > 0, 'Could not find CTA button'
        cta.first.click()
        page.wait_for_timeout(1500)
        print('       ✓ Input step reached')

        # ── 3. Click "生成并分析" ──
        print('[3/5] Clicking 生成并分析...')
        generate_btn = page.get_by_text('生成并分析', exact=False)
        assert generate_btn.count() > 0, '生成并分析 button not found'
        generate_btn.click()
        page.wait_for_timeout(1000)
        print('       ✓ Clicked generate button')

        # ── 4. Wait and verify we're on modeling step ──
        print('[4/5] Verifying no flash-back...')

        # Check for canvas element (3D view) — indicates modeling step is active
        canvas = page.locator('canvas')
        canvas_present = canvas.count() > 0
        print(f'       Canvas present: {canvas_present}')

        # Check the page styling — modeling step has overflow hidden
        has_overflow_hidden = page.evaluate('() => document.body.style.overflow === "hidden"')
        print(f'       Body overflow hidden: {has_overflow_hidden}')

        # Check that "下一步" button is disabled (isRunning should be true)
        next_btn = page.locator('button').filter(has_text='下一步')
        next_disabled = True
        if next_btn.count() > 0:
            next_disabled = next_btn.first.is_disabled() or '运行中' in (next_btn.first.text_content() or '')
        print(f'       下一步 button disabled: {next_disabled}')

        # Wait longer to check step stability
        page.wait_for_timeout(3000)

        # Screenshot after waiting
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, '04-modeling-after-3s.png'), full_page=True)

        # Verify we're still on the modeling page (canvas still present)
        canvas_still_present = page.locator('canvas').count() > 0
        print(f'       Canvas still present after 3s: {canvas_still_present}')

        # Log any console errors
        print(f'       Console errors: {len(console_errors)}')
        for err in console_errors[-3:]:
            print(f'         - {err[:100]}')

        # ── 5. Test that pressing Space DOES NOT advance the step ──
        print('[5/5] Testing keyboard navigation is blocked...')
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(500)
        canvas_after_key = page.locator('canvas').count() > 0
        print(f'       Canvas present after ArrowRight: {canvas_after_key}')

        success = canvas_present and canvas_still_present and canvas_after_key
        status = 'PASSED' if success else 'FAILED'
        print(f'\n=== TEST {status} ===')

        if not success:
            print('FAIL: The modeling step appears to have been navigated away from!')
            if not canvas_present:
                print('  - No canvas was found at all')
            if not canvas_still_present:
                print('  - Canvas disappeared after 3s (possible step change)')
            if not canvas_after_key:
                print('  - ArrowRight caused step change (isRunning is false!)')

        browser.close()
        sys.exit(0 if success else 1)

if __name__ == '__main__':
    test_no_flash_after_generate()
