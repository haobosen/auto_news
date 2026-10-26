"""扫码登录抖音网页版，保存登录态到 cookies/douyin_state.json。
用法：.venv/bin/python scripts/get_douyin_cookie.py
"""
from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

STATE_PATH = Path(__file__).parent.parent / "cookies" / "douyin_state.json"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False, args=["--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )
        context.add_init_script(
            'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
        )
        page = context.new_page()
        page.goto("https://www.douyin.com/", wait_until="domcontentloaded")

        print("\n=== 请在弹出的浏览器窗口登录抖音 ===")
        print("1. 如果弹出登录框，切到「扫码登录」tab")
        print("2. 用抖音 App 扫码，完成登录")
        print("3. 看到页面右上角出现你的头像后，回到这里按回车\n")
        input(">>> 登录完成后按回车键 ...")

        context.storage_state(path=str(STATE_PATH))
        print(f"已保存登录态到 {STATE_PATH}")

        browser.close()


if __name__ == "__main__":
    main()
