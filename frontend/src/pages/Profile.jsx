import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useAuth } from '../App'
import { patientApi } from '../lib/api'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({})

  useEffect(() => {
    patientApi.getProfile().then(r => setForm(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await patientApi.updateProfile({
        age: form.age === '' || form.age == null ? null : Number(form.age),
        gender: form.gender, skin_type: form.skin_type,
        medical_history: form.medical_history, sun_exposure: form.sun_exposure
      })
      toast.success('Profile updated!')
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  return (
    <Layout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-serif font-semibold text-ink">Profile</h1>
          <p className="text-muted text-sm mt-1">Manage your patient information</p>
        </div>
        <div className="glass p-6 mb-5 flex items-center gap-5">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-serif font-semibold text-white flex-shrink-0 bg-teal-500">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-lg font-serif font-semibold text-ink">{user?.name}</h2>
            <p className="text-sm text-muted">{user?.email}</p>
            <span className="text-xs text-teal-500 font-mono capitalize mt-1 inline-block">{user?.role}</span>
          </div>
        </div>
        {loading ? (
          <div className="glass p-8 text-center text-muted text-sm">Loading profile...</div>
        ) : (
          <div className="glass p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted mb-1.5 block">Age</label>
                <input type="number" className="input-glass" placeholder="Your age" value={form.age || ''} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted mb-1.5 block">Gender</label>
                <select className="input-glass" value={form.gender || ''} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">Select</option>
                  {['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 block">Fitzpatrick Skin Type</label>
              <select className="input-glass" value={form.skin_type || ''} onChange={e => setForm(p => ({ ...p, skin_type: e.target.value }))}>
                <option value="">Select skin type</option>
                {['Type I','Type II','Type III','Type IV','Type V','Type VI'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 block">Sun Exposure Level</label>
              <select className="input-glass" value={form.sun_exposure || ''} onChange={e => setForm(p => ({ ...p, sun_exposure: e.target.value }))}>
                <option value="">Select level</option>
                {['Low','Moderate','High'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1.5 block">Medical History</label>
              <textarea className="input-glass resize-none" rows={4} placeholder="Relevant medical history, family history, conditions, medications..."
                value={form.medical_history || ''} onChange={e => setForm(p => ({ ...p, medical_history: e.target.value }))} />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2 py-2.5 px-5">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
