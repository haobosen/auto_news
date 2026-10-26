# 内容源清单
# 阶段 1 只启用 3 个微博号做验证，其余后续放开
# 抖音的 sec_uid、微博的 uid 由爬虫按 nick 自动搜索解析并回写 sources 表

SOURCES = [
    # ---- 微博（16）----
    {"name": "陈震同学", "platform": "weibo", "nick": "陈震同学", "kind": "person", "enabled": True},
    {"name": "袁启聪", "platform": "weibo", "nick": "袁启聪", "kind": "person", "enabled": True},
    {"name": "YYP颜宇鹏", "platform": "weibo", "nick": "YYP颜宇鹏", "kind": "person", "enabled": True},
    {"name": "PS3保罗", "platform": "weibo", "nick": "PS3保罗", "kind": "person", "enabled": True},
    {"name": "曾颖卓", "platform": "weibo", "nick": "叫节操卓的曾颖卓", "kind": "person", "enabled": True},
    {"name": "韩路", "platform": "weibo", "nick": "韩路", "kind": "person", "enabled": True},
    {"name": "初晓敏", "platform": "weibo", "nick": "初晓敏", "kind": "person", "enabled": True},
    {"name": "野生11", "platform": "weibo", "nick": "野生11", "kind": "person", "enabled": True},
    {"name": "詹志斌同学", "platform": "weibo", "nick": "詹志斌同学", "kind": "person", "enabled": True},
    {"name": "孙少军09", "platform": "weibo", "nick": "孙少军09", "kind": "person", "enabled": True},
    {"name": "-_-二师兄", "platform": "weibo", "nick": "-_-二师兄", "kind": "person", "enabled": True},
    {"name": "LAC-庆舍", "platform": "weibo", "nick": "LAC-庆舍", "kind": "person", "enabled": True},
    {"name": "极速拍档-小乔", "platform": "weibo", "nick": "极速拍档-小乔", "kind": "person", "enabled": True},
    {"name": "极速拍档-Jacky", "platform": "weibo", "nick": "极速拍档-Jacky", "kind": "person", "enabled": True},
    {"name": "键盘车神教", "platform": "weibo", "nick": "键盘车神教教主", "kind": "person", "enabled": True},
    {"name": "汽车评测员郭超", "platform": "weibo", "nick": "汽车评测员郭超", "kind": "person", "enabled": True},

    # ---- 抖音（8）----
    {"name": "大师说车", "platform": "douyin", "nick": "大师说车", "kind": "person", "enabled": False},
    {"name": "车坛老炮儿", "platform": "douyin", "nick": "车坛老炮儿", "kind": "person", "enabled": False},
    {"name": "超哥超车", "platform": "douyin", "nick": "超哥超车", "kind": "person", "enabled": False},
    {"name": "小刚学长", "platform": "douyin", "nick": "小刚学长", "kind": "person", "enabled": False},
    {"name": "名郑言顺", "platform": "douyin", "nick": "名郑言顺", "kind": "person", "enabled": False},
    {"name": "陈震同学", "platform": "douyin", "nick": "陈震同学", "kind": "person", "enabled": False},
    {"name": "说车的阿飞", "platform": "douyin", "nick": "说车的阿飞", "kind": "person", "enabled": False},
    {"name": "溜溜哥", "platform": "douyin", "nick": "溜溜哥", "kind": "person", "enabled": False},

    # ---- 门户（2）----
    {"name": "汽车之家", "platform": "autohome", "kind": "portal", "enabled": True},
    {"name": "懂车帝", "platform": "dongchedi", "kind": "portal", "enabled": False},
]

# 每个源每轮最多抓取的新条目数
MAX_POSTS_PER_SOURCE = 30

# 断更补齐窗口：最多回补多少天（含今天）。断更到今天超过该天数则只抓今天。
CATCHUP_WINDOW_DAYS = 4

# 断更补齐时每源最多抓取条数（回补多天可能超过常规一轮的 30 条）
MAX_CATCHUP_POSTS = 100

# 每个源内容达到该条数时触发清理（删掉最旧的 CULL_PER_SOURCE 条）
CULL_THRESHOLD = 100

# 触发清理后，一次删掉最旧的多少条
CULL_PER_SOURCE = 50

# 数据库文件路径（相对项目根目录）
DB_PATH = "data.db"
