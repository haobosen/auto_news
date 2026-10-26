import { useState, useEffect } from 'react'
import * as api from '../api'
import { fmtDate } from '../utils'

export default function StatsPanel({ type, statsVersion }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getStats().then(s => { if (!cancelled) setStats(s) }).catch(() => setStats(null))
    return () => { cancelled = true }
  }, [type, statsVersion])

  if (!stats) {
    return <div className="h-full flex items-center justify-center text-neutral-400 text-sm">加载中…</div>
  }

  const range = stats.min_date && stats.max_date
    ? `${fmtDate(stats.min_date)} ~ ${fmtDate(stats.max_date)}`
    : '暂无'
  const lastRun = stats.last_run
    ? `最近更新：${stats.last_run.slice(0, 16)} · 新增 ${stats.last_new || 0} 条`
    : '最近更新：暂无'

  const head = (label, num, unit) => (
    <>
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="text-4xl font-medium text-neutral-900 dark:text-neutral-100 mt-2">{num}</div>
      <div className="text-xs text-neutral-400 mt-1">{unit}</div>
    </>
  )

  if (type === 'image') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        {head('图文数据', stats.images, '条图文')}
        <div className="mt-8 text-xs text-neutral-400">数据范围：{range}</div>
        <div className="mt-2 text-xs text-neutral-400">{lastRun}</div>
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        {head('视频数据', stats.videos, '条视频')}
        <div className="mt-8 text-xs text-neutral-400">数据范围：{range}</div>
        <div className="mt-2 text-xs text-neutral-400">{lastRun}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      {head('全部数据', stats.total, '条内容')}
      <div className="flex gap-3 mt-5 w-full max-w-xs">
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-3">
          <div className="text-lg font-medium text-neutral-800 dark:text-neutral-100">{stats.images}</div>
          <div className="text-xs text-neutral-400 mt-0.5">图文</div>
        </div>
        <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-3">
          <div className="text-lg font-medium text-neutral-800 dark:text-neutral-100">{stats.videos}</div>
          <div className="text-xs text-neutral-400 mt-0.5">视频</div>
        </div>
      </div>
      <div className="mt-5 text-xs text-neutral-400">数据范围：{range}</div>
      <div className="mt-2 text-xs text-neutral-400">{lastRun}</div>
    </div>
  )
}
