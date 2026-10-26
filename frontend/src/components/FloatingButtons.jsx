export default function FloatingButtons({ selectedId, onScrollSelected }) {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <div className="fixed bottom-6 floating-left flex flex-col gap-2 z-30">
      <button
        onClick={scrollToTop}
        title="回到顶部"
        className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:bg-neutral-700"
      >
        ↑
      </button>
      <button
        onClick={onScrollSelected}
        disabled={!selectedId}
        title="回到已选中内容"
        className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-800 shadow-md flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ◎
      </button>
    </div>
  )
}
