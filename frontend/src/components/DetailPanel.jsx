import { useRef, useEffect } from 'react'
import StatsPanel from './StatsPanel'
import PostDetail from './PostDetail'

export default function DetailPanel({ selectedId, type, statsVersion, onOpenLightbox, immersive }) {
  const panelRef = useRef(null)

  // 切换选中项时，详情滚动条回到顶部
  useEffect(() => {
    if (selectedId && panelRef.current) {
      panelRef.current.scrollTop = 0
    }
  }, [selectedId])

  return (
    <>
      <aside
        ref={panelRef}
        className={`${immersive ? 'w-full' : 'w-1/2'} sticky top-16 rounded-xl overflow-y-auto thin-scrollbar h-[calc(100vh_-_80px)] shadow-sm ${
          selectedId ? 'bg-white dark:bg-neutral-800 p-5' : 'bg-[#ECECEE] dark:bg-neutral-800'
        }`}
      >
        {selectedId ? (
          <PostDetail id={selectedId} onOpenLightbox={onOpenLightbox} />
        ) : (
          <StatsPanel type={type} statsVersion={statsVersion} />
        )}
      </aside>
      {selectedId && (
        <button
          onClick={() => panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          title="返回顶部"
          className={`w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:bg-neutral-700 z-30 ${
            immersive ? 'absolute -right-14 bottom-6' : 'fixed bottom-6 floating-right'
          }`}
        >
          ↑
        </button>
      )}
    </>
  )
}
