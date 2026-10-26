import { useState, useEffect } from 'react'
import * as api from '../api'
import {
  imgUrl, timeShort, PLATFORM_COLOR, htmlToText, processAutohomeContent, isVideo,
} from '../utils'
import CommentList from './CommentList'

export default function PostDetail({ id, onOpenLightbox }) {
  const [post, setPost] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getPost(id).then(p => { if (!cancelled) setPost(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [id])

  if (!post) return <DetailSkeleton />

  return isVideo(post)
    ? <VideoDetail post={post} />
    : <ImageDetail post={post} onOpenLightbox={onOpenLightbox} />
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0"></div>
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 rounded bg-neutral-200 dark:bg-neutral-700"></div>
          <div className="h-3 w-20 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-5 w-4/5 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        <div className="h-5 w-3/5 rounded bg-neutral-200 dark:bg-neutral-700"></div>
      </div>
      <div className="mt-5 space-y-2.5">
        <div className="h-3.5 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        <div className="h-3.5 w-11/12 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        <div className="h-3.5 w-5/6 rounded bg-neutral-200 dark:bg-neutral-700"></div>
        <div className="h-3.5 w-3/5 rounded bg-neutral-200 dark:bg-neutral-700"></div>
      </div>
      <div className="mt-5 h-44 rounded-xl bg-neutral-200 dark:bg-neutral-700"></div>
    </div>
  )
}

function Footer({ post, extra }) {
  return (
    <div className="mt-5 flex items-center gap-3">
      <a
        href={post.url}
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 bg-blue-600 text-white text-sm rounded-full hover:bg-blue-500"
      >
        去原文查看 →
      </a>
      {extra.likes != null && (
        <span className="text-xs text-neutral-400">
          赞 {extra.likes} · 评论 {extra.comments ?? 0} · 转发 {extra.reposts ?? 0}
        </span>
      )}
    </div>
  )
}

function VideoDetail({ post }) {
  const extra = post.extra || {}
  return (
    <>
      <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`px-1.5 py-0.5 rounded ${PLATFORM_COLOR[post.platform] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600'}`}>
          {post.platform}
        </span>
        {post.source_avatar && (
          <img src={imgUrl(post.source_avatar)} className="w-9 h-9 rounded-full object-cover shrink-0" onError={(e) => e.target.remove()} alt="" />
        )}
        <span className="truncate text-sm text-neutral-700 dark:text-neutral-200">{post.source_name || post.author || ''}</span>
        <span className="shrink-0 ml-auto">{timeShort(post.published_at)}</span>
      </div>
      <div className="mt-2 text-base font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
        {post.title || post.summary || '(无标题)'}
      </div>
      <VideoPlayer post={post} />
      <div className="mt-4 flex items-center gap-3">
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="px-5 py-2 bg-blue-600 text-white text-sm rounded-full hover:bg-blue-500"
        >
          去原文查看 →
        </a>
        {extra.likes != null && <span className="text-xs text-neutral-400">赞 {extra.likes}</span>}
      </div>
      <CommentList postId={post.id} platform={post.platform} />
    </>
  )
}

function VideoPlayer({ post }) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden mt-3">
        {/* 走后端 /video 代理，由后端带 weibo Referer 转发，绕过防盗链 */}
        <video controls preload="auto" className="w-full h-full" src={`/video/${post.id}`} />
      </div>
    )
  }

  return (
    <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden mt-3">
      {post.cover && (
        <img
          src={imgUrl(post.cover)}
          className="w-full h-full object-cover bg-neutral-200 dark:bg-neutral-700 animate-pulse"
          onLoad={(e) => { e.currentTarget.classList.remove('animate-pulse') }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          alt=""
        />
      )}
      <button
        onClick={() => setPlaying(true)}
        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
      >
        <span className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center text-white text-2xl">▶</span>
      </button>
    </div>
  )
}

function ImageDetail({ post, onOpenLightbox }) {
  const extra = post.extra || {}
  const isWeibo = post.platform === 'weibo'

  if (isWeibo) {
    const pics = extra.pics || []
    const locationHtml = extra.location ? (
      <div className="flex items-center gap-1 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{extra.location}</span>
      </div>
    ) : null

    return (
      <>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-xs ${PLATFORM_COLOR[post.platform] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600'}`}>
              {post.platform}
            </span>
            {post.source_avatar && (
              <img src={imgUrl(post.source_avatar)} className="w-9 h-9 rounded-full object-cover shrink-0" onError={(e) => e.target.remove()} alt="" />
            )}
            <span className="text-base font-semibold text-neutral-800 dark:text-neutral-100">{post.author || post.source_name || ''}</span>
          </div>
          <span className="text-xs text-neutral-400">{timeShort(post.published_at)}</span>
        </div>
        {locationHtml}
        <div className="post-body mt-3 text-neutral-800 dark:text-neutral-100 dark:text-neutral-100" style={{ whiteSpace: 'pre-line' }}>
          {htmlToText(post.content)}
        </div>
        <WeiboImages pics={pics} onOpenLightbox={onOpenLightbox} />
        <Footer post={post} extra={extra} />
        <CommentList postId={post.id} platform={post.platform} />
      </>
    )
  }

  // 汽车之家
  return (
    <>
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`px-2 py-0.5 rounded ${PLATFORM_COLOR[post.platform] || 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600'}`}>
          图文 · {post.platform}
        </span>
        <span>{post.published_at ? post.published_at.slice(0, 16) : ''}</span>
      </div>
      <h1 className="mt-3 text-lg font-bold text-neutral-900 dark:text-neutral-100">{post.title || post.summary || '(无标题)'}</h1>
      <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{post.author || post.source_name || ''}</div>
      <div
        className="post-body mt-4 text-neutral-800 dark:text-neutral-100 dark:text-neutral-100"
        dangerouslySetInnerHTML={{ __html: processAutohomeContent(post.content) }}
      />
      <Footer post={post} extra={extra} />
      <CommentList postId={post.id} platform={post.platform} />
    </>
  )
}

function Pic({ src, onClick, fixedHeight }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <div className={`relative rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-700 ${fixedHeight ? 'h-40' : 'min-h-[220px]'}`}>
      {!loaded && <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-700 animate-pulse" />}
      <img
        src={imgUrl(src)}
        loading="lazy"
        onClick={onClick}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full cursor-pointer transition-opacity duration-300 ${fixedHeight ? 'h-40 object-cover' : 'h-auto'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
        alt=""
      />
    </div>
  )
}

function WeiboImages({ pics, onOpenLightbox }) {
  if (!pics || !pics.length) return null

  if (pics.length === 1) {
    return (
      <div className="mt-4">
        <Pic src={pics[0]} onClick={() => onOpenLightbox(pics, 0)} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {pics.map((u, i) => (
        <Pic key={i} src={u} onClick={() => onOpenLightbox(pics, i)} fixedHeight />
      ))}
    </div>
  )
}
