import { useState, useEffect, useRef } from 'react'
import * as api from '../api'
import { fmtDate, imgUrl } from '../utils'

export default function ProfileDrawer({ open, onClose, statsVersion }) {
  const [stats, setStats] = useState(null)
  const [sources, setSources] = useState([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api.getStats().then(s => { if (!cancelled) setStats(s) }).catch(() => {})
    api.getSources().then(s => { if (!cancelled) setSources(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [open, statsVersion])

  const portals = sources.filter(s => s.kind === 'portal')
  const persons = sources.filter(s => s.kind !== 'portal')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingUid, setAddingUid] = useState(null)
  const [settings, setSettings] = useState(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!open) return
    api.getSettings().then(setSettings).catch(() => {})
  }, [open])

  // 点击搜索区域以外时收起下拉框
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchResults([])
        setSearchKeyword('')
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const updateSetting = async (patch) => {
    setSettings(prev => ({ ...(prev || {}), ...patch }))
    try {
      await api.setSettings(patch)
    } catch {
      // 忽略
    }
  }

  const handleSearch = async (kw) => {
    setSearchKeyword(kw)
    if (!kw.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await api.searchUsers(kw)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = async (user) => {
    if (addingUid) return
    setAddingUid(user.uid)
    try {
      await api.addSource({ name: user.name, uid: user.uid, avatar: user.avatar })
      const s = await api.getSources()
      setSources(s)
      setSearchResults([])
      setSearchKeyword('')
    } catch {
      // 忽略添加失败
    } finally {
      setAddingUid(null)
    }
  }

  const handleDeleteClick = (s, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const btnCenterX = rect.left + rect.width / 2
    const bubbleWidth = 224
    const margin = 14 // 箭头中心到气泡边缘的最小距离
    // 气泡理想位置：箭头在气泡左侧留白处，且箭头中心对齐按钮
    let bubbleLeft = btnCenterX - 6 - margin
    bubbleLeft = Math.max(8, Math.min(bubbleLeft, window.innerWidth - bubbleWidth - 8))
    // 箭头在气泡内的位置，clamp 到 [margin, bubbleWidth - margin]，保证不贴边不超出
    let arrowLeft = btnCenterX - bubbleLeft - 6
    arrowLeft = Math.max(margin, Math.min(arrowLeft, bubbleWidth - margin))
    setPendingDelete({ source: s, x: bubbleLeft, y: rect.bottom + 6, arrowLeft })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await api.deleteSource(pendingDelete.source.id)
      setSources(prev => prev.filter(s => s.id !== pendingDelete.source.id))
    } catch {
      // 忽略删除失败
    }
    setPendingDelete(null)
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-20 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>
      <aside
        className={`fixed top-0 right-0 h-full w-1/3 bg-white dark:bg-neutral-800 z-30 transform transition-transform duration-300 flex flex-col shadow-xl ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="shrink-0 border-b px-5 h-12 flex items-center justify-between">
          <span className="text-base font-semibold text-neutral-800 dark:text-neutral-100 dark:text-neutral-100">个人中心</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:text-neutral-200 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar p-5">
          {/* 数据面板 */}
          <section>
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3">数据面板</h2>
            {stats ? <StatsSummary stats={stats} platformCount={portals.length} bloggerCount={persons.length} /> : <div className="text-neutral-400 text-sm">加载中…</div>}
          </section>

          {/* 信息来源 */}
          <section className="mt-6">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3">信息来源</h2>

            <h3 className="text-xs text-neutral-400 mb-2">平台</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {portals.map(s => (
                <span key={s.id} className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-sm text-neutral-700 dark:text-neutral-200">
                  {s.avatar && (
                    <img src={imgUrl(s.avatar)} className="w-5 h-5 rounded-full object-cover mr-1.5" onError={(e) => e.target.remove()} alt="" />
                  )}
                  {s.name}
                  <span className="ml-1.5 px-1.5 rounded-full text-xs bg-white/60 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300">{s.post_count ?? 0}</span>
                </span>
              ))}
            </div>

            <h3 className="text-xs text-neutral-400 mb-2">微博博主</h3>
            <div ref={searchRef}>
              <input
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索博主（粉丝 20 万+）"
                className="w-full px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg mb-2 focus:outline-none focus:border-blue-500"
              />
              {searching && <div className="text-xs text-neutral-400 mb-2">搜索中…</div>}
              {searchResults.length > 0 && (
                <div className="border border-neutral-100 dark:border-neutral-800 rounded-xl mb-2 max-h-48 overflow-y-auto thin-scrollbar">
                  {searchResults.map(u => (
                    <button
                      key={u.uid}
                      onClick={() => handleAdd(u)}
                      disabled={addingUid === u.uid}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700 last:border-b-0 disabled:opacity-60 disabled:cursor-wait"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {u.avatar && (
                          <img src={imgUrl(u.avatar)} className="w-5 h-5 rounded-full object-cover shrink-0" onError={(e) => e.target.remove()} alt="" />
                        )}
                        <span className="truncate">{u.name}</span>
                      </span>
                      {addingUid === u.uid ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-500">
                          <span className="inline-block animate-spin w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full"></span>
                          添加中…
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">{formatFollowers(u.followers)}粉丝</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {persons.map(s => (
                <span key={s.id} className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-700 text-sm text-neutral-700 dark:text-neutral-200">
                  {s.avatar && (
                    <img src={imgUrl(s.avatar)} className="w-5 h-5 rounded-full object-cover mr-1.5" onError={(e) => e.target.remove()} alt="" />
                  )}
                  {s.name}
                  <span className="ml-1.5 px-1.5 rounded-full text-xs bg-white/60 dark:bg-neutral-600 text-neutral-500 dark:text-neutral-300">{s.post_count ?? 0}</span>
                  <button onClick={(e) => handleDeleteClick(s, e)} className="ml-1.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-300 leading-none" title="删除">×</button>
                </span>
              ))}
            </div>
          </section>

          {/* 更新设置 */}
          <section className="mt-6">
            <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-3">更新设置</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">刷新页面时自动更新</span>
                <Toggle checked={!!settings?.refresh_on_load} onChange={(v) => updateSetting({ refresh_on_load: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">定时更新</span>
                <Toggle checked={!!settings?.auto_update} onChange={(v) => updateSetting({ auto_update: v })} />
              </div>
              {settings?.auto_update && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">每</span>
                  <input
                    type="number"
                    min="1"
                    value={settings?.update_interval ?? 30}
                    onChange={(e) => updateSetting({ update_interval: Number(e.target.value) || 1 })}
                    className="w-16 px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-700 dark:text-neutral-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">分钟更新一次</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </aside>

      {pendingDelete && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPendingDelete(null)}></div>
          <div className="fixed z-50" style={{ left: pendingDelete.x, top: pendingDelete.y }}>
            <div className="relative bg-neutral-900 text-white rounded-md px-3 py-2 text-xs shadow-lg" style={{ width: 224 }}>
              <div
                className="absolute"
                style={{ top: -6, left: pendingDelete.arrowLeft, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid #1e293b' }}
              ></div>
              <div className="break-words">确定不看「{pendingDelete.source.name}」吗？</div>
              <div className="flex items-center justify-end gap-3 mt-1.5">
                <button onClick={() => setPendingDelete(null)} className="text-neutral-300 hover:text-white">取消</button>
                <button onClick={confirmDelete} className="text-red-400 hover:text-red-300 font-medium">确认</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function formatFollowers(n) {
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿'
  if (n >= 10000) return Math.round(n / 10000) + '万'
  return String(n)
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`relative w-10 h-5 rounded-full shrink-0 transition-colors duration-200 ${
        checked ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-600'
      }`}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? '2px' : '22px' }}
      ></span>
    </button>
  )
}

function StatsSummary({ stats, platformCount, bloggerCount }) {
  const range = stats.min_date && stats.max_date
    ? `${fmtDate(stats.min_date)} ~ ${fmtDate(stats.max_date)}`
    : '暂无'
  const lastRun = stats.last_run
    ? `最近更新：${stats.last_run.slice(0, 16)} · 新增 ${stats.last_new || 0} 条`
    : '最近更新：暂无'

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4">
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-3xl font-semibold text-neutral-700 dark:text-neutral-200">{stats.total}</div>
          <div className="text-xs text-neutral-400 mt-1">全部内容</div>
        </div>
        <div>
          <div className="text-3xl font-semibold text-neutral-700 dark:text-neutral-200">{stats.images}</div>
          <div className="text-xs text-neutral-400 mt-1">图文</div>
        </div>
        <div>
          <div className="text-3xl font-semibold text-neutral-700 dark:text-neutral-200">{stats.videos}</div>
          <div className="text-xs text-neutral-400 mt-1">视频</div>
        </div>
        <div>
          <div className="text-3xl font-semibold text-neutral-700 dark:text-neutral-200">{stats.cumulative ?? 0}</div>
          <div className="text-xs text-neutral-400 mt-1">累计内容</div>
        </div>
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex items-baseline gap-1">
          <span className="text-base font-medium text-neutral-700 dark:text-neutral-200">{platformCount}</span>
          <span className="text-xs text-neutral-400">个平台</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-medium text-neutral-700 dark:text-neutral-200">{bloggerCount}</span>
          <span className="text-xs text-neutral-400">个博主</span>
        </div>
      </div>
      <div className="mt-3 text-xs text-neutral-400">数据范围：{range}</div>
      <div className="mt-1 text-xs text-neutral-400">{lastRun}</div>
    </div>
  )
}
