"""SQLite 数据层：建表、源与内容的读写。"""
import sqlite3
from pathlib import Path

import config

DB_FILE = Path(__file__).parent.parent / config.DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    nick TEXT,
    uid TEXT,
    avatar TEXT,
    followers INTEGER,
    kind TEXT DEFAULT 'person',
    enabled INTEGER DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_uniq ON sources(platform, name);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER,
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    type TEXT,
    title TEXT,
    summary TEXT,
    cover TEXT,
    url TEXT,
    author TEXT,
    published_at TEXT,
    content TEXT,
    video_url TEXT,
    extra TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_uniq ON posts(platform, post_id);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source_id);
CREATE INDEX IF NOT EXISTS idx_posts_pub ON posts(published_at);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        # 迁移：旧库给 posts 表补 read 列（存量内容视为已读，新内容默认未读）
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(posts)")}
        if "read" not in cols:
            conn.execute("ALTER TABLE posts ADD COLUMN read INTEGER NOT NULL DEFAULT 0")
            conn.execute("UPDATE posts SET read = 1")
        # 累计内容数：首次启用时，把当前已有的全部内容计入基数，之后只增不减（删除不影响）。
        # 用 cumulative_seeded 标记保证只初始化一次，避免每次启动都重置。
        if conn.execute("SELECT 1 FROM settings WHERE key='cumulative_seeded'").fetchone() is None:
            total = conn.execute("SELECT COUNT(*) c FROM posts").fetchone()["c"]
            set_setting(conn, "cumulative_count", str(total))
            set_setting(conn, "cumulative_seeded", "1")


def upsert_source(conn: sqlite3.Connection, s: dict) -> int:
    """插入或更新源，返回其 id。"""
    vals = {
        "name": s.get("name", ""),
        "platform": s.get("platform", ""),
        "nick": s.get("nick"),
        "uid": s.get("uid"),
        "avatar": s.get("avatar"),
        "followers": s.get("followers"),
        "kind": s.get("kind", "person"),
        "enabled": 1 if s.get("enabled", True) else 0,
    }
    conn.execute(
        """
        INSERT INTO sources (name, platform, nick, uid, avatar, followers, kind, enabled)
        VALUES (:name, :platform, :nick, :uid, :avatar, :followers, :kind, :enabled)
        ON CONFLICT(platform, name) DO UPDATE SET
            nick=excluded.nick, uid=excluded.uid, avatar=excluded.avatar,
            followers=excluded.followers, kind=excluded.kind, enabled=excluded.enabled
        """,
        vals,
    )
    row = conn.execute(
        "SELECT id FROM sources WHERE platform=? AND name=?", (vals["platform"], vals["name"])
    ).fetchone()
    return row["id"]


def upsert_post(conn: sqlite3.Connection, p: dict) -> bool:
    """插入或忽略内容（按 platform+post_id 去重）。返回是否为新插入。"""
    vals = {
        "source_id": p.get("source_id"),
        "platform": p.get("platform", ""),
        "post_id": p.get("post_id", ""),
        "type": p.get("type"),
        "title": p.get("title"),
        "summary": p.get("summary"),
        "cover": p.get("cover"),
        "url": p.get("url"),
        "author": p.get("author"),
        "published_at": p.get("published_at"),
        "content": p.get("content"),
        "video_url": p.get("video_url"),
        "extra": p.get("extra"),
    }
    cur = conn.execute(
        """
        INSERT OR IGNORE INTO posts
            (source_id, platform, post_id, type, title, summary, cover, url, author,
             published_at, content, video_url, extra)
        VALUES
            (:source_id, :platform, :post_id, :type, :title, :summary, :cover, :url, :author,
             :published_at, :content, :video_url, :extra)
        """,
        vals,
    )
    inserted = cur.rowcount > 0
    if inserted:
        # 累计内容数：只增不减的持久化计数，内容删除不影响该值。
        incr_setting(conn, "cumulative_count", 1)
    return inserted


def list_sources(conn: sqlite3.Connection, enabled_only: bool = True):
    q = """
        SELECT s.*, (SELECT COUNT(*) FROM posts p WHERE p.source_id=s.id) AS post_count
        FROM sources s
    """
    if enabled_only:
        q += " WHERE s.enabled=1"
    q += " ORDER BY s.platform, s.id"
    return conn.execute(q).fetchall()


def list_posts(conn: sqlite3.Connection, platform=None, type_=None, source_id=None,
               limit=50, offset=0):
    q = "SELECT p.*, s.name AS source_name, s.avatar AS source_avatar FROM posts p LEFT JOIN sources s ON p.source_id=s.id WHERE 1=1"
    args = []
    if platform:
        q += " AND p.platform=?"
        args.append(platform)
    if type_:
        if type_ == "video":
            q += " AND p.type IN ('video_short','video_long')"
        else:
            q += " AND p.type=?"
            args.append(type_)
    if source_id:
        q += " AND p.source_id=?"
        args.append(source_id)
    q += " ORDER BY p.published_at DESC, p.id DESC LIMIT ? OFFSET ?"
    args += [limit, offset]
    return conn.execute(q, args).fetchall()


def get_post(conn: sqlite3.Connection, post_id: int):
    return conn.execute(
        "SELECT p.*, s.name AS source_name, s.avatar AS source_avatar "
        "FROM posts p LEFT JOIN sources s ON p.source_id=s.id WHERE p.id=?",
        (post_id,),
    ).fetchone()


def clean_old(conn: sqlite3.Connection, threshold: int = 100, cull: int = 50) -> int:
    """每个源内容达到 threshold 条时，删掉最旧的 cull 条（按发布时间）。

    即：攒到 threshold 条 → 砍掉最旧的 cull 条 → 剩下 threshold - cull 条，循环往复。
    """
    sources = conn.execute(
        "SELECT DISTINCT source_id FROM posts WHERE source_id IS NOT NULL"
    ).fetchall()
    total = 0
    for (sid,) in sources:
        cnt = conn.execute(
            "SELECT COUNT(*) c FROM posts WHERE source_id=?", (sid,)
        ).fetchone()["c"]
        if cnt < threshold:
            continue
        # 最旧的 cull 条：按发布时间升序（空时间排最前，视为最旧）
        cur = conn.execute(
            "DELETE FROM posts WHERE id IN ("
            "SELECT id FROM posts WHERE source_id=? "
            "ORDER BY published_at ASC, id ASC LIMIT ?"
            ")",
            (sid, cull),
        )
        total += cur.rowcount
    return total


def get_setting(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )


def incr_setting(conn: sqlite3.Connection, key: str, delta: int = 1) -> None:
    """递增一个持久化计数器（存于 settings 表，值为文本）。"""
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    cur = int(row["value"] or 0) if row else 0
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, str(cur + delta)),
    )
