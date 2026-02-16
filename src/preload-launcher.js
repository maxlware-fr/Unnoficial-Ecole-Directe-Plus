// preload.js
// Preload for launcher

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  launch: (url, index) => ipcRenderer.send('launch-app', url, index)
});
