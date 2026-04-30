const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  pythonReady: () => ipcRenderer.invoke('python-ready'),
  cache: {
    get: (key) => ipcRenderer.invoke('cache:get', key),
    set: (key, value) => ipcRenderer.invoke('cache:set', key, value),
    delete: (key) => ipcRenderer.invoke('cache:delete', key),
    has: (key) => ipcRenderer.invoke('cache:has', key),
    clear: () => ipcRenderer.invoke('cache:clear'),
  },
})
