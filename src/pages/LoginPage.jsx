import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'doctor' })
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.email, form.password, form.name, form.role)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 32 }}>
      <h1>OrteseCAD</h1>
      <h2>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'register' && (
          <>
            <input placeholder="Nome completo" value={form.name}
              onChange={e => set('name', e.target.value)} required />
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="doctor">Médico / Clínico</option>
              <option value="orthotist">Ortesista</option>
            </select>
          </>
        )}
        <input type="email" placeholder="E-mail" value={form.email}
          onChange={e => set('email', e.target.value)} required />
        <input type="password" placeholder="Senha" value={form.password}
          onChange={e => set('password', e.target.value)} required />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit">{mode === 'login' ? 'Entrar' : 'Registrar'}</button>
      </form>
      <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
        style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
      </button>
    </div>
  )
}
