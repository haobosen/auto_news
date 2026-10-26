"""微博博主爬虫：m.weibo.cn 接口。"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta

from . import base


class WeiboCrawler:
    def __init__(self):
        self.client = base.make_client("weibo")

    # ---- 工具 ----

    def _search_uid(self, nick: str) -> tuple[str, str]:
        """按昵称搜索用户，返回 (uid, avatar)。"""
        url = "https://m.weibo.cn/api/container/getIndex"
        params = {
            "containerid": f"100103type=3&q={nick}",
            "page_type": "searchall",
        }
        data = base.fetch_json(self.client, url, params)
        cards = (data.get("data") or {}).get("cards") or []
        for card in cards:
            group = card.get("card_group") or []
            for item in group:
                user = item.get("user")
                if user and user.get("screen_name") == nick:
                    avatar = user.get("avatar_hd") or user.get("profile_image_url") or ""
                    return str(user.get("id", "")), avatar
        return "", ""

    def _containerid(self, uid: str) -> str:
        return f"107603{uid}"

    # ---- 抓取 ----

    def fetch_posts(self, uid: str, limit: int = 30, since_date: str = "") -> list[dict]:
        """抓取某用户最新微博，返回标准化的 post 字典列表。

        since_date 传 'YYYY-MM-DD' 时，会翻页抓取该日期（含）之后的所有内容，
        直到翻到更早的微博或达到 limit 上限；为空则只抓最新一页。
        """
        url = "https://m.weibo.cn/api/container/getIndex"
        params = {
            "type": "uid",
            "value": uid,
            "containerid": self._containerid(uid),
        }
        posts = []
        while True:
            data = base.fetch_json(self.client, url, params)
            dd = data.get("data") or {}
            cards = dd.get("cards") or []
            hit_before_since = False  # 是否已翻到 since_date 之前（可提前停止）
            for card in cards:
                mblog = card.get("mblog")
                if not mblog:
                    continue
                p = self._parse_mblog(mblog, uid)
                if not p:
                    continue
                # 翻过 since_date 即停：后面的内容更旧，不再需要
                if since_date and p["published_at"] and p["published_at"][:10] < since_date:
                    hit_before_since = True
                    break
                posts.append(p)
                if len(posts) >= limit:
                    return posts
            if hit_before_since:
                break
            cardlist_info = dd.get("cardlistInfo") or {}
            since_id = cardlist_info.get("since_id")
            if not since_id:
                break
            params["since_id"] = since_id
        return posts

    def _parse_mblog(self, mblog: dict, uid: str) -> dict | None:
        mid = str(mblog.get("id") or mblog.get("mid") or "")
        if not mid:
            return None

        # 剔除转发微博（只保留原创）
        if mblog.get("retweeted_status"):
            return None

        # 解析发布时间，过滤置顶/过旧微博（30 天前）
        published = base.parse_weibo_time(mblog.get("created_at", ""))
        if published:
            try:
                if datetime.strptime(published, "%Y-%m-%d %H:%M:%S") < datetime.now() - timedelta(days=30):
                    return None
            except ValueError:
                pass

        user = mblog.get("user") or {}
        page_info = mblog.get("page_info") or {}
        pics = mblog.get("pics") or []

        # 类型判断
        ptype = "image"
        video_url = ""
        if page_info.get("type") in ("video", "live"):
            duration = int((page_info.get("media_info") or {}).get("duration", 0) or 0)
            ptype = "video_long" if duration > 600 else "video_short"
            video_url = self._extract_video_url(page_info)

        cover = ""
        if pics:
            first = pics[0] or {}
            large = first.get("large")
            if isinstance(large, dict):
                cover = large.get("url") or ""
            if not cover:
                cover = first.get("url") or ""
        if not cover and page_info.get("page_pic"):
            pp = page_info.get("page_pic")
            if isinstance(pp, str):
                cover = pp
            elif isinstance(pp, dict):
                cover = pp.get("url") or ""

        text = mblog.get("text") or ""
        # 长文折叠：含「全文」链接时拉完整内容
        if "全文" in text and "/status/" in text:
            full = self._fetch_full_text(mid)
            if full:
                text = full
        # 提取定位信息（text 末尾的定位链接），并从正文中剔除
        location = ""
        loc_m = re.search(r'<a[^>]*href="[^"]*weibo\.com/p/[^"]*"[^>]*>(.*?)</a>', text, re.DOTALL)
        if loc_m:
            location = re.sub(r"<[^>]+>", "", loc_m.group(1)).strip()
            text = re.sub(r'<a[^>]*href="[^"]*weibo\.com/p/[^"]*"[^>]*>.*?</a>', "", text, flags=re.DOTALL)
        return {
            "platform": "weibo",
            "post_id": mid,
            "type": ptype,
            "title": base.strip_html(text, 60),
            "summary": base.strip_html(text, 120),
            "cover": cover,
            "url": f"https://m.weibo.cn/detail/{mid}",
            "author": user.get("screen_name", ""),
            "published_at": published,
            "content": text,  # HTML，站内渲染
            "video_url": video_url,
            "extra": json.dumps(
                {
                    "reposts": mblog.get("reposts_count"),
                    "comments": mblog.get("comments_count"),
                    "likes": mblog.get("attitudes_count"),
                    "pics": [
                        (p.get("large", {}).get("url") if isinstance(p.get("large"), dict) else None)
                        or p.get("url")
                        for p in pics
                    ],
                    "location": location,
                },
                ensure_ascii=False,
            ),
        }

    def _fetch_full_text(self, mid: str) -> str:
        """拉取微博完整正文（statuses/show 接口返回完整 text，不含「全文」折叠）。"""
        try:
            r = self.client.get("https://m.weibo.cn/statuses/show", params={"id": mid})
            data = r.json()
            return (data.get("data") or {}).get("text") or ""
        except Exception:  # noqa: BLE001
            return ""

    @staticmethod
    def _extract_video_url(page_info: dict) -> str:
        mi = page_info.get("media_info") or {}
        # 按清晰度从高到低尝试
        for key in ("mp4_720p_mp4", "mp4_hd_mp4", "stream_url", "mp4_ld_mp4", "mp4_sd_mp4"):
            v = mi.get(key)
            if v:
                return v
        return ""


def resolve_source(source: dict) -> dict:
    """给 config 里的源补上 uid 和头像（搜索解析），返回更新后的源 dict。"""
    if source.get("uid") and source.get("avatar"):
        return source
    crawler = WeiboCrawler()
    uid, avatar = crawler._search_uid(source["nick"])
    crawler.client.close()
    if not uid:
        uid = source.get("uid", "")
    return {**source, "uid": uid, "avatar": avatar or source.get("avatar", "")}


def refresh_video_url(mid: str) -> str:
    """实时请求微博详情，返回最新视频直链（直链带时效，播放时现取）。"""
    crawler = WeiboCrawler()
    try:
        r = crawler.client.get("https://m.weibo.cn/statuses/show", params={"id": mid})
        data = r.json()
        mi = ((data.get("data") or {}).get("page_info") or {}).get("media_info") or {}
        for key in ("stream_url", "mp4_720p_mp4", "mp4_hd_mp4", "mp4_ld_mp4", "mp4_sd_mp4"):
            v = mi.get(key)
            if v:
                return v
        return ""
    except Exception:  # noqa: BLE001
        return ""
    finally:
        crawler.client.close()


def fetch_comments(mid: str) -> dict:
    """获取微博热门评论（含子评论/回复）。返回 {comments: [...], total: n}。"""
    crawler = WeiboCrawler()
    try:
        r = crawler.client.get(
            "https://m.weibo.cn/comments/hotflow",
            params={"id": mid, "mid": mid, "max_id_type": "0"},
        )
        data = r.json()
        dd = (data.get("data") or {}).get("data") or []
        total = (data.get("data") or {}).get("total_number", 0) or 0
        comments = []

        def _parse(c):
            u = c.get("user") or {}
            return {
                "author": u.get("screen_name", ""),
                "avatar": u.get("avatar_hd") or u.get("profile_image_url", ""),
                "text": c.get("text", ""),
                "likes": c.get("like_count", 0),
                "created_at": base.parse_weibo_time(c.get("created_at", "")),
            }

        for c in dd:
            item = _parse(c)
            subs = c.get("comments") or []
            if subs:
                item["replies"] = [_parse(s) for s in subs]
                item["reply_total"] = c.get("total_number", len(subs)) or len(subs)
            comments.append(item)
        return {"comments": comments, "total": total}
    except Exception:  # noqa: BLE001
        return {"comments": [], "total": 0}
    finally:
        crawler.client.close()


def _parse_followers(fc) -> int:
    """把微博粉丝数（如 '1010万'、'1.2亿'）解析成整数。"""
    if isinstance(fc, (int, float)):
        return int(fc)
    if isinstance(fc, str):
        s = fc.strip()
        try:
            if s.endswith("亿"):
                return int(float(s[:-1]) * 100000000)
            if s.endswith("万"):
                return int(float(s[:-1]) * 10000)
            return int(float(s))
        except ValueError:
            return 0
    return 0


def search_users(keyword: str, min_followers: int = 200000) -> list[dict]:
    """搜索微博用户，返回粉丝 >= min_followers 的用户，按粉丝数降序。"""
    crawler = WeiboCrawler()
    try:
        r = crawler.client.get(
            "https://m.weibo.cn/api/container/getIndex",
            params={"containerid": f"100103type=3&q={keyword}", "page_type": "searchall"},
        )
        data = r.json()
        cards = (data.get("data") or {}).get("cards") or []
        users = []
        for card in cards:
            for item in (card.get("card_group") or []):
                u = item.get("user")
                if u:
                    followers = _parse_followers(u.get("followers_count"))
                    if followers >= min_followers:
                        users.append(
                            {
                                "uid": str(u.get("id", "")),
                                "name": u.get("screen_name", ""),
                                "followers": followers,
                                "avatar": u.get("profile_image_url", ""),
                            }
                        )
        users.sort(key=lambda x: x["followers"], reverse=True)
        return users
    except Exception:  # noqa: BLE001
        return []
    finally:
        crawler.client.close()
