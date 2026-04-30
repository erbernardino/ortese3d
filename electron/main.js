const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Store = require('electron-store')
const { startPython, stopPython } = require('./python-manager')

const isDev = !app.isPackaged

const store = new Store({
  name: 'ortese3d-cache',
  defaults: {
    cases: {},
    patients: {},
    pendingOps: [],
  },
})

function registerCacheHandlers() {
  ipcMain.handle('cache:get', (_e, key) => store.get(key))
  ipcMain.handle('cache:set', (_e, key, value) => store.set(key, value))
  ipcMain.handle('cache:delete', (_e, key) => store.delete(key))
  ipcMain.handle('cache:clear', () => store.clear())
  ipcMain.handle('cache:has', (_e, key) => store.has(key))
}

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
  registerCacheHandlers()
  await startPython()
  createWindow()
})

app.on('will-quit', stopPython)
