import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { useToast } from '../context/ToastContext'
import TagsInput from '../components/TagsInput'
import { Filter, Save } from 'lucide-react'

const PLATFORMS = ['linkedin', 'indeed', 'naukri', 'internshala', 'hirist', 'instahire']
const PLATFORM_LABELS = { linkedin: 'LinkedIn', indeed: 'Indeed', naukri: 'Naukri', internshala: 'Internshala', hirist: 'Hirist', instahire: 'Instahire' }
const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'remote']
const EXP_LEVELS = ['', 'entry', 'mid', 'senior', 'lead', 'manager']

export default function FiltersPage() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    keywords: [],
    locations: [],
    job_types: ['full-time'],
    platforms: ['linkedin', 'naukri'],
    min_salary: '',
    max_salary: '',
    experience_level: '',
  })

  useEffect(() => {
    api.getFilters().then(f => { if (f && f.keywords) setForm(f) }).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleItem = (key, val) => {
    const arr = form[key]
    set(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const handleSave = async () => {
    if (!form.keywords.length) return toast('Add at least one keyword', 'error')
    if (!form.locations.length) return toast('Add at least one location', 'error')
    setSaving(true)
    try {
      await api.saveFilters({
        ...form,
        min_salary: form.min_salary ? Number(form.min_salary) : null,
        max_salary: form.max_salary ? Number(form.max_salary) : null,
      })
      toast('Filters saved!', 'success')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const CheckGroup = ({ label, items, itemLabels, field }) => (
    <div className="form-group">
      <label>{label}</label>
      <div className="checkbox-group">
        {items.map(item => (
          <div key={item} className="checkbox-chip">
            <input type="checkbox" id={`${field}-${item}`} checked={form[field].includes(item)} onChange={() => toggleItem(field, item)} />
            <label htmlFor={`${field}-${item}`}>{(itemLabels || {})[item] || item}</label>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Job filters</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Configure what kind of jobs to search and apply for</p>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <Filter size={15} color="var(--accent2)" />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Search criteria</span>
        </div>

        <div className="form-group">
          <label>Job keywords * (roles, skills)</label>
          <TagsInput value={form.keywords} onChange={v => set('keywords', v)} placeholder="e.g. Software Engineer, React Developer..." />
        </div>

        <div className="form-group">
          <label>Preferred locations *</label>
          <TagsInput value={form.locations} onChange={v => set('locations', v)} placeholder="e.g. Hyderabad, Bangalore, Remote..." />
        </div>

        <CheckGroup label="Platforms to apply on" items={PLATFORMS} itemLabels={PLATFORM_LABELS} field="platforms" />
        <CheckGroup label="Job types" items={JOB_TYPES} field="job_types" />

        <div className="form-group">
          <label>Experience level</label>
          <select value={form.experience_level} onChange={e => set('experience_level', e.target.value)} style={{ width: 200 }}>
            {EXP_LEVELS.map(l => <option key={l} value={l}>{l || 'Any level'}</option>)}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Min. salary (₹/year)</label>
            <input type="number" value={form.min_salary} onChange={e => set('min_salary', e.target.value)} placeholder="e.g. 500000" />
          </div>
          <div className="form-group">
            <label>Max. salary (₹/year)</label>
            <input type="number" value={form.max_salary} onChange={e => set('max_salary', e.target.value)} placeholder="e.g. 2000000" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : 'Save filters'}
          </button>
        </div>
      </div>
    </div>
  )
}
