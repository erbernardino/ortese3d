import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { login, register, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'reset'
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'doctor' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
        navigate('/')
      } else if (mode === 'register') {
        await register(form.email, form.password, form.name, form.role)
        navigate('/')
      } else if (mode === 'reset') {
        await resetPassword(form.email)
        setInfo('Enviamos um e-mail com instruções para redefinir sua senha.')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const TITLE = { login: 'Entrar', register: 'Criar conta', reset: 'Recuperar senha' }
  const SUBMIT = { login: 'Entrar', register: 'Registrar', reset: 'Enviar link' }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 32 }}>
      <h1>OrteseCAD</h1>
      <h2>{TITLE[mode]}</h2>
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
        {mode !== 'reset' && (
          <input type="password" placeholder="Senha" value={form.password}
            onChange={e => set('password', e.target.value)} required />
        )}
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        {info && <p style={{ color: '#2f855a', margin: 0 }}>{info}</p>}
        <button type="submit">{SUBMIT[mode]}</button>
      </form>
      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {mode !== 'login' && (
          <button onClick={() => { setMode('login'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Já tenho conta
          </button>
        )}
        {mode !== 'register' && (
          <button onClick={() => { setMode('register'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Criar conta
          </button>
        )}
        {mode === 'login' && (
          <button onClick={() => { setMode('reset'); setError(''); setInfo('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: '#666' }}>
            Esqueci a senha
          </button>
        )}
      </div>
    </div>
  )
}
