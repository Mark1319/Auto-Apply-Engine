import { useState } from 'react'
import { ToastProvider } from './context/ToastContext'
import Dashboard from './pages/Dashboard'
import ProfilePage from './pages/ProfilePage'
import ResumesPage from './pages/ResumesPage'
import FiltersPage from './pages/FiltersPage'
import ApplicationsPage from './pages/ApplicationsPage'
import AutoApplyPage from './pages/AutoApplyPage'
import {
  LayoutDashboard, User, FileText, Filter, Briefcase, Zap, ChevronRight
} from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'resumes', label: 'Resumes', icon: FileText },
  { id: 'filters', label: 'Job filters', icon: Filter },
  { id: 'applications', label: 'Applications', icon: Briefcase },
  { id: 'auto-apply', label: 'Auto apply', icon: Zap, accent: true },
]

const PAGES = {
  dashboard: Dashboard,
  profile: ProfilePage,
  resumes: ResumesPage,
  filters: FiltersPage,
  applications: ApplicationsPage,
  'auto-apply': AutoApplyPage,
}

function App() {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const Page = PAGES[page]

  return (
    <ToastProvider>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{
          width: sidebarOpen ? 220 : 56,
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 10px',
          gap: 4,
          transition: 'width 0.2s',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'hidden',
        }}>
          {/* Logo */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px',
            marginBottom: 16, cursor: 'pointer', overflow: 'hidden',
          }} onClick={() => setSidebarOpen(o => !o)}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Zap size={15} color="#fff" />
            </div>
            {sidebarOpen && (
              <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                AutoApply
              </span>
            )}
          </div>

          {/* Nav items */}
          {NAV.map(({ id, label, icon: Icon, accent }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
              style={accent && page !== id ? { color: 'var(--accent2)' } : {}}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              {accent && sidebarOpen && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--accent)', color: '#fff',
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 20,
                  letterSpacing: '0.05em'
                }}>NEW</span>
              )}
            </button>
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Toggle button */}
          <button
            className="nav-item"
            onClick={() => setSidebarOpen(o => !o)}
            title="Toggle sidebar"
            style={{ justifyContent: sidebarOpen ? 'flex-start' : 'center' }}
          >
            <ChevronRight size={15} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: 28, overflowY: 'auto', minWidth: 0 }}>
          <Page />
        </main>
      </div>
    </ToastProvider>
  )
}

export default App
