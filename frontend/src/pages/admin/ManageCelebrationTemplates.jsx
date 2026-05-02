import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'

const PODIUM_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'dominant', label: 'Dominant (>5s)' },
  { value: 'close', label: 'Close (<2s)' },
  { value: 'comeback', label: 'Comeback (>5 grid spots)' },
]

export default function ManageCelebrationTemplates() {
  const [templates, setTemplates] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)
  // Bumped after every successful upload / trim / restore so we can cache-bust
  // image URLs — the file path stays the same on the server but the bytes
  // changed, so browsers would otherwise keep serving the stale image.
  const [imgVersion, setImgVersion] = useState(Date.now())
  const cacheBust = (url) => url ? `${url}${url.includes('?') ? '&' : '?'}v=${imgVersion}` : url

  const load = () => {
    get('/admin/celebration-templates').then(t => {
      setTemplates(t)
      setImgVersion(Date.now())
    }).catch(() => {})
  }
  useEffect(load, [])

  const beginEdit = (t) => {
    setEditingId(t.id)
    setDraft({ ...t })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setDraft(null)
  }
  const saveEdit = async () => {
    await put(`/admin/celebration-templates/${editingId}`, {
      name: draft.name,
      prompt: draft.prompt,
      country_tag: draft.country_tag || '',
      podium_tag: draft.podium_tag || '',
      is_active: draft.is_active ? 1 : 0,
      include_driver_refs: draft.include_driver_refs ?? 1,
    })
    cancelEdit()
    load()
  }
  const remove = async (id) => {
    if (!confirm('Delete this template?')) return
    await del(`/admin/celebration-templates/${id}`)
    load()
  }
  const addNew = async () => {
    await post('/admin/celebration-templates', { name: 'New Template', prompt: 'Describe the celebration scene…' })
    load()
  }
  const uploadImage = async (templateId, file) => {
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/admin/celebration-templates/${templateId}/image`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        alert(`Upload failed (HTTP ${res.status}). ${body.slice(0, 200)}`)
        return
      }
      const data = await res.json().catch(() => null)
      if (data?.error) {
        alert(`Upload failed: ${data.error}`)
        return
      }
    } catch (e) {
      alert(`Upload failed: ${e.message}`)
      return
    }
    load()
  }

  const [trimmingId, setTrimmingId] = useState(null)
  const trimFace = async (templateId) => {
    setTrimmingId(templateId)
    try {
      const res = await post(`/admin/celebration-templates/${templateId}/trim-face`, {})
      if (res?.error) alert(res.error)
    } catch (e) {
      alert(e.message || 'Trim failed.')
    }
    setTrimmingId(null)
    load()
  }
  const restoreOriginal = async (templateId) => {
    if (!confirm('Restore the original uploaded image for this template?')) return
    const res = await post(`/admin/celebration-templates/${templateId}/restore-original`, {})
    if (res?.error) alert(res.error)
    load()
  }

  const inputCls = "w-full bg-[#111111] border border-[#1F1F1F] rounded px-2 py-1 text-sm text-[#E8ECF4] focus:outline-none focus:border-[#7ED321]"
  const btnPrimary = "cursor-pointer bg-gradient-to-b from-[#7ED321] to-[#5BA318] border border-[#8EE835] text-[#0D1117] font-bold uppercase text-xs tracking-wider px-4 py-2 rounded transition-all"
  const btnSecondary = "cursor-pointer bg-gradient-to-b from-[#1F1F1F] to-[#191919] border border-[#383838] text-[#999999] font-bold uppercase text-xs tracking-wider px-4 py-2 rounded hover:text-[#E8ECF4] hover:border-[#777777] transition-all"
  const btnDanger = "cursor-pointer text-red-400 hover:text-red-300 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Celebration Templates</h1>
        <button onClick={addNew} className={btnPrimary}>+ Add Template</button>
      </div>
      <p className="text-sm text-[#999999]">
        Each template is a celebration scene (e.g. champagne spray, podium pose). Upload a reference
        image and write a prompt — when generating a hero, the winning driver's photo plus this
        template are sent to Gemini. Country and podium tags are used to auto-suggest a template
        per race.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(t => {
          const isEditing = editingId === t.id
          const view = isEditing ? draft : t
          return (
            <div key={t.id} className="bg-[#191919] border border-[#1F1F1F] rounded-xl overflow-hidden">
              <div className="aspect-[16/9] bg-[#0D1117] relative overflow-hidden">
                {t.image_path ? (
                  <img src={cacheBust(t.image_path)} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#555] text-xs uppercase tracking-wider">
                    No reference image
                  </div>
                )}
                <label className="absolute bottom-2 right-2 cursor-pointer bg-black/70 hover:bg-black text-[#E8ECF4] text-xs uppercase tracking-wider px-3 py-1.5 rounded">
                  {t.image_path ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files[0] && uploadImage(t.id, e.target.files[0])}
                  />
                </label>
                {t.image_path && (
                  <div className="absolute bottom-2 left-2 flex gap-1">
                    <button
                      onClick={() => trimFace(t.id)}
                      disabled={trimmingId === t.id}
                      className="bg-black/70 hover:bg-black text-[#7ED321] text-xs uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Use Gemini to obscure the face in this template so it doesn't bias hero generation"
                    >
                      {trimmingId === t.id ? 'Trimming…' : 'Trim Face'}
                    </button>
                    <button
                      onClick={() => restoreOriginal(t.id)}
                      className="bg-black/70 hover:bg-black text-[#999] text-xs uppercase tracking-wider px-3 py-1.5 rounded cursor-pointer"
                      title="Revert to the original uploaded image"
                    >
                      Restore
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 space-y-3">
                {isEditing ? (
                  <>
                    <input
                      value={view.name}
                      onChange={e => setDraft({ ...draft, name: e.target.value })}
                      className={inputCls}
                      placeholder="Template name"
                    />
                    <textarea
                      value={view.prompt}
                      onChange={e => setDraft({ ...draft, prompt: e.target.value })}
                      rows={4}
                      className={inputCls}
                      placeholder="Describe the celebration scene…"
                    />
                    <div className="flex gap-2">
                      <input
                        value={view.country_tag || ''}
                        onChange={e => setDraft({ ...draft, country_tag: e.target.value })}
                        className={inputCls}
                        placeholder="Country tag (optional, e.g. Italy)"
                      />
                      <select
                        value={view.podium_tag || ''}
                        onChange={e => setDraft({ ...draft, podium_tag: e.target.value })}
                        className={inputCls}
                      >
                        {PODIUM_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[#999999]">
                      <input
                        type="checkbox"
                        checked={!!view.is_active}
                        onChange={e => setDraft({ ...draft, is_active: e.target.checked ? 1 : 0 })}
                        className="accent-[#7ED321]"
                      />
                      Active (eligible for selection)
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#999999]">
                      <input
                        type="checkbox"
                        checked={view.include_driver_refs == null ? true : !!view.include_driver_refs}
                        onChange={e => setDraft({ ...draft, include_driver_refs: e.target.checked ? 1 : 0 })}
                        className="accent-[#7ED321]"
                      />
                      Include driver reference photos (uncheck for car/scene-only templates)
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button onClick={saveEdit} className={btnPrimary}>Save</button>
                      <button onClick={cancelEdit} className={btnSecondary}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-bold text-[#E8ECF4]">{t.name}</h2>
                      {!t.is_active && (
                        <span className="text-[10px] uppercase tracking-wider bg-[#1F1F1F] text-[#777] px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-[#999999] leading-relaxed line-clamp-3">{t.prompt}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.country_tag && (
                        <span className="text-[10px] uppercase tracking-wider bg-[#7ED321]/15 text-[#7ED321] px-2 py-0.5 rounded">
                          {t.country_tag}
                        </span>
                      )}
                      {t.podium_tag && (
                        <span className="text-[10px] uppercase tracking-wider bg-[#1F1F1F] text-[#999] px-2 py-0.5 rounded">
                          {t.podium_tag}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => beginEdit(t)} className={btnSecondary}>Edit</button>
                      <button onClick={() => remove(t.id)} className={btnDanger}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {templates.length === 0 && (
        <p className="text-[#777777] text-sm">No templates yet — they'll be seeded automatically on next backend start.</p>
      )}
    </div>
  )
}
