import { useState, useEffect, useRef, useCallback } from 'react'
import { imgUrl } from '../utils'

const MIN_SCALE = 1
const MAX_SCALE = 5
const STEP = 1.25

export default function Lightbox({ lightbox, onClose }) {
  const images = lightbox.images
  const [index, setIndex] = useState(lightbox.index)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const imgRef = useRef(null)
  const scaleRef = useRef(1)
  const dragRef = useRef(null)

  // 缩放后限制拖拽范围，避免把图片完全拖出视野
  const clamp = useCallback((s, x, y) => {
    const el = imgRef.current
    if (!el || !el.offsetWidth) return { x, y }
    const maxX = (el.offsetWidth * s - el.offsetWidth) / 2
    const maxY = (el.offsetHeight * s - el.offsetHeight) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }, [])

  const reset = () => {
    setScale(1)
    scaleRef.current = 1
    setPos({ x: 0, y: 0 })
  }

  const zoomBy = (factor) => {
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleRef.current * factor))
    scaleRef.current = ns
    setScale(ns)
    setPos(p => (ns === MIN_SCALE ? { x: 0, y: 0 } : clamp(ns, p.x, p.y)))
  }
  const zoomIn = () => zoomBy(STEP)
  const zoomOut = () => zoomBy(1 / STEP)

  const prev = () => { setIndex(i => (i - 1 + images.length) % images.length); reset() }
  const next = () => { setIndex(i => (i + 1) % images.length); reset() }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-' || e.key === '_') zoomOut()
      else if (e.key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMouseDown = (e) => {
    if (scaleRef.current <= 1) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      if (!dragRef.current) return
      const { startX, startY, baseX, baseY } = dragRef.current
      setPos(clamp(
        scaleRef.current,
        baseX + (e.clientX - startX),
        baseY + (e.clientY - startY),
      ))
    }
    const onUp = () => { dragRef.current = null; setDragging(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, clamp])

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-40" onClick={onClose}></div>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <button
          onClick={prev}
          className="absolute left-3 z-10 text-white text-5xl opacity-60 hover:opacity-100 transition select-none"
        >
          ‹
        </button>
        <img
          ref={imgRef}
          src={imgUrl(images[index])}
          draggable={false}
          onMouseDown={onMouseDown}
          onDoubleClick={reset}
          className={`max-w-[85vw] max-h-[85vh] object-contain select-none ${
            scale > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
          }}
          alt=""
        />
        <button
          onClick={next}
          className="absolute right-3 z-10 text-white text-5xl opacity-60 hover:opacity-100 transition select-none"
        >
          ›
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1.5">
          <button
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="w-9 h-9 rounded-full text-white text-xl hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            −
          </button>
          <span className="text-white text-sm w-12 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="w-9 h-9 rounded-full text-white text-xl hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            +
          </button>
        </div>
      </div>
    </>
  )
}
