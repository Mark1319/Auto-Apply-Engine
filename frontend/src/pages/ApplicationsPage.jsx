import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { useToast } from '../context/ToastContext'
import { Briefcase, ExternalLink, Trash2, ChevronDown } from 'lucide-react'

const STATUS_OPTIONS = ['applied', 'interview', 'offered', 'rejected', 'withdrawn']
const PLATFORM_LABELS = { linkedin: 'LinkedIn', indeed: 'Indeed', naukri: 'Naukri', internshala: 'Internshala', hirist: 'Hirist', instahire: 'Instahire' }
const PLATFORM_COLORS = { linkedin: '#0077b5', indeed: '#2164f3', naukri: '#ff7555', internshala: '#00aeef', hirist: '#7c3aed', instahire: '#059669' }

export default function ApplicationsPage() {
  const toast = useToast()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', platform: '' })

  const load = () => {
    setLoading(true)
    api.getApplications(filters)
      .then(setApps)
      .catch(() => toast('Failed to load applications', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filters])

  const updateStatus = async (id, status) => {
    try {
      await api.updateApplication(id, { status })
      setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a))
      toast('Status updated', 'success')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const deleteApp = async (id) => {
    try {
      await api.deleteApplication(id)
      setApps(prev => prev.filter(a => a.id !== id))
      toast('Application removed', 'info')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Applications</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Track all your job applications</p>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          style={{ width: 160 }}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          value={filters.platform}
          onChange={e => setFilters(f => ({ ...f, platform: e.target.value }))}
          style={{ width: 160 }}
        >
          <option value="">All platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span style={{ color: 'var(--text3)', fontSize: 12, marginLeft: 'auto', alignSelf: 'center' }}>
          {apps.length} results
        </span>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, color: 'var(--text2)', textAlign: 'center' }}>Loading...</div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={32} />
            <p>No applications found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job title</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Platform</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(app => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{app.title}</div>
                    </td>
                    <td style={{ color: 'var(--text2)' }}>{app.company}</td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>{app.location || '—'}</td>
                    <td>
                      <span className="platform-pill" style={{ borderColor: (PLATFORM_COLORS[app.platform] || '#6366f1') + '44', color: PLATFORM_COLORS[app.platform] || 'var(--accent2)' }}>
                        {PLATFORM_LABELS[app.platform] || app.platform}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                      {new Date(app.applied_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <span className={`badge badge-${app.status}`} style={{ paddingRight: 4 }}>
                          {app.status}
                        </span>
                        <select
                          value={app.status}
                          onChange={e => updateStatus(app.id, e.target.value)}
                          style={{
                            position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                            width: '100%', border: 'none', padding: 0
                          }}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {app.url && (
                          <a href={app.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" title="Open job posting">
                            <ExternalLink size={12} />
                          </a>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => deleteApp(app.id)} title="Remove">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
