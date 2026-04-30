const BASE = 'http://localhost:8765'

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Python API error: ${res.status}`)
  return res.json()
}

export const pythonApi = {
  status: () => request('GET', '/status'),
  generateModel: (data) => request('POST', '/model/generate', data),
  validateModel: (data) => request('POST', '/model/validate', data),
  exportStl: (data) => request('POST', '/export/stl', data),
  exportGcode: (data) => request('POST', '/export/gcode', data),
  exportPdf: (data) => request('POST', '/export/pdf', data),

  async importScan(file) {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/model/import-scan`, { method: 'POST', body: form })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Import scan failed: ${res.status} ${detail}`)
    }
    return res.json()
  },
}
