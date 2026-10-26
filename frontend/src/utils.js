// 图片走代理
export function imgUrl(url) {
  if (!url) return ''
  return '/img?url=' + encodeURIComponent(url)
}

// 时间短格式 MM-DD HH:MM
export function timeShort(s) {
  if (!s) return ''
  return s.slice(5, 16)
}

// 中文日期 xxxx年xx月xx日
export function fmtDate(d) {
  if (!d) return ''
  const [y, m, dd] = d.split('-')
  return `${y}年${m}月${dd}日`
}

// HTML 转纯文本：<br>/<p>/<div> 转换行，移除所有标签和图片（表情图保留 alt 文字）
export function htmlToText(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  tmp.querySelectorAll('br').forEach(el => el.replaceWith('\n'))
  tmp.querySelectorAll('p,div').forEach(el => el.replaceWith(el.textContent + '\n'))
  tmp.querySelectorAll('img').forEach(el => {
    const alt = el.getAttribute('alt') || ''
    if (alt) el.replaceWith(alt)
    else el.remove()
  })
  return (tmp.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

// 平台标签配色
export const PLATFORM_COLOR = {
  weibo: 'bg-orange-100 text-orange-600',
  douyin: 'bg-slate-100 text-slate-600',
  autohome: 'bg-blue-100 text-blue-600',
  dongchedi: 'bg-rose-100 text-rose-600',
}

// 是否视频类型
export function isVideo(p) {
  return p.type === 'video_short' || p.type === 'video_long'
}

// 汽车之家正文：把懒加载的 data-src 转成代理 src，返回处理后的 HTML
export function processAutohomeContent(html) {
  const tmp = document.createElement('div')
  tmp.innerHTML = html || ''
  tmp.querySelectorAll('img').forEach(im => {
    const real = im.getAttribute('data-src') || im.getAttribute('src') || ''
    if (real && (real.startsWith('http') || real.startsWith('//'))) {
      const abs = real.startsWith('//') ? 'https:' + real : real
      im.setAttribute('src', '/img?url=' + encodeURIComponent(abs))
      im.removeAttribute('data-src')
    }
  })
  return tmp.innerHTML
}
