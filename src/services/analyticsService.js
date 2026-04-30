import { logEvent, setUserId, setUserProperties } from 'firebase/analytics'
import * as fb from '../firebase'

// Wrapper tolerante: se Analytics ainda não inicializou (assíncrono via
// isSupported) ou o ambiente não suporta, silenciosamente vira no-op.
function withAnalytics(fn) {
  return (...args) => {
    if (!fb.analytics) return
    try { fn(fb.analytics, ...args) } catch {}
  }
}

export const analyticsService = {
  identify: withAnalytics((a, uid, role) => {
    setUserId(a, uid)
    if (role) setUserProperties(a, { role })
  }),

  track: withAnalytics((a, event, params = {}) => {
    logEvent(a, event, params)
  }),
}
