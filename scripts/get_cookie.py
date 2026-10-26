"""扫码登录微博，自动保存完整 Cookie（含 HttpOnly 的 SUB）到 cookies/weibo.txt。
用法：.venv/bin/python scripts/get_cookie.py
"""
from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright

COOKIE_PATH = Path(__file__).parent.parent / "cookies" / "weibo.txt"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(user_agent=UA)
        page = context.new_page()
        page.goto("https://m.weibo.cn/", wait_until="domcontentloaded")

        print("\n=== 请在弹出的浏览器窗口里登录微博 ===")
        print("登录成功后，回到这里按回车，我会自动保存 cookie。\n")
        input(">>> 登录完成后按回车键 ...")

        cookies = context.cookies()
        if not cookies:
            print("没拿到任何 cookie，可能没有登录成功。")
        else:
            cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
            COOKIE_PATH.write_text(cookie_str, encoding="utf-8")
            names = [c["name"] for c in cookies]
            has_sub = "SUB" in names
            print(f"\n已保存 {len(cookies)} 个 cookie 到 {COOKIE_PATH}")
            print("包含 SUB（登录凭证）:", has_sub)

        browser.close()


if __name__ == "__main__":
    main()
