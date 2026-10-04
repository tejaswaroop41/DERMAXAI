import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import { useAuth } from '../App'
import { patientApi } from '../lib/api'
import toast from 'react-hot-toast'
import { CheckCircle2, Save, ShieldCheck, UserRound } from 'lucide-react'

export default function Profile() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    patientApi.getProfile().then(r => setForm(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const emptyToNull = value => value === '' || value == null ? null : value

  const save = async () => {
    setSaving(true)
    try {
      await patientApi.updateProfile({
        age: emptyToNull(form.age) === null ? null : Number(form.age),
        gender: emptyToNull(form.gender),
        skin_type: emptyToNull(form.skin_type),
        medical_history: emptyToNull(form.medical_history),
        sun_exposure: emptyToNull(form.sun_exposure)
      })
      toast.success('Profile updated')
    } catch { toast.error('Update failed') }
    finally { setSaving(false) }
  }

  return (
    <Layout>
      <div className="page-pad max-w-5xl mx-auto">
        <div className="page-heading">
          <div>
            <div className="eyebrow"><UserRound size={13} /> Patient profile</div>
            <h1 className="page-title">Your profile</h1>
            <p className="page-subtitle">Keep your clinical context current so future assessments can use the information you choose to provide.</p>
          </div>
          <span className="status-pill"><span /> Protected workspace</span>
        </div>

        <div className="grid lg:grid-cols-[.65fr_1.35fr] gap-5 items-start">
          <section className="glass p-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-serif font-semibold text-white bg-gradient-to-br from-[#315f58] to-[#4b887e] shadow-lg shadow-teal-900/10">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <h2 className="text-xl font-serif font-semibold text-ink mt-5">{user?.name}</h2>
            <p className="text-sm text-muted mt-1 break-all">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full bg-[#eef6f3] border border-[#d8e9e4] text-teal-800 text-xs font-semibold capitalize">
              <ShieldCheck size={12} /> {user?.role}
            </span>
            <div className="mt-7 pt-5 border-t border-line">
              <div className="text-[10px] uppercase tracking-[.14em] font-bold text-muted">Why this matters</div>
              <p className="text-xs text-muted leading-5 mt-2">These details support the application’s contextual risk signals. You can leave optional fields blank.</p>
            </div>
          </section>

          {loading ? (
            <div className="glass p-10 text-center text-muted text-sm">Loading profile…</div>
          ) : (
            <section className="glass p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-6"><div className="w-8 h-8 rounded-lg bg-[#eef6f3] border border-[#d8e9e4] flex items-center justify-center text-teal-700"><UserRound size={14} /></div><div><h2 className="section-card-title">Clinical context</h2><p className="text-xs text-muted mt-1">Optional information used by the decision-support workflow.</p></div></div>
              <div className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="field-label">Age</label><input type="number" min="1" max="120" className="input-glass" placeholder="Your age" value={form.age ?? ''} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} /></div>
                  <div><label className="field-label">Gender</label><select className="input-glass" value={form.gender || ''} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}><option value="">Select</option>{['Male','Female','Other'].map(g => <option key={g}>{g}</option>)}</select></div>
                </div>
                <div><label className="field-label">Fitzpatrick skin type</label><select className="input-glass" value={form.skin_type || ''} onChange={e => setForm(p => ({ ...p, skin_type: e.target.value }))}><option value="">Select skin type</option>{['Type I','Type II','Type III','Type IV','Type V','Type VI'].map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="field-label">Sun exposure level</label><select className="input-glass" value={form.sun_exposure || ''} onChange={e => setForm(p => ({ ...p, sun_exposure: e.target.value }))}><option value="">Select level</option>{['Low','Moderate','High'].map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className="field-label">Medical history</label><textarea className="input-glass resize-none" rows={5} placeholder="Relevant medical history, family history, conditions, medications…" value={form.medical_history || ''} onChange={e => setForm(p => ({ ...p, medical_history: e.target.value }))} /></div>
                <div className="pt-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-teal-700" /> Changes are saved to your patient profile.</p>
                  <button onClick={save} disabled={saving} className="btn-primary py-2.5 px-5"><Save size={14} /> {saving ? 'Saving…' : 'Save changes'}</button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  )
}