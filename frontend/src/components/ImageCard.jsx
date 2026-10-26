import { imgUrl, timeShort, PLATFORM_COLOR } from '../utils'

export default function ImageCard({ post, selected, onSelect }) {
  const extra = post.extra || {}
  const likes = Math.max(0, Number(extra.likes) || 0)
  const comments = Math.max(0, Number(extra.comments) || 0)

  return (
    <a
      href={`/post/${post.id}`}
      data-id={post.id}
      onClick={(e) => { e.preventDefault(); onSelect(post.id) }}
      className={`relative flex items-center gap-3 bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-sm dark:shadow-none dark:border dark:border-neutral-800 transition cursor-pointer hover:shadow-md ${
        selected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-500/10' : ''
      }`}
    >
      {!post.read && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-800" />
      )}
      <div className="flex-1 min-w-0">
        <div className="clamp-5-fixed text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {post.title || post.summary || '(无标题)'}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span className={`px-1.5 py-0.5 rounded ${PLATFORM_COLOR[post.platform] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600'}`}>
            {post.platform}
          </span>
          {post.source_avatar && (
            <img src={imgUrl(post.source_avatar)} className="w-6 h-6 rounded-full object-cover shrink-0" onError={(e) => e.target.remove()} alt="" />
          )}
          <span className="truncate max-w-[8rem] text-sm text-neutral-700 dark:text-neutral-200">{post.source_name || post.author || ''}</span>
          <span className="shrink-0 ml-auto">
            {timeShort(post.published_at)} · 赞{likes} · 评{comments}
          </span>
        </div>
      </div>
      {post.cover && (
        <div className="w-1/4 self-stretch relative rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-700">
          <img
            src={imgUrl(post.cover)}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.parentElement.remove() }}
            alt=""
          />
        </div>
      )}
    </a>
  )
}
