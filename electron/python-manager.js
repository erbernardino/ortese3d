const { spawn } = require('child_process')
const path = require('path')

let pythonProcess = null

async function startPython() {
  const pythonPath = path.join(__dirname, '../python/.venv/bin/python')
  pythonProcess = spawn(pythonPath, ['-m', 'uvicorn', 'python.main:app', '--port', '8765'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })

  // Aguarda servidor ficar disponível
  await waitForServer('http://localhost:8765/status', 10000)
}

async function waitForServer(url, timeout) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error('Python server did not start in time')
}

function stopPython() {
  if (pythonProcess) pythonProcess.kill()
}

module.exports = { startPython, stopPython }
