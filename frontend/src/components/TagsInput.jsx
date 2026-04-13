import { useState } from 'react'
import { X } from 'lucide-react'

export default function TagsInput({ value = [], onChange, placeholder = 'Type and press Enter' }) {
  const [input, setInput] = useState('')

  const addTag = (val) => {
    const tag = val.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  const removeTag = (tag) => onChange(value.filter(t => t !== tag))

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="tags-wrap" onClick={() => document.getElementById('tags-input-field')?.focus()}>
      {value.map(tag => (
        <span key={tag} className="tag">
          {tag}
          <button type="button" onClick={() => removeTag(tag)}><X size={10} /></button>
        </span>
      ))}
      <input
        id="tags-input-field"
        className="tags-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => input && addTag(input)}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  )
}
