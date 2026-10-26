"""调度器：遍历启用源 → 抓取 → 去重入库。用法：python -m crawler.runner"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from app import db
from crawler import autohome, weibo


def _calc_since_date(conn, source_id: int) -> str:
    """根据该源最新一条内容的发布日期，计算本次抓取的起点日期（YYYY-MM-DD）。

    - 从未抓过（无内容）：返回空串，按「抓最新一页」处理。
    - 断更到今天的间隔 ≤ CATCHUP_WINDOW_DAYS 天：从断更次日起补齐。
    - 超过窗口：只回补最近 CATCHUP_WINDOW_DAYS 天（含今天）。
    """
    row = conn.execute(
        "SELECT MAX(published_at) m FROM posts WHERE source_id=? AND published_at != ''",
        (source_id,),
    ).fetchone()
    last = (row["m"] or "")[:10] if row and row["m"] else ""
    if not last:
        return ""
    try:
        last_d = datetime.strptime(last, "%Y-%m-%d").date()
    except ValueError:
        return ""
    today = datetime.now().date()
    start = last_d + timedelta(days=1)  # 断更次日
    earliest = today - timedelta(days=config.CATCHUP_WINDOW_DAYS - 1)
    if start < earliest:
        start = earliest
    if start > today:
        start = today
    return start.strftime("%Y-%m-%d")


def run_one(conn, source: dict) -> tuple[int, str]:
    """抓取单个源，返回 (新入库条数, 说明)。"""
    platform = source["platform"]

    if platform == "weibo":
        # 优先用数据库里已存的 uid/avatar，避免每次靠搜索接口（搜索对登录态最敏感）
        stored = conn.execute(
            "SELECT uid, avatar FROM sources WHERE platform=? AND name=?",
            (source["platform"], source["name"]),
        ).fetchone()
        if stored and stored["uid"] and stored["avatar"] and not source.get("uid"):
            source = {**source, "uid": stored["uid"], "avatar": stored["avatar"]}
        resolved = weibo.resolve_source(source)
        uid = resolved.get("uid")
        if not uid:
            return 0, f"未找到 uid（昵称可能不准，或需要登录 cookie）"

        source_id = db.upsert_source(conn, resolved)
        since_date = _calc_since_date(conn, source_id)
        limit = config.MAX_CATCHUP_POSTS if since_date else config.MAX_POSTS_PER_SOURCE

        crawler = weibo.WeiboCrawler()
        try:
            posts = crawler.fetch_posts(uid, limit, since_date=since_date)
        finally:
            crawler.client.close()

        new_count = 0
        for p in posts:
            p["source_id"] = source_id
            if db.upsert_post(conn, p):
                new_count += 1
        span = f"（自 {since_date} 起）" if since_date else ""
        return new_count, f"抓到 {len(posts)} 条，新入库 {new_count} 条{span}"
    elif platform == "autohome":
        crawler = autohome.AutohomeCrawler()
        try:
            urls = crawler.fetch_list(config.MAX_POSTS_PER_SOURCE)
            source_id = db.upsert_source(conn, source)
            new_count = 0
            for url in urls:
                try:
                    post = crawler.fetch_article(url)
                except Exception:  # noqa: BLE001
                    continue
                if post:
                    post["source_id"] = source_id
                    if db.upsert_post(conn, post):
                        new_count += 1
            return new_count, f"抓到 {len(urls)} 篇，新入库 {new_count} 篇"
        finally:
            crawler.client.close()
    else:
        return 0, f"平台 {platform} 尚未实现（阶段 2）"


def run() -> int:
    db.init_db()
    enabled = [s for s in config.SOURCES if s.get("enabled")]
    print(f"共 {len(enabled)} 个启用源\n")
    total_new = 0
    with db.get_conn() as conn:
        for s in enabled:
            # 检查数据库里该源是否被用户禁用（个人中心删除过）
            row = conn.execute(
                "SELECT enabled FROM sources WHERE platform=? AND name=?",
                (s["platform"], s["name"]),
            ).fetchone()
            if row and row["enabled"] == 0:
                print(f"[{s['platform']}] {s['name']}: 已禁用，跳过")
                continue
            try:
                n, msg = run_one(conn, s)
            except Exception as e:  # noqa: BLE001
                n, msg = 0, f"失败: {e}"
            total_new += n
            print(f"[{s['platform']}] {s['name']}: {msg}")
        # 清理转发微博
        cur = conn.execute(
            "DELETE FROM posts WHERE platform='weibo' "
            "AND (title LIKE '%//@%' OR title='转发微博')"
        )
        if cur.rowcount:
            print(f"\n已剔除转发微博 {cur.rowcount} 条。")
        # 清理每个源超出上限的旧内容：达到阈值后砍掉最旧的一批
        deleted = db.clean_old(conn, config.CULL_THRESHOLD, config.CULL_PER_SOURCE)
        if deleted:
            print(f"已清理旧内容 {deleted} 条（每源达到 {config.CULL_THRESHOLD} 条时，删最旧的 {config.CULL_PER_SOURCE} 条）。")
    print(f"\n本轮完成，共新入库 {total_new} 条。")
    return total_new


if __name__ == "__main__":
    run()
