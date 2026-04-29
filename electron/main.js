const { app, BrowserWindow } = require('electron')
const path = require('path')
const { startPython, stopPython } = require('./python-manager')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await startPython()
  createWindow()
})

app.on('will-quit', stopPython)
