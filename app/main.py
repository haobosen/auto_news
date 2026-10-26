"""FastAPI 入口：API + 静态页面。启动：uvicorn app.main:app --reload"""
import json
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import db
from crawler import autohome, weibo, weibo_auth

DIST_DIR = Path(__file__).parent.parent / "frontend" / "dist"

# 图片代理白名单（防盗链图片域名，避免被 ORB 拦截 + 绕过 referer 校验）
ALLOWED_IMG_HOSTS = ("sinaimg.cn", "douyinpic.com", "pstatp.com", "p3-sign.douyinpic.com", "autoimg.cn")

# 视频代理白名单（微博视频 CDN，防盗链校验，需后端代取）
ALLOWED_VIDEO_HOSTS = ("weibocdn.com",)

# 抓取状态（手动刷新触发）
crawl_state = {"running": False, "last_new": 0, "last_run": "", "weibo_login_invalid": False}


def run_crawl() -> None:
    if crawl_state["running"]:
        return
    crawl_state["running"] = True
    try:
        from crawler import runner

        new = runner.run()
        crawl_state["last_new"] = new
        crawl_state["last_run"] = time.strftime("%Y-%m-%d %H:%M:%S")
        # 抓取结束后检测微博登录态：失效则标记，前端据此弹出登录框
        try:
            crawl_state["weibo_login_invalid"] = not weibo_auth.check_login()["logged_in"]
        except Exception:  # noqa: BLE001
            crawl_state["weibo_login_invalid"] = False
    finally:
        crawl_state["running"] = False


# 定时更新调度器
_scheduler = None


def _apply_scheduler() -> None:
    """根据设置重新配置定时更新任务。"""
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.remove_job("auto_update")
    except Exception:  # noqa: BLE001
        pass
    with db.get_conn() as conn:
        auto_update = db.get_setting(conn, "auto_update", "0") == "1"
        interval = int(db.get_setting(conn, "update_interval", "30") or 30)
    if auto_update:
        _scheduler.add_job(run_crawl, "interval", minutes=max(1, interval), id="auto_update")


def init_scheduler() -> None:
    global _scheduler
    from apscheduler.schedulers.background import BackgroundScheduler

    _scheduler = BackgroundScheduler()
    _apply_scheduler()
    _scheduler.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    init_scheduler()
    yield
    if _scheduler is not None:
        _scheduler.shutdown()


app = FastAPI(lifespan=lifespan)
app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


def _post_to_dict(row) -> dict:
    d = dict(row)
    try:
        d["extra"] = json.loads(d["extra"]) if d.get("extra") else {}
    except (json.JSONDecodeError, TypeError):
        d["extra"] = {}
    return d


@app.get("/")
def index():
    return FileResponse(DIST_DIR / "index.html")


@app.get("/img")
def proxy_img(url: str):
    """图片代理：转发白名单域名的图片，绕过防盗链和 ORB 拦截。"""
    from urllib.parse import urlparse

    host = urlparse(url).hostname or ""
    if not any(host == h or host.endswith("." + h) for h in ALLOWED_IMG_HOSTS):
        raise HTTPException(status_code=400, detail="图片域名不在白名单")
    # 按域名设置防盗链 Referer
    referer = "https://m.weibo.cn/"
    if host.endswith("autoimg.cn"):
        referer = "https://www.autohome.com.cn/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": referer,
    }
    try:
        r = httpx.get(url, headers=headers, timeout=15, follow_redirects=True)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="图片拉取失败")
    return Response(
        content=r.content,
        media_type=r.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/sources")
def api_sources():
    with db.get_conn() as conn:
        rows = db.list_sources(conn, enabled_only=True)
    return [dict(r) for r in rows]


@app.delete("/api/sources/{source_id}")
def api_delete_source(source_id: int):
    """删除源及其内容（用户选择不看该源）。"""
    with db.get_conn() as conn:
        conn.execute("DELETE FROM posts WHERE source_id=?", (source_id,))
        conn.execute("UPDATE sources SET enabled=0 WHERE id=?", (source_id,))
        conn.commit()
    return {"ok": True}


@app.get("/api/search/users")
def api_search_users(q: str = ""):
    """搜索微博博主（粉丝 50 万以上，按粉丝数降序）。"""
    if not q:
        return []
    return weibo.search_users(q)


@app.post("/api/sources/add")
def api_add_source(payload: dict):
    """添加微博博主，并抓取其原创内容。"""
    name = payload.get("name", "")
    uid = payload.get("uid", "")
    avatar = payload.get("avatar", "")
    if not name or not uid:
        raise HTTPException(status_code=400, detail="缺少参数")
    source = {"name": name, "platform": "weibo", "nick": name, "uid": uid, "avatar": avatar, "kind": "person", "enabled": 1}
    from crawler import runner

    with db.get_conn() as conn:
        db.upsert_source(conn, source)
        n, _msg = runner.run_one(conn, source)
        conn.commit()
    return {"ok": True, "new": n}


@app.get("/api/posts")
def api_posts(platform: str = "", type: str = "", source_id: int = 0,
              limit: int = 50, offset: int = 0):
    with db.get_conn() as conn:
        rows = db.list_posts(
            conn,
            platform=platform or None,
            type_=type or None,
            source_id=source_id or None,
            limit=min(limit, 200),
            offset=offset,
        )
    return [_post_to_dict(r) for r in rows]


@app.get("/api/posts/{post_id}")
def api_post(post_id: int):
    with db.get_conn() as conn:
        row = db.get_post(conn, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return _post_to_dict(row)


@app.post("/api/posts/{post_id}/read")
def api_mark_read(post_id: int):
    """标记内容为已读（点击查看后调用）。"""
    with db.get_conn() as conn:
        conn.execute("UPDATE posts SET read=1 WHERE id=?", (post_id,))
        conn.commit()
    return {"ok": True}


@app.get("/api/video/{post_id}")
def api_video(post_id: int):
    """实时刷新视频直链（微博直链带时效，播放时现取）。"""
    with db.get_conn() as conn:
        row = db.get_post(conn, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    if row["platform"] == "weibo" and row["post_id"]:
        url = weibo.refresh_video_url(row["post_id"])
        return {"video_url": url}
    return {"video_url": row["video_url"] or ""}


@app.get("/video/{post_id}")
def proxy_video(post_id: int, request: Request):
    """视频代理：后端代取视频流，带 weibo Referer 绕过防盗链，支持 Range（拖动进度）。"""
    from urllib.parse import urlparse

    with db.get_conn() as conn:
        row = db.get_post(conn, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")

    if row["platform"] == "weibo" and row["post_id"]:
        url = weibo.refresh_video_url(row["post_id"])
    else:
        url = row["video_url"] or ""
    if not url:
        raise HTTPException(status_code=404, detail="视频地址为空")

    host = urlparse(url).hostname or ""
    if not any(host == h or host.endswith("." + h) for h in ALLOWED_VIDEO_HOSTS):
        raise HTTPException(status_code=400, detail="视频域名不在白名单")

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://m.weibo.cn/",
    }
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    try:
        r = httpx.get(url, headers=headers, timeout=60, follow_redirects=True)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="视频拉取失败")

    resp_headers = {
        "Content-Type": r.headers.get("content-type", "video/mp4"),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
    }
    if "content-length" in r.headers:
        resp_headers["Content-Length"] = r.headers["content-length"]
    if "content-range" in r.headers:
        resp_headers["Content-Range"] = r.headers["content-range"]

    return Response(content=r.content, status_code=r.status_code, headers=resp_headers)


@app.get("/api/comments/{post_id}")
def api_comments(post_id: int):
    """获取评论（实时，微博/汽车之家）。"""
    with db.get_conn() as conn:
        row = db.get_post(conn, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    if row["platform"] == "weibo" and row["post_id"]:
        return weibo.fetch_comments(row["post_id"])
    if row["platform"] == "autohome" and row["post_id"]:
        return autohome.fetch_comments(row["post_id"])
    return {"comments": [], "total": 0}


@app.post("/api/refresh")
def api_refresh():
    """手动触发抓取（后台线程跑一轮）。"""
    if crawl_state["running"]:
        return {"status": "running"}
    threading.Thread(target=run_crawl, daemon=True).start()
    return {"status": "started"}


@app.get("/api/status")
def api_status():
    return crawl_state


@app.get("/api/stats")
def api_stats():
    """内容统计：总数、图文数、视频数、日期范围。"""
    with db.get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) c FROM posts").fetchone()["c"]
        images = conn.execute("SELECT COUNT(*) c FROM posts WHERE type='image'").fetchone()["c"]
        videos = conn.execute(
            "SELECT COUNT(*) c FROM posts WHERE type IN ('video_short','video_long')"
        ).fetchone()["c"]
        min_d = conn.execute(
            "SELECT MIN(published_at) m FROM posts WHERE published_at != ''"
        ).fetchone()["m"]
        max_d = conn.execute(
            "SELECT MAX(published_at) m FROM posts WHERE published_at != ''"
        ).fetchone()["m"]
        last_created = conn.execute("SELECT MAX(created_at) m FROM posts").fetchone()["m"]
        cumulative = int(db.get_setting(conn, "cumulative_count", "0") or 0)
    return {
        "total": total,
        "images": images,
        "videos": videos,
        "cumulative": cumulative,
        "min_date": (min_d or "")[:10],
        "max_date": (max_d or "")[:10],
        "last_run": crawl_state["last_run"] or (last_created or ""),
        "last_new": crawl_state["last_new"],
    }


@app.get("/api/settings")
def api_get_settings():
    with db.get_conn() as conn:
        return {
            "refresh_on_load": db.get_setting(conn, "refresh_on_load", "0") == "1",
            "auto_update": db.get_setting(conn, "auto_update", "0") == "1",
            "update_interval": int(db.get_setting(conn, "update_interval", "30") or 30),
        }


@app.put("/api/settings")
def api_set_settings(payload: dict):
    with db.get_conn() as conn:
        if "refresh_on_load" in payload:
            db.set_setting(conn, "refresh_on_load", "1" if payload["refresh_on_load"] else "0")
        if "auto_update" in payload:
            db.set_setting(conn, "auto_update", "1" if payload["auto_update"] else "0")
        if "update_interval" in payload:
            db.set_setting(conn, "update_interval", str(int(payload["update_interval"])))
        conn.commit()
    _apply_scheduler()
    return {"ok": True}


@app.get("/api/weibo/check")
def api_weibo_check():
    """检测微博登录态是否失效。"""
    return weibo_auth.check_login()


@app.post("/api/weibo/login")
def api_weibo_login():
    """启动浏览器登录流程（扫码 / 账号密码）。"""
    return weibo_auth.start_login()


@app.get("/api/weibo/login/status")
def api_weibo_login_status():
    """轮询登录流程状态。"""
    return weibo_auth.login_status()
