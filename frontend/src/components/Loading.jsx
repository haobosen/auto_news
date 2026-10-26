export default function Loading({ visible }) {
  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-lg rounded-full px-5 py-2 flex items-center gap-2 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="inline-block animate-spin w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full"></div>
      <span className="text-sm text-neutral-600">更新中…</span>
    </div>
  )
}
