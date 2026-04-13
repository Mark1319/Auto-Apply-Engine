import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { useToast } from '../context/ToastContext'
import { Play, Square, Zap, CheckCircle, AlertCircle, Clock, Sparkles, Key, Eye, EyeOff, Info } from 'lucide-react'

const PLATFORMS = [
  { id: 'linkedin',    label: 'LinkedIn',    color: '#0077b5' },
  { id: 'indeed',      label: 'Indeed',      color: '#2164f3' },
  { id: 'naukri',      label: 'Naukri',      color: '#ff7555' },
  { id: 'internshala', label: 'Internshala', color: '#00aeef' },
  { id: 'hirist',      label: 'Hirist',      color: '#7c3aed' },
  { id: 'instahire',   label: 'Instahire',   color: '#059669' },
]

export default function AutoApplyPage() {
  const toast = useToast()
  const [selectedPlatforms, setSelectedPlatforms] = useState(['linkedin'])
  const [maxJobs, setMaxJobs] = useState(10)
  const [tailorEnabled, setTailorEnabled] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [session, setSession] = useState(null)
  const [running, setRunning] = useState(false)
  const pollRef = useRef(null)

  // Load saved API key mask on mount
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { if (d.anthropic_api_key) setApiKey(d.anthropic_api_key) })
      .catch(() => {})
  }, [])

  const togglePlatform = (id) =>
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const saveApiKey = async () => {
    if (!apiKey.startsWith('sk-ant-')) return toast('Enter a valid Anthropic API key (starts with sk-ant-)', 'error')
    setSavingKey(true)
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anthropic_api_key: apiKey }),
      })
      toast('API key saved!', 'success')
    } catch {
      toast('Failed to save API key', 'error')
    } finally {
      setSavingKey(false)
    }
  }

  const pollStatus = async (sid) => {
    try {
      const s = await api.getSessionStatus(sid)
      setSession(s)
      if (s.status === 'running') {
        pollRef.current = setTimeout(() => pollStatus(sid), 2000)
      } else {
        setRunning(false)
        if (s.status === 'completed') {
          const tailoredCount = s.progress?.filter(p => p.includes('✨')).length || 0
          const msg = tailoredCount > 0
            ? `Done! Applied to ${s.progress?.length || 0} jobs (${tailoredCount} with tailored resumes)`
            : `Done! Applied to ${s.progress?.length || 0} jobs`
          toast(msg, 'success')
        }
        if (s.status === 'error') toast('Error: ' + s.error, 'error')
      }
    } catch {
      setRunning(false)
    }
  }

  const handleStart = async () => {
    if (!selectedPlatforms.length) return toast('Select at least one platform', 'error')
    if (tailorEnabled && !apiKey.startsWith('sk-ant-')) {
      return toast('Enter your Anthropic API key to use resume tailoring', 'error')
    }
    setRunning(true)
    setSession(null)
    try {
      const { session_id } = await api.startAutoApply({
        platforms: selectedPlatforms,
        max_jobs: maxJobs,
        tailor_enabled: tailorEnabled,
        anthropic_api_key: tailorEnabled ? apiKey : '',
      })
      setSessionId(session_id)
      pollStatus(session_id)
      toast(
        tailorEnabled
          ? 'Auto-apply started with AI resume tailoring!'
          : 'Auto-apply started! Check the browser window.',
        'info'
      )
    } catch (e) {
      toast(e.message, 'error')
      setRunning(false)
    }
  }

  const handleStop = async () => {
    if (sessionId) {
      await api.stopSession(sessionId).catch(() => {})
      clearTimeout(pollRef.current)
      setRunning(false)
      setSession(s => s ? { ...s, status: 'stopped' } : s)
      toast('Session stopped', 'info')
    }
  }

  useEffect(() => () => clearTimeout(pollRef.current), [])

  const statusIcon = (status) => {
    if (status === 'running')   return <span className="pulse-dot" />
    if (status === 'completed') return <CheckCircle size={14} color="var(--green)" />
    if (status === 'error' || status === 'stopped') return <AlertCircle size={14} color="var(--red)" />
    return <Clock size={14} color="var(--text3)" />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 660 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Auto apply</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>
          Launch the automation and let it apply to jobs for you
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: 13,
        color: 'var(--accent2)', display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Zap size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          A browser window will open. Log in to each platform once — the bot applies automatically
          based on your profile and filters.
        </span>
      </div>

      {/* Config card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Platform selector */}
        <div>
          <label style={{ marginBottom: 8 }}>Platforms</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${selectedPlatforms.includes(p.id) ? p.color + '66' : 'var(--border2)'}`,
                  background: selectedPlatforms.includes(p.id) ? p.color + '18' : 'var(--bg3)',
                  color: selectedPlatforms.includes(p.id) ? p.color : 'var(--text2)',
                  cursor: 'pointer', fontWeight: 500, fontSize: 13, transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max jobs */}
        <div className="form-group" style={{ maxWidth: 200 }}>
          <label>Max jobs per platform</label>
          <input
            type="number" min={1} max={50} value={maxJobs}
            onChange={e => setMaxJobs(Number(e.target.value))}
          />
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* AI Tailoring toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: tailorEnabled ? 'rgba(139,92,246,0.15)' : 'var(--bg3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}>
                <Sparkles size={15} color={tailorEnabled ? '#a78bfa' : 'var(--text3)'} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>AI resume tailoring</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                  Claude rewrites your resume for each job description
                </div>
              </div>
            </div>
            {/* Toggle switch */}
            <div
              onClick={() => setTailorEnabled(t => !t)}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: tailorEnabled ? '#7c3aed' : 'var(--bg3)',
                border: `1px solid ${tailorEnabled ? '#7c3aed' : 'var(--border2)'}`,
                position: 'relative', transition: 'background 0.2s, border-color 0.2s',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: tailorEnabled ? 20 : 2,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>

          {/* Tailoring details when enabled */}
          {tailorEnabled && (
            <div style={{
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 'var(--radius)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              {/* What it does */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  'Scrapes the job description before applying',
                  'Reorders skills to match JD keywords (helps ATS)',
                  'Rewrites your summary to target the specific role',
                  'Generates a fresh PDF per job — originals untouched',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                    <CheckCircle size={12} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
                    {item}
                  </div>
                ))}
              </div>

              {/* Cost note */}
              <div style={{
                display: 'flex', gap: 8, fontSize: 11, color: 'var(--text2)',
                background: 'var(--bg3)', borderRadius: 6, padding: '8px 10px',
              }}>
                <Info size={12} color="var(--text3)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Uses Claude Sonnet via Anthropic API (~$0.01 per tailored resume). Adds 5–10s per job.</span>
              </div>

              {/* API key input */}
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={11} />
                  Anthropic API key
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-ant-api03-..."
                      style={{ paddingRight: 36 }}
                    />
                    <button
                      onClick={() => setShowKey(s => !s)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
                        display: 'flex', padding: 0,
                      }}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={saveApiKey} disabled={savingKey}>
                    {savingKey ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  Get yours at{' '}
                  <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent2)' }}>
                    console.anthropic.com
                  </a>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={running}
            style={{
              minWidth: 160,
              background: tailorEnabled ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : undefined,
            }}
          >
            {tailorEnabled ? <Sparkles size={14} /> : <Play size={14} />}
            {running ? 'Running...' : tailorEnabled ? 'Start with tailoring' : 'Start auto-apply'}
          </button>
          {running && (
            <button className="btn btn-danger" onClick={handleStop}>
              <Square size={14} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Session status */}
      {session && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {statusIcon(session.status)}
            <span style={{ fontWeight: 600, fontSize: 14 }}>Session {session.status}</span>
            {session.progress && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)' }}>
                {session.progress.length} applied
                {session.progress.filter(p => p.includes('✨')).length > 0 && (
                  <span style={{ color: '#a78bfa', marginLeft: 6 }}>
                    · {session.progress.filter(p => p.includes('✨')).length} tailored
                  </span>
                )}
              </span>
            )}
          </div>

          {session.status === 'running' && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: '60%' }} />
            </div>
          )}

          {session.progress?.length > 0 && (
            <div style={{
              background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px',
              maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {session.progress.map((msg, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  {msg.includes('✨')
                    ? <Sparkles size={11} color="#a78bfa" style={{ flexShrink: 0, marginTop: 2 }} />
                    : <CheckCircle size={11} color="var(--green)" style={{ flexShrink: 0, marginTop: 2 }} />
                  }
                  {msg}
                </div>
              ))}
            </div>
          )}

          {session.error && (
            <div style={{
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 12, color: 'var(--red)',
            }}>
              Error: {session.error}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ background: 'transparent', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <strong style={{ color: 'var(--text2)', fontSize: 13 }}>Tips for best results</strong>
          <span>• Complete your profile and upload a detailed resume before starting</span>
          <span>• For tailoring, a richer base resume = better AI output</span>
          <span>• Set specific keywords for better job matching</span>
          <span>• Keep the browser window open while automation runs</span>
          <span>• Track all applied jobs in the Applications tab</span>
        </div>
      </div>
    </div>
  )
}
