// preload.js
// This file is loaded before the renderer process is loaded, it has access to Node.js APIs and can expose safe APIs to the renderer through contextBridge.

const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => {
    try {
      ipcRenderer.send('window-minimize');
    } catch (error) {
      console.error('Erreur minimizeWindow:', error);
    }
  },
  maximizeWindow: () => {
    try {
      ipcRenderer.send('window-maximize');
    } catch (error) {
      console.error('Erreur maximizeWindow:', error);
    }
  },
  closeWindow: () => {
    try {
      ipcRenderer.send('window-close');
    } catch (error) {
      console.error('Erreur closeWindow:', error);
    }
  },
  openExtensionPopup: () => {
    try {
      ipcRenderer.send('open-extension-popup-from-web');
    } catch (error) {
      console.error('Erreur openExtensionPopup:', error);
    }
  },
  switchSite: () => {
    try {
      ipcRenderer.send('switch-site');
    } catch (error) {
      console.error('Erreur switchSite:', error);
    }
  }
});
