async function request(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function getPosts({ type = '', limit = 20, offset = 0 }) {
  const params = new URLSearchParams({ type, limit: String(limit), offset: String(offset) })
  return request(`/api/posts?${params}`)
}

export function getPost(id) {
  return request(`/api/posts/${id}`)
}

export function markRead(id) {
  return request(`/api/posts/${id}/read`, { method: 'POST' })
}

export function getComments(id) {
  return request(`/api/comments/${id}`)
}

export function getVideo(id) {
  return request(`/api/video/${id}`)
}

export function refresh() {
  return request('/api/refresh', { method: 'POST' })
}

export function getStatus() {
  return request('/api/status')
}

export function getStats() {
  return request('/api/stats')
}

export function getSettings() {
  return request('/api/settings')
}

export function setSettings(payload) {
  return request('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function getSources() {
  return request('/api/sources')
}

export function deleteSource(id) {
  return request(`/api/sources/${id}`, { method: 'DELETE' })
}

export function searchUsers(q) {
  return request(`/api/search/users?q=${encodeURIComponent(q)}`)
}

export function addSource(payload) {
  return request('/api/sources/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function checkWeiboLogin() {
  return request('/api/weibo/check')
}

export function weiboLogin() {
  return request('/api/weibo/login', { method: 'POST' })
}

export function weiboLoginStatus() {
  return request('/api/weibo/login/status')
}
