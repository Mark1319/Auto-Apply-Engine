import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { useToast } from '../context/ToastContext'
import TagsInput from '../components/TagsInput'
import { User, Save } from 'lucide-react'

export default function ProfilePage() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', location: '',
    linkedin: '', portfolio: '', summary: '',
    skills: [], experience_years: 0,
  })

  useEffect(() => {
    api.getProfile().then(p => { if (p && p.full_name) setForm(p) }).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await api.saveProfile(form)
      toast('Profile saved!', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Your profile</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>This info is used to auto-fill job applications</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} color="var(--accent2)" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{form.full_name || 'Your name'}</div>
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>{form.email || 'your@email.com'}</div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Full name *</label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="John Doe" />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Phone *</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 9876543210" />
          </div>
          <div className="form-group">
            <label>Location *</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Hyderabad, India" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>LinkedIn URL</label>
            <input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
          </div>
          <div className="form-group">
            <label>Portfolio / GitHub</label>
            <input value={form.portfolio} onChange={e => set('portfolio', e.target.value)} placeholder="https://github.com/..." />
          </div>
        </div>

        <div className="form-group">
          <label>Years of experience</label>
          <input type="number" min={0} max={50} value={form.experience_years}
            onChange={e => set('experience_years', Number(e.target.value))}
            style={{ width: 120 }}
          />
        </div>

        <div className="form-group">
          <label>Skills (press Enter after each)</label>
          <TagsInput value={form.skills} onChange={v => set('skills', v)} placeholder="e.g. React, Python, SQL..." />
        </div>

        <div className="form-group">
          <label>Professional summary</label>
          <textarea rows={4} value={form.summary} onChange={e => set('summary', e.target.value)}
            placeholder="A brief professional summary that may be used in cover letters..." />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
