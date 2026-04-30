// Cache local (electron-store) + fila de operações offline.
// Disponível só dentro do Electron (window.electronAPI.cache); no browser
// puro vira no-op.

const api = typeof window !== 'undefined' ? window.electronAPI?.cache : null
const enabled = !!api

let listeners = new Set()
let onlineListenerInstalled = false

export const cacheService = {
  enabled,

  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  },

  async getCases() {
    if (!enabled) return {}
    return (await api.get('cases')) ?? {}
  },

  async setCase(id, data) {
    if (!enabled) return
    const cases = await this.getCases()
    cases[id] = { ...data, _cachedAt: Date.now() }
    await api.set('cases', cases)
  },

  async setCases(list) {
    if (!enabled) return
    const cases = {}
    for (const c of list) cases[c.id] = { ...c, _cachedAt: Date.now() }
    await api.set('cases', cases)
  },

  async listCases() {
    const cases = await this.getCases()
    return Object.values(cases)
  },

  async enqueueOp(op) {
    if (!enabled) return
    const queue = (await api.get('pendingOps')) ?? []
    queue.push({ ...op, queuedAt: Date.now() })
    await api.set('pendingOps', queue)
    notify()
  },

  async pendingOps() {
    if (!enabled) return []
    return (await api.get('pendingOps')) ?? []
  },

  async clearOp(index) {
    if (!enabled) return
    const queue = (await api.get('pendingOps')) ?? []
    queue.splice(index, 1)
    await api.set('pendingOps', queue)
    notify()
  },

  async replay({ runOp }) {
    if (!enabled || !this.isOnline()) return { ok: 0, failed: 0 }
    const queue = (await api.get('pendingOps')) ?? []
    let ok = 0, failed = 0
    const remaining = []
    for (const op of queue) {
      try {
        await runOp(op)
        ok++
      } catch {
        failed++
        remaining.push(op)
      }
    }
    await api.set('pendingOps', remaining)
    notify()
    return { ok, failed }
  },

  installAutoReplay({ runOp }) {
    if (!enabled || onlineListenerInstalled || typeof window === 'undefined') return
    onlineListenerInstalled = true
    window.addEventListener('online', () => {
      this.replay({ runOp })
    })
    if (this.isOnline()) {
      this.replay({ runOp })
    }
  },

  subscribe(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
}

function notify() {
  for (const cb of listeners) cb()
}
