import { useState, useEffect, useRef } from 'react'
import * as api from '../api'

export default function WeiboLoginModal({ open, onSuccess, onClose }) {
  const [phase, setPhase] = useState('idle') // idle | waiting | success | failed
  const [message, setMessage] = useState('')
  const pollRef = useRef(null)

  // 打开/关闭时重置状态
  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setMessage('')
    }
  }, [open])

  // 组件卸载时清理轮询
  useEffect(() => () => clearInterval(pollRef.current), [])

  const start = async () => {
    setPhase('waiting')
    setMessage('已打开浏览器窗口，请用微博 App 扫码（或输入账号密码）登录…')
    try {
      await api.weiboLogin()
    } catch {
      setPhase('failed')
      setMessage('启动登录失败，请重试')
      return
    }
    pollRef.current = setInterval(async () => {
      let s
      try {
        s = await api.weiboLoginStatus()
      } catch {
        return
      }
      if (!s.running) {
        clearInterval(pollRef.current)
        if (s.success) {
          setPhase('success')
          setMessage('登录成功，正在更新数据…')
          onSuccess()
        } else {
          setPhase('failed')
          setMessage(s.message || '登录失败，请重试')
        }
      }
    }, 2000)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-white dark:bg-neutral-800 rounded-xl shadow-2xl w-96 p-6 text-center">
        {phase !== 'waiting' && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xl leading-none"
            title="稍后再说"
          >
            ×
          </button>
        )}
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">微博登录已失效</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">需要重新登录微博后才能更新内容</p>

        {phase === 'waiting' && (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-blue-600">
            <span className="inline-block animate-spin w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full shrink-0"></span>
            <span className="text-left">{message}</span>
          </div>
        )}
        {phase === 'failed' && (
          <div className="mt-4 text-sm text-red-500">{message}</div>
        )}
        {phase === 'success' && (
          <div className="mt-4 text-sm text-green-500">{message}</div>
        )}

        {(phase === 'idle' || phase === 'failed') && (
          <button
            onClick={start}
            className="mt-5 w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium"
          >
            {phase === 'failed' ? '重新登录' : '开始登录'}
          </button>
        )}
        {(phase === 'idle') && (
          <button
            onClick={onClose}
            className="mt-2 w-full py-2 text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            稍后再说
          </button>
        )}
      </div>
    </div>
  )
}
