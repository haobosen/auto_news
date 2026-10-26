"""微博登录态管理：检测 cookie 是否失效，并启动浏览器完成登录后保存新 cookie。"""
from __future__ import annotations

import threading
import time
from pathlib import Path

import httpx

from crawler import base

COOKIE_PATH = Path(__file__).parent.parent / "cookies" / "weibo.txt"

# 登录流程状态（进程内共享）
_login_state = {"running": False, "success": False, "message": ""}


def _api_login_ok(cookie_str: str) -> bool:
    """用给定 cookie 调 /api/config，返回登录是否有效。"""
    client = httpx.Client(
        headers={
            "User-Agent": base.UA,
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://m.weibo.cn/",
            "Cookie": cookie_str,
        },
        timeout=15,
        follow_redirects=True,
    )
    try:
        r = client.get("https://m.weibo.cn/api/config")
        if r.status_code != 200:
            return False
        return bool((r.json().get("data") or {}).get("login"))
    except Exception:  # noqa: BLE001
        return False
    finally:
        client.close()


def check_login() -> dict:
    """检测当前保存的 cookie 是否仍有效。"""
    cookie = base.load_cookie("weibo")
    if not cookie:
        return {"logged_in": False, "message": "未找到微博登录 cookie"}
    ok = _api_login_ok(cookie)
    return {"logged_in": ok, "message": "登录有效" if ok else "登录已失效"}


def login_status() -> dict:
    return dict(_login_state)


def start_login() -> dict:
    """启动浏览器登录流程（后台线程），返回当前状态。"""
    global _login_state
    if _login_state["running"]:
        return dict(_login_state)
    _login_state = {"running": True, "success": False, "message": "已打开浏览器，请在浏览器窗口里完成登录"}
    threading.Thread(target=_do_login, daemon=True).start()
    return dict(_login_state)


def _do_login() -> None:
    global _login_state
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(user_agent=base.UA)
            page = context.new_page()
            page.goto("https://m.weibo.cn/", wait_until="domcontentloaded")
            # 记录初始访客 SUB，登录后会变成真实登录 token
            initial_sub = next(
                (c["value"] for c in context.cookies() if c["name"] == "SUB"), ""
            )
            deadline = time.time() + 180
            while time.time() < deadline:
                cookies = context.cookies()
                mlogin = next((c["value"] for c in cookies if c["name"] == "MLOGIN"), "0")
                sub = next((c["value"] for c in cookies if c["name"] == "SUB"), "")
                if mlogin == "1" or (sub and sub != initial_sub):
                    cookie_str = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
                    if _api_login_ok(cookie_str):
                        COOKIE_PATH.write_text(cookie_str, encoding="utf-8")
                        _login_state = {"running": False, "success": True, "message": "登录成功"}
                        browser.close()
                        return
                time.sleep(2)
            browser.close()
            _login_state = {"running": False, "success": False, "message": "登录超时，请重试"}
    except Exception as e:  # noqa: BLE001
        _login_state = {"running": False, "success": False, "message": f"登录失败：{e}"}
