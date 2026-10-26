import { useState, useEffect, useRef, useCallback } from 'react'
import * as api from './api'
import Header from './components/Header'
import Feed from './components/Feed'
import DetailPanel from './components/DetailPanel'
import Lightbox from './components/Lightbox'
import Toast from './components/Toast'
import FloatingButtons from './components/FloatingButtons'
import Loading from './components/Loading'
import ProfileDrawer from './components/ProfileDrawer'
import WeiboLoginModal from './components/WeiboLoginModal'

const LIMIT = 20

export default function App() {
  const [type, setType] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [posts, setPosts] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [statsVersion, setStatsVersion] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [weiboLoginOpen, setWeiboLoginOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === '1' } catch { return false }
  })

  // 切换夜间模式：html 根元素加 dark class + 持久化
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    try { localStorage.setItem('darkMode', darkMode ? '1' : '0') } catch {}
  }, [darkMode])

  const offsetRef = useRef(0)
  const loadingRef = useRef(false)

  const loadPosts = useCallback(async (reset, force = false) => {
    if (loadingRef.current && !force) return null
    loadingRef.current = true
    try {
      const off = reset ? 0 : offsetRef.current
      const data = await api.getPosts({ type, limit: LIMIT, offset: off })
      setPosts(prev => (reset ? data : [...prev, ...data]))
      offsetRef.current = off + data.length
      setHasMore(data.length >= LIMIT)
      return data
    } finally {
      loadingRef.current = false
    }
  }, [type])

  // type 变化时重置
  useEffect(() => {
    setSelectedId(null)
    offsetRef.current = 0
    loadPosts(true)
    window.scrollTo(0, 0)
  }, [type, loadPosts])

  // 无限滚动
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300) {
        if (!loadingRef.current && hasMore) loadPosts(false)
      }
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [hasMore, loadPosts])

  // toast 自动消失
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000)
      return () => clearTimeout(t)
    }
  }, [toast])

  // 页面加载时根据设置决定是否自动抓取
  useEffect(() => {
    api.getSettings().then(s => {
      if (s.refresh_on_load) triggerRefresh()
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 页面打开时检测微博登录态，失效则弹出登录框
  useEffect(() => {
    api.checkWeiboLogin().then(r => {
      if (!r.logged_in) setWeiboLoginOpen(true)
    }).catch(() => {})
  }, [])

  // 标记已读：本地乐观更新 + 后台落库
  const markRead = (id) => {
    setPosts(prev => prev.map(p => (p.id === id && !p.read ? { ...p, read: true } : p)))
    api.markRead(id).catch(() => {})
  }

  // 选中某条内容（并标记已读）
  const selectPost = (id) => {
    setSelectedId(id)
    markRead(id)
  }

  // 选中 / 取消选中（点击列表卡片）
  const handleSelect = (id) => {
    if (selectedId === id) {
      setSelectedId(null)
    } else {
      selectPost(id)
    }
  }

  // 刷新（抓取）
  const triggerRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await api.refresh()
      await new Promise(r => setTimeout(r, 1000))
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const s = await api.getStatus()
        if (!s.running) {
          setRefreshing(false)
          setStatsVersion(v => v + 1)
          setSelectedId(null)
          offsetRef.current = 0
          await loadPosts(true, true)
          window.scrollTo(0, 0)
          if (s.weibo_login_invalid) {
            setToast('微博登录已失效，请重新登录')
            setWeiboLoginOpen(true)
          } else {
            setToast(s.last_new > 0 ? `更新完成，新增 ${s.last_new} 条` : '已是最新内容')
          }
          break
        }
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch {
      setRefreshing(false)
    }
  }

  const openLightbox = (images, index) => setLightbox({ images, index })
  const closeLightbox = () => setLightbox(null)

  const scrollToSelected = () => {
    if (!selectedId) return
    const card = document.querySelector(`[data-id="${selectedId}"]`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // 沉浸式模式：上一条 / 下一条
  const currentIndex = selectedId ? posts.findIndex(p => p.id === selectedId) : -1
  const prevId = currentIndex > 0 ? posts[currentIndex - 1].id : null
  const nextId = currentIndex >= 0 && currentIndex < posts.length - 1 ? posts[currentIndex + 1].id : null

  const toggleImmersive = () => {
    const next = !immersive
    setImmersive(next)
    if (next && !selectedId && posts.length > 0) {
      selectPost(posts[0].id)
    }
  }

  // 下一条：有下一条直接切；到末尾还有更多则加载下一页
  const goNext = async () => {
    if (nextId) {
      selectPost(nextId)
      return
    }
    if (hasMore) {
      const data = await loadPosts(false)
      if (data && data.length > 0) {
        selectPost(data[0].id)
      }
    }
  }

  return (
    <div className="bg-neutral-100 dark:bg-neutral-900 min-h-screen">
      <Header
        type={type}
        onTypeChange={setType}
        refreshing={refreshing}
        onRefresh={triggerRefresh}
        onOpenProfile={() => setProfileOpen(true)}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(v => !v)}
        immersive={immersive}
        onToggleImmersive={toggleImmersive}
      />
      <main className={`${immersive ? 'max-w-3xl' : 'max-w-7xl'} relative mx-auto px-4 py-4 flex gap-4 items-start`}>
        {!immersive && (
          <div className="w-1/2">
            <Feed posts={posts} selectedId={selectedId} onSelect={handleSelect} type={type} hasMore={hasMore} />
          </div>
        )}
        <DetailPanel
          selectedId={selectedId}
          type={type}
          statsVersion={statsVersion}
          onOpenLightbox={openLightbox}
          immersive={immersive}
        />
        {immersive && (
          <>
            <button
              onClick={() => prevId && selectPost(prevId)}
              disabled={!prevId}
              title="上一条"
              className="absolute -left-14 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 shadow-md flex items-center justify-center text-2xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition select-none"
            >
              ‹
            </button>
            <button
              onClick={goNext}
              disabled={!nextId && !hasMore}
              title="下一条"
              className="absolute -right-14 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 shadow-md flex items-center justify-center text-2xl text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition select-none"
            >
              ›
            </button>
          </>
        )}
      </main>
      <Loading visible={refreshing} />
      <Toast msg={toast} />
      {!immersive && <FloatingButtons selectedId={selectedId} onScrollSelected={scrollToSelected} />}
      {lightbox && <Lightbox lightbox={lightbox} onClose={closeLightbox} />}
      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        statsVersion={statsVersion}
      />
      <WeiboLoginModal
        open={weiboLoginOpen}
        onClose={() => setWeiboLoginOpen(false)}
        onSuccess={() => {
          setWeiboLoginOpen(false)
          triggerRefresh()
        }}
      />
    </div>
  )
}
