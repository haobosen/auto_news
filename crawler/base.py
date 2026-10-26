"""爬虫公共工具：Cookie 加载、HTTP 请求、时间解析。"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from pathlib import Path

import httpx

COOKIE_DIR = Path(__file__).parent.parent / "cookies"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def load_cookie(platform: str) -> str:
    """从 cookies/<platform>.txt 读取 cookie 字符串，按 name 去重。"""
    path = COOKIE_DIR / f"{platform}.txt"
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8").strip()
    # playwright 会抓到多个域名下同名 cookie（如 SUB），去重保留最后一个（最具体的域名）
    seen: dict[str, str] = {}
    for part in raw.split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            seen[k] = v
    return "; ".join(f"{k}={v}" for k, v in seen.items())


def make_client(platform: str = "") -> httpx.Client:
    headers = {
        "User-Agent": UA,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://m.weibo.cn/",
    }
    cookie = load_cookie(platform)
    if cookie:
        headers["Cookie"] = cookie
    return httpx.Client(headers=headers, timeout=20, follow_redirects=True)


def fetch_json(client: httpx.Client, url: str, params: dict = None):
    r = client.get(url, params=params)
    r.raise_for_status()
    return r.json()


# ---- 微博时间解析 ----

def parse_weibo_time(text: str, now: datetime | None = None) -> str:
    """把微博的 created_at（如 '08-21'、'3分钟前'）解析成 'YYYY-MM-DD HH:MM:SS'。"""
    if not text:
        return ""
    now = now or datetime.now()
    text = text.strip()

    if text == "刚刚":
        return now.strftime("%Y-%m-%d %H:%M:%S")

    # 英文 RFC 格式：Fri Aug 21 17:35:34 +0800 2026
    if re.match(r"^\w{3} \w{3} \d{1,2} \d{2}:\d{2}:\d{2} [+-]\d{4} \d{4}$", text):
        try:
            return datetime.strptime(text, "%a %b %d %H:%M:%S %z %Y").strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        except ValueError:
            pass

    m = re.match(r"(\d+)分钟前", text)
    if m:
        return (now - timedelta(minutes=int(m.group(1)))).strftime("%Y-%m-%d %H:%M:%S")

    m = re.match(r"(\d+)小时前", text)
    if m:
        return (now - timedelta(hours=int(m.group(1)))).strftime("%Y-%m-%d %H:%M:%S")

    if text.startswith("昨天"):
        t = re.search(r"(\d{1,2}:\d{2})", text)
        hm = t.group(1) if t else "00:00"
        d = now - timedelta(days=1)
        return f"{d.strftime('%Y-%m-%d')} {hm}:00"

    m = re.match(r"(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}:\d{2}))?", text)
    if m:
        month, day, hm = int(m.group(1)), int(m.group(2)), m.group(3) or "00:00"
        return f"{now.year:04d}-{month:02d}-{day:02d} {hm}:00"

    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}:\d{2}))?", text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        hm = m.group(4) or "00:00"
        return f"{y:04d}-{mo:02d}-{d:02d} {hm}:00"

    return text


def strip_html(text: str, limit: int = 120) -> str:
    """去掉 HTML 标签，取纯文本摘要。"""
    if not text:
        return ""
    s = re.sub(r"<[^>]+>", "", text)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:limit] + ("…" if len(s) > limit else "")
