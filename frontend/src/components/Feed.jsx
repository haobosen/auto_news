import { isVideo } from '../utils'
import ImageCard from './ImageCard'
import VideoCard from './VideoCard'

export default function Feed({ posts, selectedId, onSelect, type, hasMore }) {
  const showVideoBadge = type === ''

  return (
    <div className="space-y-2.5">
      {posts.map(post =>
        isVideo(post) ? (
          <VideoCard
            key={post.id}
            post={post}
            selected={post.id === selectedId}
            onSelect={onSelect}
            showBadge={showVideoBadge}
          />
        ) : (
          <ImageCard
            key={post.id}
            post={post}
            selected={post.id === selectedId}
            onSelect={onSelect}
          />
        )
      )}
      {posts.length === 0 && (
        <div className="py-20 text-center text-neutral-400">还没有内容，先点右上角刷新抓取。</div>
      )}
      {!hasMore && posts.length > 0 && (
        <div className="py-6 text-center text-xs text-neutral-300">— 到底了 —</div>
      )}
    </div>
  )
}
