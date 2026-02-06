const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { Client } = require('discord-rpc');

let mainWindow;
let extensionPopupWindow = null;
let rpc = null;
let currentActivity = null;
let isQuitting = false;

const clientId = '1469379921737679101';

const pageConfigs = {
  '/#home': { name: '🏠 Accueil', details: 'Consulte la page d\'accueil' },
  '/login': { name: '🔐 Connexion', details: 'Sur la page de connexion' },
  '/app/0/dashboard': { name: '📊 Tableau de bord', details: 'Gère son espace' },
  '/app/0/grades': { name: '📈 Notes', details: 'Consulte ses notes (bonne j\'espère)' },
  '/app/0/homeworks': { name: '📚 Devoirs', details: 'Planifie ses devoirs (j\'espère pas beaucoup)' },
  '/app/0/messaging': { name: '✉️ Messagerie', details: 'Consulte ses messages' },
  '/app/0/timetable': { name: '🗓️ Emploi du temps', details: 'Vérifie son planning' },
  '/app/0/settings': { name: '⚙️ Paramètres', details: 'Paramètre l\'application' },
  '/app/0/account': { name: '👤 Compte', details: 'Gère son compte' },
  '/edp-unblock': { name: '🔧 UEDP Unblock', details: 'Page de l\'extension' }
};

function getActivityFromUrl(url) {
  let matchedConfig = null;
  let matchedPath = '';
  
  for (const [path, config] of Object.entries(pageConfigs)) {
    if (url.includes(path) && path.length > matchedPath.length) {
      matchedPath = path;
      matchedConfig = config;
    }
  }
  
  if (matchedConfig) {
    return {
      ...matchedConfig,
      urlPath: matchedPath
    };
  }
  
  return {
    name: '🌐 Navigation',
    details: 'Navigue sur Ecole Directe Plus',
    urlPath: '/'
  };
}

async function initializeRPC() {
  if (rpc) return;
  
  try {
    rpc = new Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      log('Discord RPC connecté !', 'success');
      if (currentActivity) {
        updateDiscordActivity(currentActivity);
      }
    });

    rpc.on('disconnected', () => {
      log('Déconnecté de Discord', 'warn');
      rpc = null;
    });

    await rpc.login({ clientId });
  } catch (error) {
    log('Impossible de se connecter à Discord (est-il lancé ?): ' + error.message, 'warn');
    rpc = null;
  }
}

function updateDiscordActivity(pageInfo) {
  if (!rpc || isQuitting) return;

  const { name, details, urlPath } = pageInfo;
  
  const activity = {
    details: details,
    state: name,
    startTimestamp: new Date(),
    largeImageKey: 'edp_logo',
    largeImageText: 'Unnoficial Ecole Directe Plus',
    smallImageKey: 'icon',
    smallImageText: 'En ligne',
    buttons: [
      {
        label: 'Ouvrir UEDP',
        url: `https://ecole-directe.plus${urlPath}`
      }
    ]
  };

  currentActivity = activity;

  rpc.setActivity(activity).catch(err => {
    log('Erreur mise à jour activité RPC: ' + err.message, 'warn');
  });
}

async function shutdownRPC() {
  if (isQuitting) return;
  isQuitting = true;
  
  if (rpc) {
    try {
      await rpc.clearActivity().catch(() => {});
      rpc.destroy();
      log('RPC Discord arrêté', 'info');
    } catch (error) {
      log('Erreur lors de l\'arrêt du RPC: ' + error.message, 'warn');
    } finally {
      rpc = null;
    }
  }
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const types = {
    info: 'ℹ',
    success: '✓',
    error: '✗',
    warn: '⚠'
  };
  const icon = types[type] || types.info;
  console.log(`[${timestamp}] ${icon} ${message}`);
}

function mergeManifests(commonManifest, chromiumManifest) {
  const merged = { ...commonManifest, ...chromiumManifest };
  
  if (commonManifest.permissions && chromiumManifest.permissions) {
    merged.permissions = [...new Set([...commonManifest.permissions, ...chromiumManifest.permissions])];
  }
  
  if (commonManifest.content_scripts && chromiumManifest.content_scripts) {
    merged.content_scripts = [...commonManifest.content_scripts, ...chromiumManifest.content_scripts];
  }
  
  if (commonManifest.web_accessible_resources && chromiumManifest.web_accessible_resources) {
    merged.web_accessible_resources = [...commonManifest.web_accessible_resources, ...chromiumManifest.web_accessible_resources];
  }
  
  return merged;
}

async function prepareExtension(originalPath) {
  try {
    const tempDir = path.join(os.tmpdir(), `edp-ext-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    async function copyDir(src, dest) {
      await fs.mkdir(dest, { recursive: true });
      const entries = await fs.readdir(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          await copyDir(srcPath, destPath);
        } else {
          await fs.copyFile(srcPath, destPath);
        }
      }
    }
    
    await copyDir(originalPath, tempDir);
    
    const commonManifestPath = path.join(tempDir, 'manifest.common.json');
    const chromiumManifestPath = path.join(tempDir, 'manifest.chromium.json');
    
    let commonManifest = {};
    let chromiumManifest = {};
    
    try {
      commonManifest = JSON.parse(await fs.readFile(commonManifestPath, 'utf8'));
      log('manifest.common.json lu', 'info');
    } catch (error) {
      log('manifest.common.json non trouve ou invalide', 'warn');
    }
    
    try {
      chromiumManifest = JSON.parse(await fs.readFile(chromiumManifestPath, 'utf8'));
      log('manifest.chromium.json lu', 'info');
    } catch (error) {
      log('manifest.chromium.json invalide', 'error');
      throw error;
    }
    
    const mergedManifest = mergeManifests(commonManifest, chromiumManifest);
    
    if (!mergedManifest.name) {
      mergedManifest.name = 'EDP Extension';
      log('Nom manquant, utilisation de "EDP Extension"', 'warn');
    }
    
    const finalManifestPath = path.join(tempDir, 'manifest.json');
    await fs.writeFile(finalManifestPath, JSON.stringify(mergedManifest, null, 2));
    log('manifest.json cree (fusionne)', 'success');
    
    try {
      await fs.unlink(commonManifestPath);
      await fs.unlink(chromiumManifestPath);
      log('Anciens manifests supprimes', 'info');
    } catch (error) {
    }
    
    return {
      tempDir,
      manifest: mergedManifest
    };
  } catch (error) {
    log('Erreur lors de la preparation de l\'extension: ' + error.message, 'error');
    return null;
  }
}

function createCustomMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Ouvrir l\'extension',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => openExtensionPopup()
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            shutdownRPC().finally(() => {
              app.quit();
            });
          }
        }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { label: 'Recharger', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Outils developpeur', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Plein ecran', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Site EDP',
          click: () => shell.openExternal('https://ecole-directe.plus')
        },
        {
          label: 'A propos',
          click: () => showAbout()
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function openExtensionPopup() {
  if (extensionPopupWindow) {
    extensionPopupWindow.focus();
    return;
  }
  
  try {
    const extensionPath = path.join(__dirname, 'Unnoficial-Support-Ecole-Directe-Plus-Unblock');
    const popupPath = path.join(extensionPath, 'popup', 'popup.html');
    
    await fs.access(popupPath);
    
    extensionPopupWindow = new BrowserWindow({
      width: 400,
      height: 600,
      title: 'Extension EDP',
      backgroundColor: '#1a1a2b',
      icon: path.join(__dirname, 'assets', 'UEDP.ico'),
      frame: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    extensionPopupWindow.loadFile(popupPath);
    log('Popup d\'extension ouverte', 'success');
    
    extensionPopupWindow.on('closed', () => {
      extensionPopupWindow = null;
    });
    
  } catch (error) {
    log('Popup d\'extension introuvable, creation d\'une version basique', 'warn');
    createBasicPopup();
  }
}

function createBasicPopup() {
  extensionPopupWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Extension EDP',
    backgroundColor: '#1a1a2b',
    icon: path.join(__dirname, 'assets', 'UEDP.ico'),
    frame: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const basicHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          background: #1a1a2b;
          color: white;
          font-family: Arial, sans-serif;
          padding: 20px;
          margin: 0;
        }
        .container {
          max-width: 350px;
          margin: 0 auto;
        }
        .title {
          color: #64b5f6;
          font-size: 24px;
          margin-bottom: 20px;
          text-align: center;
        }
        .status {
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 15px;
        }
        .features li {
          padding: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="title">EDP Extension</h1>
        <div class="status">
          <strong>Statut:</strong> Extension active
        </div>
        <div class="status">
          <strong>Fonctionnalites:</strong>
          <ul class="features">
            <li>Desktop</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
  
  extensionPopupWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(basicHTML)}`);
}

function showAbout() {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 300,
    title: 'A propos - Ecole Directe Plus',
    backgroundColor: '#1a1a2b',
    icon: path.join(__dirname, 'assets', 'UEDP.ico'),
    frame: true,
    resizable: false,
    modal: true,
    parent: mainWindow,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const aboutHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          background: #1a1a2b;
          color: white;
          font-family: Arial, sans-serif;
          padding: 30px;
          margin: 0;
        }
        h1 {
          color: #64b5f6;
          text-align: center;
        }
        .content {
          text-align: center;
        }
        .version {
          margin-top: 20px;
          color: #90caf9;
        }
      </style>
    </head>
    <body>
      <div class="content">
        <h1>Unnoficial Ecole Directe Plus</h1>
        <p>Application Electron avec extension integrée.</p>
        <p>Version desktop crée par un des développeur de EDP.</p>
        <div class="version">
          <p>Version 1.0.0</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  aboutWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(aboutHTML)}`);
}

function injectCustomTitleBar() {
  const injectScript = `
    (function() {
      if (document.getElementById('edp-custom-title-bar')) return;
      
      const titleBar = document.createElement('div');
      titleBar.id = 'edp-custom-title-bar';
      titleBar.style.cssText = \`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: #1a1a2b;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        -webkit-app-region: drag;
        z-index: 10000;
        font-family: Arial, sans-serif;
        user-select: none;
        border-bottom: 1px solid #3949ab;
      \`;
      
      const leftSection = document.createElement('div');
      leftSection.style.cssText = 'display: flex; align-items: center; gap: 10px;';
      leftSection.innerHTML = \`
        <span style="font-weight: bold; color: #64b5f6; font-size: 16px;">UEDP</span>
        <span style="font-size: 14px;">Unnoficial Ecole Directe Plus</span>
      \`;
      
      const rightSection = document.createElement('div');
      rightSection.style.cssText = 'display: flex; align-items: center; gap: 5px; -webkit-app-region: no-drag;';
      rightSection.innerHTML = \`
        <button id="edp-minimize-btn" style="
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
        ">─</button>
        <button id="edp-maximize-btn" style="
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
        ">□</button>
        <button id="edp-close-btn" style="
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 12px;
        ">✕</button>
      \`;
      
      titleBar.appendChild(leftSection);
      titleBar.appendChild(rightSection);
      
      document.body.insertBefore(titleBar, document.body.firstChild);
      
      document.body.style.paddingTop = '32px';
      
      const style = document.createElement('style');
      style.textContent = \`
        #edp-custom-title-bar button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        #edp-close-btn:hover {
          background: #d32f2f !important;
        }
      \`;
      document.head.appendChild(style);
      
      document.getElementById('edp-minimize-btn').addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
      });
      
      document.getElementById('edp-maximize-btn').addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
      });
      
      document.getElementById('edp-close-btn').addEventListener('click', () => {
        window.electronAPI.closeWindow();
      });
      
      console.log('Barre personnalisée UEDP injectée');
    })();
  `;
  
  mainWindow.webContents.executeJavaScript(injectScript).catch(err => {
    console.error('Erreur injection barre:', err);
  });
}

app.whenReady().then(async () => {
  log('Démarrage de Ecole Directe Plus...', 'info');
  
  try {
    const extensionPath = path.join(__dirname, 'Unnoficial-Support-Ecole-Directe-Plus-Unblock');
    log(`Chemin de l'extension: ${extensionPath}`, 'info');
    
    const extensionData = await prepareExtension(extensionPath);
    
    if (extensionData) {
      log(`Chargement de l'extension depuis: ${extensionData.tempDir}`, 'info');
      
      const extension = await session.defaultSession.loadExtension(extensionData.tempDir);
      log(`Extension chargée: ${extension.name} v${extension.version}`, 'success');
    } else {
      log('Impossible de préparer l\'extension', 'error');
    }
  } catch (error) {
    log('Erreur lors du chargement de l\'extension: ' + error.message, 'error');
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Unnoficial Ecole Directe Plus',
    backgroundColor: '#1a1a2b',
    icon: path.join(__dirname, 'assets', 'UEDP.ico'),
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  
  initializeRPC();
  
  createCustomMenu();
  
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });
  
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  
  ipcMain.on('window-close', () => {
    shutdownRPC().finally(() => {
      mainWindow.close();
    });
  });
  
  mainWindow.webContents.on('did-navigate', (event, url) => {
    const pageInfo = getActivityFromUrl(url);
    log(`Page détectée: ${pageInfo.name} (${url})`, 'info');
    updateDiscordActivity(pageInfo);
  });
  
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    const pageInfo = getActivityFromUrl(url);
    log(`Navigation interne: ${pageInfo.name}`, 'info');
    updateDiscordActivity(pageInfo);
  });
  
  log('Chargement de https://ecole-directe.plus...', 'info');
  
  mainWindow.loadURL('https://ecole-directe.plus').then(() => {
    log('Site chargé avec succès', 'success');
  }).catch(err => {
    log('Erreur de chargement: ' + err.message, 'error');
  });
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    log('Fenêtre principale affichée', 'success');
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    log('Injection de la barre personnalisée...', 'info');
    
    const currentUrl = mainWindow.webContents.getURL();
    const pageInfo = getActivityFromUrl(currentUrl);
    updateDiscordActivity(pageInfo);
    
    injectCustomTitleBar();
    
    setTimeout(() => {
      injectCustomTitleBar();
    }, 500);
    
    mainWindow.webContents.insertCSS(`
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: #111120;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #2a2a44, #1a1a2b);
  border-radius: 10px;
  border: 2px solid #111120;
  transition: all 0.25s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #3a3a5c, #24243a);
}

body {
  padding-top: 32px !important;
}

    `);
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    injectCustomTitleBar();
  });
  
  mainWindow.on('closed', () => {
    shutdownRPC();
    mainWindow = null;
  });
});

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    await shutdownRPC();
    app.quit();
  }
});

app.on('will-quit', async () => {
  await shutdownRPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    shutdownRPC().finally(() => {
      app.quit();
    });
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    app.whenReady().then(() => {
      mainWindow = new BrowserWindow({ 
        width: 1200, 
        height: 800, 
        frame: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js')
        }
      });
      mainWindow.loadURL('https://ecole-directe.plus');
      initializeRPC();
    });
  }
});

process.on('uncaughtException', (error) => {
  log('Erreur non capturée: ' + error.message, 'error');
});

process.on('exit', () => {
  if (rpc) {
    rpc.destroy();
  }
});