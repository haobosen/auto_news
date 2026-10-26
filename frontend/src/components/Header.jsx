const TYPES = [
  { key: '', label: '全部' },
  { key: 'image', label: '图文' },
  { key: 'video', label: '视频' },
]

export default function Header({ type, onTypeChange, refreshing, onRefresh, onOpenProfile, darkMode, onToggleDark, immersive, onToggleImmersive }) {
  return (
    <header className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-3">
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 shrink-0">汽车资讯聚合</h1>
        <div className="flex gap-1.5">
          {!immersive && TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => onTypeChange(t.key)}
              className={`px-3 py-0.5 text-sm rounded-full border ${
                type === t.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="ml-auto px-3 py-1 text-sm rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-60 shrink-0"
        >
          {refreshing ? '更新中…' : '↻ 刷新'}
        </button>
        <button
          onClick={onOpenProfile}
          className="px-3 py-1 text-sm rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 shrink-0"
        >
          个人中心
        </button>
        <button
          onClick={onToggleDark}
          title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
          className="px-2.5 py-1 text-sm rounded-full border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 shrink-0"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button
          onClick={onToggleImmersive}
          title={immersive ? '退出沉浸式' : '沉浸式观看'}
          className={`px-3 py-1 text-sm rounded-full border shrink-0 ${
            immersive
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          {immersive ? '退出沉浸' : '沉浸式'}
        </button>
      </div>
    </header>
  )
}
