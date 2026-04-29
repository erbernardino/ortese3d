const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  pythonReady: () => ipcRenderer.invoke('python-ready'),
})
