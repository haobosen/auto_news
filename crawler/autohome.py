"""汽车之家资讯爬虫：列表页 gbk 编码 + 正文页 __NEXT_DATA__。"""
from __future__ import annotations

import json
import re

import httpx
from bs4 import BeautifulSoup

from . import base

LIST_URL = "https://www.autohome.com.cn/all/"


class AutohomeCrawler:
    def __init__(self):
        self.client = httpx.Client(
            headers={
                "User-Agent": base.UA,
                "Referer": "https://www.autohome.com.cn/",
            },
            timeout=20,
            follow_redirects=True,
        )

    def fetch_list(self, limit: int = 30) -> list[str]:
        """抓资讯列表，返回文章 URL 列表（去重、按 id 去重）。"""
        r = self.client.get(LIST_URL)
        html = r.content.decode("gbk", errors="ignore")  # 列表页是 gb2312
        soup = BeautifulSoup(html, "html.parser")
        urls: list[str] = []
        seen: set[str] = set()
        for a in soup.find_all("a", href=True):
            m = re.match(r"//www\.autohome\.com\.cn/([a-z]+)/\d+/(\d+)\.html", a["href"])
            if m and m.group(2) not in seen:
                seen.add(m.group(2))
                urls.append("https:" + a["href"].split("#")[0])
                if len(urls) >= limit:
                    break
        return urls

    def fetch_article(self, url: str) -> dict | None:
        """抓正文，解析 __NEXT_DATA__，返回标准 post 字典。"""
        r = self.client.get(url)
        soup = BeautifulSoup(r.text, "html.parser")  # 正文页是 utf-8
        nd = soup.find("script", id="__NEXT_DATA__")
        if not nd or not nd.string:
            return None
        data = json.loads(nd.string)
        ac = (data.get("props", {}).get("pageProps", {}).get("articleContent")) or {}
        title = (ac.get("title") or "").strip()
        if not title:
            return None

        content = (ac.get("content") or "").replace("http://", "https://")
        images = [
            (u or "").replace("http://", "https://") for u in (ac.get("imageUrlList") or [])
        ]
        cover = images[0] if images else ""
        m = re.search(r"/(\d+)\.html", url)
        post_id = m.group(1) if m else url

        return {
            "platform": "autohome",
            "post_id": post_id,
            "type": "image",
            "title": title,
            "summary": base.strip_html(content, 120),
            "cover": cover,
            "url": url,
            "author": ac.get("authorName") or "汽车之家",
            "published_at": ac.get("publishDate") or "",
            "content": content,
            "video_url": "",
            "extra": json.dumps(
                {**self._fetch_stats(post_id), "images": images}, ensure_ascii=False
            ),
        }

    def _fetch_stats(self, article_id: str) -> dict:
        """获取文章点赞数和评论数（hotdata 接口）。"""
        url = "https://maindatahot.autohome.com.cn/hotdata/get_hot_data"
        params = {
            "_appid": "cms",
            "value": f"cms-like_count-{article_id},cms-reply_count-{article_id}",
        }
        try:
            r = self.client.get(url, params=params)
            result = r.json().get("result") or []
            likes, comments = 0, 0
            for item in result:
                if item.get("hot_data_type") == "like_count":
                    likes = item.get("count", 0) or 0
                elif item.get("hot_data_type") == "reply_count":
                    comments = item.get("count", 0) or 0
            return {"likes": likes, "comments": comments}
        except Exception:  # noqa: BLE001
            return {"likes": 0, "comments": 0}


def resolve_source(source: dict) -> dict:
    """门户源不需要搜索 uid，直接返回。"""
    return source


def fetch_comments(article_id: str) -> dict:
    """获取汽车之家文章评论。返回 {comments: [...], total: n}。"""
    import uuid

    url = "https://car-web-m.autohome.com.cn/reply/api/firstlevel"
    params = {
        "_ctype": "pc",
        "objid": article_id,
        "objtype": "1",
        "pageid": "",
        "pagesize": "20",
        "auth": "",
        "newversion": "1",
    }
    headers = {
        "User-Agent": base.UA,
        "Referer": "https://www.autohome.com.cn/",
        "reqid": str(uuid.uuid4()),
    }
    try:
        r = httpx.get(url, params=params, headers=headers, timeout=15)
        result = r.json().get("result") or {}
        lst = result.get("list") or []
        total = result.get("totalcount", 0) or 0
        comments = []
        for c in lst:
            comment = c.get("comment") or {}
            author = comment.get("author") or {}
            txt = (comment.get("content") or {}).get("txt") or ""
            if not txt:
                continue
            comments.append(
                {
                    "author": author.get("username", ""),
                    "avatar": (author.get("headimg") or "").replace("http://", "https://"),
                    "text": txt,
                    "likes": comment.get("likecount", 0) or 0,
                    "created_at": comment.get("publishtime", ""),
                }
            )
        return {"comments": comments, "total": total}
    except Exception:  # noqa: BLE001
        return {"comments": [], "total": 0}
