import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { patientService } from '../services/patientService'

const EMPTY = {
  name: '', birthDate: '', guardian: '', diagnosis: '',
  circOccipital: '', circFrontal: '',
  diagA: '', diagB: '', cvai: '', height: '',
}

export default function PatientFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const patientId = await patientService.create(form, user.uid)
      navigate(`/case/new?patientId=${patientId}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <h2>Novo Paciente</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <fieldset style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
          <legend>Dados do Paciente</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input placeholder="Nome completo" value={form.name}
              onChange={e => set('name', e.target.value)} required />
            <input type="date" value={form.birthDate}
              onChange={e => set('birthDate', e.target.value)} required />
            <input placeholder="Responsável" value={form.guardian}
              onChange={e => set('guardian', e.target.value)} required />
            <input placeholder="Diagnóstico" value={form.diagnosis}
              onChange={e => set('diagnosis', e.target.value)} required />
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
          <legend>Medidas Cranianas (mm)</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['circOccipital', 'Circunferência Occipital'],
              ['circFrontal', 'Circunferência Frontal'],
              ['diagA', 'Diagonal A (maior)'],
              ['diagB', 'Diagonal B (menor)'],
              ['cvai', 'CVAI (%)'],
              ['height', 'Altura Craniana'],
            ].map(([field, label]) => (
              <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
                <input type="number" step="0.1" value={form[field]}
                  onChange={e => set(field, e.target.value)} required />
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar e Abrir Caso →'}
        </button>
      </form>
    </div>
  )
}
