const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Profile
  getProfile: () => req('/profile'),
  saveProfile: (data) => req('/profile', { method: 'POST', body: JSON.stringify(data) }),

  // Resumes
  listResumes: () => req('/resumes'),
  uploadResume: (file) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(BASE + '/resumes/upload', { method: 'POST', body: form }).then(r => r.json())
  },
  deleteResume: (id) => req(`/resumes/${id}`, { method: 'DELETE' }),
  setDefaultResume: (id) => req(`/resumes/${id}/set-default`, { method: 'PATCH' }),

  // Filters
  getFilters: () => req('/filters'),
  saveFilters: (data) => req('/filters', { method: 'POST', body: JSON.stringify(data) }),

  // Applications
  getApplications: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v))
    return req('/applications' + (q.toString() ? '?' + q : ''))
  },
  updateApplication: (id, data) => req(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteApplication: (id) => req(`/applications/${id}`, { method: 'DELETE' }),
  getStats: () => req('/applications/stats'),

  // Auto Apply
  startAutoApply: (data) => req('/auto-apply/start', { method: 'POST', body: JSON.stringify(data) }),
  getSessionStatus: (id) => req(`/auto-apply/status/${id}`),
  stopSession: (id) => req(`/auto-apply/stop/${id}`, { method: 'POST' }),
}
