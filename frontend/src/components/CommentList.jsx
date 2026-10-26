import { useState, useEffect } from 'react'
import * as api from '../api'
import { imgUrl, htmlToText } from '../utils'

export default function CommentList({ postId, platform }) {
  const [comments, setComments] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getComments(postId).then(d => { if (!cancelled) setComments(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [postId])

  if (!comments) return <CommentLoading />
  if (!comments.comments || !comments.comments.length) return null

  return (
    <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
      <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">评论 {comments.total}</div>
      {comments.comments.map((c, i) => (
        <CommentItem key={i} comment={c} platform={platform} />
      ))}
    </div>
  )
}

function CommentLoading() {
  return (
    <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 animate-pulse">
      <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700 mb-4"></div>
      {[0, 1].map(i => (
        <div key={i} className="flex gap-2.5 py-3">
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-700"></div>
            <div className="h-3.5 rounded bg-neutral-200 dark:bg-neutral-700"></div>
            <div className="h-3.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-700"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CommentItem({ comment, platform }) {
  const replies = comment.replies || []

  return (
    <div className="border-b border-neutral-100 dark:border-neutral-700 py-3">
      <CommentRow comment={comment} platform={platform} />
      {replies.length > 0 && (
        <div className="mt-1 pl-3 border-l-2 border-neutral-100 dark:border-neutral-700">
          {replies.map((r, i) => (
            <div key={i} className="py-2">
              <CommentRow comment={r} platform={platform} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CommentRow({ comment, platform }) {
  const text = platform === 'weibo' ? htmlToText(comment.text) : comment.text
  return (
    <div className="flex gap-2.5">
      <Avatar avatar={comment.avatar} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{comment.author}</span>
          <span className="text-neutral-300">{comment.created_at ? comment.created_at.slice(5, 16) : ''}</span>
        </div>
        <div className="text-sm text-neutral-700 dark:text-neutral-200 mt-1 leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
          {text}
        </div>
      </div>
      {comment.likes ? <span className="text-xs text-neutral-400 shrink-0">赞 {comment.likes}</span> : null}
    </div>
  )
}

function Avatar({ avatar }) {
  const [failed, setFailed] = useState(false)
  if (!avatar || failed) {
    return <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0"></div>
  }
  return (
    <img
      src={imgUrl(avatar)}
      className="w-8 h-8 rounded-full object-cover shrink-0 bg-neutral-100 dark:bg-neutral-700"
      onError={() => setFailed(true)}
      alt=""
    />
  )
}
