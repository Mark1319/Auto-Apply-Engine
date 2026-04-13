import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { Briefcase, TrendingUp, Award, XCircle, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const PLATFORM_COLORS = {
  linkedin: '#0077b5',
  indeed: '#2164f3',
  naukri: '#ff7555',
  internshala: '#00aeef',
  hirist: '#7c3aed',
  instahire: '#059669',
}

const PLATFORM_LABELS = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  internshala: 'Internshala',
  hirist: 'Hirist',
  instahire: 'Instahire',
}

const STATUS_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444']
const STATUS_LABELS = ['Applied', 'Interview', 'Offered', 'Rejected']

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getStats(), api.getApplications()])
      .then(([s, a]) => { setStats(s); setApplications(a) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 32, color: 'var(--text2)' }}>Loading...</div>

  const statCards = [
    { label: 'Total Applied', value: stats?.total || 0, icon: Briefcase, color: 'var(--accent2)' },
    { label: 'Interviews', value: stats?.interview || 0, icon: TrendingUp, color: 'var(--amber)' },
    { label: 'Offers', value: stats?.offered || 0, icon: Award, color: 'var(--green)' },
    { label: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'var(--red)' },
  ]

  const platformData = Object.entries(stats?.by_platform || {}).map(([k, v]) => ({
    name: PLATFORM_LABELS[k] || k,
    count: v,
    color: PLATFORM_COLORS[k] || '#6366f1',
  }))

  const statusData = [
    { name: 'Applied', value: stats?.applied || 0 },
    { name: 'Interview', value: stats?.interview || 0 },
    { name: 'Offered', value: stats?.offered || 0 },
    { name: 'Rejected', value: stats?.rejected || 0 },
  ].filter(d => d.value > 0)

  const recent = applications.slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text2)', marginTop: 2, fontSize: 13 }}>Overview of your job applications</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="stat-label">{label}</span>
              <Icon size={16} color={color} />
            </div>
            <span className="stat-value" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={15} color="var(--accent2)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>By Platform</span>
          </div>
          {platformData.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={platformData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--text2)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {platformData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={15} color="var(--accent2)" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Status breakdown</span>
          </div>
          {statusData.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}><p>No data yet</p></div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} dataKey="value">
                    {statusData.map((d, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {statusData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[i % STATUS_COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text2)' }}>{d.name}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, marginLeft: 'auto' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent applications */}
      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Recent applications</span>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={32} />
            <p>No applications yet. Start auto-applying!</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Job title</th>
                  <th>Company</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(app => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 500 }}>{app.title}</td>
                    <td style={{ color: 'var(--text2)' }}>{app.company}</td>
                    <td>
                      <span className="platform-pill" style={{ borderColor: PLATFORM_COLORS[app.platform] + '44', color: PLATFORM_COLORS[app.platform] }}>
                        {PLATFORM_LABELS[app.platform] || app.platform}
                      </span>
                    </td>
                    <td><span className={`badge badge-${app.status}`}>{app.status}</span></td>
                    <td style={{ color: 'var(--text3)' }}>{new Date(app.applied_at).toLocaleDateString()}</td>
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
