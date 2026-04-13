import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import { useToast } from '../context/ToastContext'
import { Upload, FileText, Trash2, Star, StarOff } from 'lucide-react'

export default function ResumesPage() {
  const toast = useToast()
  const [resumes, setResumes] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  const load = () => api.listResumes().then(setResumes).catch(() => {})

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await api.uploadResume(file)
      toast('Resume uploaded!', 'success')
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.deleteResume(id)
      toast('Resume deleted', 'info')
      load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleSetDefault = async (id) => {
    try {
      await api.setDefaultResume(id)
      toast('Default resume updated', 'success')
      load()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Resumes</h1>
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>Upload your resumes. The default one is used for auto-apply.</p>
      </div>

      {/* Upload area */}
      <div
        className="card"
        onClick={() => fileRef.current?.click()}
        style={{
          border: '2px dashed var(--border2)',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: '32px 20px',
          transition: 'border-color 0.15s',
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) {
            const dt = new DataTransfer()
            dt.items.add(file)
            fileRef.current.files = dt.files
            handleUpload({ target: fileRef.current })
          }
        }}
      >
        <Upload size={28} color="var(--text3)" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Click to upload or drag & drop</div>
          <div style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>PDF, DOC, DOCX up to 10MB</div>
        </div>
        {uploading && <div style={{ color: 'var(--accent2)', fontSize: 12, marginTop: 4 }}>Uploading...</div>}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleUpload} />
      </div>

      {/* Resume list */}
      {resumes.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {resumes.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              borderBottom: i < resumes.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={16} color="var(--accent2)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Uploaded {new Date(r.uploaded_at).toLocaleDateString()}
                  {r.is_default && <span style={{ marginLeft: 8, color: 'var(--amber)', fontWeight: 600 }}>● Default</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  title={r.is_default ? 'Already default' : 'Set as default'}
                  onClick={() => handleSetDefault(r.id)}
                  disabled={r.is_default}
                >
                  {r.is_default ? <Star size={13} color="var(--amber)" /> : <StarOff size={13} />}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resumes.length === 0 && !uploading && (
        <div className="empty-state">
          <FileText size={32} />
          <p>No resumes uploaded yet</p>
        </div>
      )}
    </div>
  )
}
