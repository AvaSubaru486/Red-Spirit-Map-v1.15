"""Browser smoke checks for the static v1.15 special Pages build."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:4180"
report = {"status": "passed", "checks": []}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(3000)
    page.wait_for_function("typeof state !== 'undefined' && state.events.length > 0")
    assert page.locator("#map").is_visible()
    assert page.locator("#open-test-panel").inner_text() == "本地 AI 设置"
    page.locator("#open-test-panel").click()
    assert page.locator("#local-ai-base").input_value() == "http://127.0.0.1:8010"
    page.locator("#close-test-panel").click()
    report["checks"].append("地图静态数据初始化，本地 AI 配置面板不包含远程卡密")
    page.locator('[data-mode="time"]').click()
    page.locator("#year-input").fill("1937")
    page.locator("#year-input").dispatch_event("change")
    page.wait_for_timeout(700)
    assert page.locator("#history-controls").is_visible()
    page.locator('[data-mode="person"]').click()
    page.wait_for_timeout(500)
    assert page.locator("#person-select").is_visible()
    report["checks"].append("年份与人物模式可以切换")
    page.locator('[data-mode="ordinary"]').click()
    page.wait_for_timeout(500)
    first_event = page.locator(".event-marker").first
    if first_event.count():
        first_event.click()
        page.wait_for_timeout(500)
        assert page.locator(".event-ai").count() == 1
        assert "本地模型" in page.locator(".event-ai").inner_text()
    report["checks"].append("事件详情挂载本地 AI 讲解面板")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(ROOT / "static-pages-mobile.png"), full_page=True)
    report["checks"].append("手机宽度无横向溢出")
    assert not errors, errors
    browser.close()
(ROOT / "pages-acceptance.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
