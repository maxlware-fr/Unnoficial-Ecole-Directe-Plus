const { app, BrowserWindow, session, Menu, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const os = require('os');
const { Client } = require('discord-rpc');
const notifier = require('node-notifier');

// https://chatgpt.com/share/69875a1a-9088-8003-a12d-8c90b29066ef
// https://chatgpt.com/share/69875a64-a81c-8003-b809-f011c116f66a
const config_loader = require("./config_loader.js");

let mainWindow;
let splashWindow; // Fenêtre de chargement
let extensionPopupWindow = null;
let rpc = null;
let currentActivity = null;
let isQuitting = false;

// Verify available sites
const availableSites = [
  { 
    name: 'EDP Production', 
    url: 'https://ecole-directe.plus',
    description: 'Site principal - Version stable'
  },
  { 
    name: 'EDP Beta', 
    url: 'https://beta.ecole-directe.plus',
    description: 'Version bêta - Nouvelles fonctionnalités'
  },
  { 
    name: 'EDP Refactor', 
    url: 'https://refactor.ecole-directe.plus',
    description: 'Version refactorisée - Code optimisé'
  },
  { 
    name: 'EcoleDirecte Officiel', 
    url: 'https://www.ecoledirecte.com',
    description: 'Site officiel - Version originale'
  }
];

let currentSiteIndex = 0;
let currentUrl = availableSites[currentSiteIndex].url;

// ID
const clientId = '1469379921737679101';

// Test with node-notifier
// https://www.npmjs.com/package/node-notifier#cross-platform-advanced-usage
notifier.notify({
  title: 'Unnoficial Ecole Directe Plus',
  message: 'Chargé avec succès !',
  icon: path.join(__dirname, 'assets', 'UEDP.png'),
});

// Config RPC state
const pageConfigs = {
  '/#home': { name: '🏠 Accueil', details: 'Consulte la page d\'accueil' },
  '/login': { name: '🔑 Connexion', details: 'Sur la page de connexion' },
  '/app/0/dashboard': { name: '🖼️ Tableau de bord', details: 'Gère son espace' },
  '/app/0/grades': { name: '💯 Notes', details: 'Consulte ses notes (des bonnes j\'espère !)' },
  '/app/0/homeworks': { name: '📚 Devoirs', details: 'Planifie ses devoirs (j\'espère pas beaucoup)' },
  '/app/0/messaging': { name: '✉️ Messagerie', details: 'Consulte ses messages' },
  '/app/0/timetable': { name: '🕒 Emploi du temps', details: 'Vérifie son planning (longue journée ?)' },
  '/app/0/settings': { name: '⚙️ Paramètres', details: 'Paramètre l\'application' },
  '/app/0/account': { name: '👤 Compte', details: 'Gère son compte' },
  '/edp-unblock': { name: '✖️ UEDP Unblock', details: 'Page de l\'extension' }
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
  
  // Default
  return {
    name: '🌐 Navigation',
    details: `Navigue sur ${getCurrentSiteName()}`,
    urlPath: '/'
  };
}

function getCurrentSiteName() {
  return availableSites[currentSiteIndex].name;
}

function getCurrentSiteUrl() {
  return availableSites[currentSiteIndex].url;
}

function switchToNextSite() {
  currentSiteIndex = (currentSiteIndex + 1) % availableSites.length;
  
  const newSite = availableSites[currentSiteIndex];
  currentUrl = newSite.url;
  
  log(`Changement de site: ${newSite.name}`, 'info');
  log(`URL: ${newSite.url}`, 'info');
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(newSite.url).then(() => {
      log(`Site chargé: ${newSite.name}`, 'success');
      
      mainWindow.setTitle(`Ecole Directe Plus - ${newSite.name}`);
      
      showSiteSwitchNotification(newSite);
      
    }).catch(err => {
      log(`Erreur de chargement: ${err.message}`, 'error');
    });
  }
  
  return newSite;
}

function showSiteSwitchNotification(site) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  
  const notificationScript = `
    (function() {
      const notification = document.createElement('div');
      notification.innerHTML = \`<div style="position: fixed; top: 50px; right: 20px; background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); color: white; padding: 15px 20px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10001; border-left: 4px solid #64b5f6; min-width: 300px; animation: slideIn 0.3s ease;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
          <span style="font-size: 20px;">🔁</span>
          <strong style="font-size: 16px;">Changement de site</strong>
        </div>
        <div style="font-size: 14px;">
          <div><strong>\${site.name}</strong></div>
          <div style="color: #90caf9; margin-top: 3px; font-size: 12px;">\${site.description}</div>
          <div style="color: #bbdefb; margin-top: 5px; font-size: 11px;">Raccourci: Ctrl+S pour changer à nouveau</div>
        </div>
      </div>\`;
      
      const style = document.createElement('style');
      style.textContent = \`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      \`;
      document.head.appendChild(style);
      
      document.body.appendChild(notification.firstChild);
      
      setTimeout(() => {
        const notifEl = document.querySelector('[style*="position: fixed; top: 50px; right: 20px;"]');
        if (notifEl) {
          notifEl.style.animation = 'fadeOut 0.5s ease';
          setTimeout(() => {
            if (notifEl.parentNode) {
              notifEl.parentNode.removeChild(notifEl);
            }
          }, 500);
        }
      }, 3000);
    })();
  `;
  
  mainWindow.webContents.executeJavaScript(notificationScript.replace('site.name', `'${site.name}'`).replace('site.description', `'${site.description}'`))
    .catch(err => console.error('Erreur notification:', err));
}

function showSiteSelectionMenu() {
  if (!mainWindow) return;
  
  const template = availableSites.map((site, index) => ({
    label: `${site.name} ${currentSiteIndex === index ? '✓' : ''}`,
    click: () => {
      currentSiteIndex = index;
      currentUrl = site.url;
      mainWindow.loadURL(site.url);
      mainWindow.setTitle(`Ecole Directe Plus - ${site.name}`);
      log(`Site sélectionné: ${site.name}`, 'success');
    },
    toolTip: site.description
  }));
  
  template.push({ type: 'separator' });
  template.push({
    label: 'Raccourci: Ctrl+S pour changer',
    enabled: false
  });
  
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow });
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
  
  // Line 40-111
  const activity = {
    details: details, // 42-53
    state: `${name}`, // 42-53
    startTimestamp: new Date(),
    largeImageKey: 'uedp', // assets/UEDP_1024.png
    largeImageText: 'UEDP',
    smallImageKey: 'eleve', // assets/eleve_1024.png
    smallImageText: 'Compte élève',
    // Not working (I guess)
    buttons: [
      {
        label: 'Aller sur le site',
        url: `https://ecole-directe.plus`
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
      log('RPC Discord arrêté proprement', 'info');
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
      // Recycle bin
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

// CustomMenu for site switching and extension access
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
        {
          label: 'Changer de site',
          accelerator: 'CmdOrCtrl+S',
          click: () => switchToNextSite()
        },
        {
          label: 'Choix du site...',
          click: () => showSiteSelectionMenu()
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
        { label: 'Forcer rechargement', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Outils developpeur', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Plein ecran', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Sites',
      submenu: availableSites.map((site, index) => ({
        label: `${site.name} ${currentSiteIndex === index ? '✓' : ''}`,
        click: () => {
          currentSiteIndex = index;
          currentUrl = site.url;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(site.url);
            mainWindow.setTitle(`Unnofficial Ecole Directe Plus - ${site.name}`);
          }
        }
      }))
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'Site EDP Production',
          click: () => shell.openExternal('https://ecole-directe.plus')
        },
        {
          label: 'Site EDP Beta',
          click: () => shell.openExternal('https://beta.ecole-directe.plus')
        },
        {
          label: 'Site EDP Refactor',
          click: () => shell.openExternal('https://refactor.ecole-directe.plus')
        },
        {
          label: 'Site Officiel',
          click: () => shell.openExternal('https://www.ecoledirecte.com')
        },
        { type: 'separator' },
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
    // Popup UEDP Support Unblock
    const extensionPath = path.join(__dirname, 'Unnoficial-Support-Ecole-Directe-Plus-Unblock');
    const popupPath = path.join(extensionPath, 'popup', 'popup.html');
    
    await fs.access(popupPath);
    
    extensionPopupWindow = new BrowserWindow({
      width: 400,
      height: 600,
      title: 'Extension EDP',
      backgroundColor: '#181828',
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

/*
Exemple popup

function createBasicPopup() {
  extensionPopupWindow = new BrowserWindow({
    width: 400,
    height: 500,
    title: 'Extension EDP',
    backgroundColor: '#181828',
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
          background: #181828;
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
        <h1 class="title">UEDP Extension</h1>
        <div class="status">
          <strong>Statut:</strong> Extension active
        </div>
        <div class="status">
          <strong>Fonctionnalites:</strong>
          <ul class="features">
            <li>Interface modernisee</li>
            <li>Calcul des moyennes</li>
            <li>Themes clair/sombre</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
  
  extensionPopupWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(basicHTML)}`);
}
*/

function showAbout() {
  const aboutWindow = new BrowserWindow({
    width: 400,
    height: 350,
    title: 'A propos - Unnoficial Ecole Directe Plus',
    backgroundColor: '#181828',
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
          background: #181828;
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
        .sites-list {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 15px;
          margin: 15px 0;
          text-align: left;
        }
        .site-item {
          padding: 5px 0;
          display: flex;
          justify-content: space-between;
        }
        .version {
          margin-top: 20px;
          color: #90caf9;
        }
        .shortcut {
          color: #64b5f6;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="content">
        <h1>Unnoficial Ecole Directe Plus</h1>
        <p>Application Electron avec extension integree</p>
        
        <div class="sites-list">
          <h3 style="margin-top: 0; color: #90caf9;">Sites disponibles:</h3>
          <div class="site-item">
            <span>EDP Production</span>
            <span style="color: #4caf50;">Ctrl+S</span>
          </div>
          <div class="site-item">
            <span>EDP Beta</span>
            <span style="color: #4caf50;">Ctrl+S</span>
          </div>
          <div class="site-item">
            <span>EDP Refactor</span>
            <span style="color: #4caf50;">Ctrl+S</span>
          </div>
          <div class="site-item">
            <span>EcoleDirecte Officiel</span>
            <span style="color: #4caf50;">Ctrl+S</span>
          </div>
        </div>
        
        <p>Appuyez sur <span class="shortcut">Ctrl+S</span> pour changer de site</p>
        
        <div class="version">
          <p>Version 1.1.0</p>
          <p>Avec système de changement de site</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  aboutWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(aboutHTML)}`);
}

// Custom bar in the top of the page with extension name and buttons (minimize, maximize, close)
function injectCustomTitleBar() {
  const injectScript = `
    (function() {
      if (document.getElementById('edp-custom-title-bar')) return;
      
      const titleBar = document.createElement('div');
      titleBar.id = 'edp-custom-title-bar';
      titleBar.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; height: 32px; background: #181828; color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; -webkit-app-region: drag; z-index: 10000; font-family: Arial, sans-serif; user-select: none; border-bottom: 1px solid #3949ab;';
      
      const leftSection = document.createElement('div');
      leftSection.style.cssText = 'display: flex; align-items: center; gap: 10px;';
      leftSection.innerHTML = '<span style="font-weight: bold; color: #64b5f6; font-size: 16px;">UEDP</span><span style="font-size: 14px;">Unnoficial Ecole Directe Plus</span>';
      
      const rightSection = document.createElement('div');
      rightSection.style.cssText = 'display: flex; align-items: center; gap: 5px; -webkit-app-region: no-drag;';
      rightSection.innerHTML = '<button id="edp-minimize-btn" style="background: transparent; border: none; color: white; cursor: pointer; padding: 5px 10px; border-radius: 3px; font-size: 12px;">-</button><button id="edp-maximize-btn" style="background: transparent; border: none; color: white; cursor: pointer; padding: 5px 10px; border-radius: 3px; font-size: 12px;">□</button><button id="edp-close-btn" style="background: transparent; border: none; color: white; cursor: pointer; padding: 5px 10px; border-radius: 3px; font-size: 12px;">×</button>';
      
      titleBar.appendChild(leftSection);
      titleBar.appendChild(rightSection);
      
      document.body.insertBefore(titleBar, document.body.firstChild);
      
      document.body.style.paddingTop = '32px';
      
      const style = document.createElement('style');
      style.textContent = '#edp-custom-title-bar button:hover { background: rgba(0, 0, 0, 0.1) !important; } #edp-close-btn:hover { background: #d32f2f !important; }';
      document.head.appendChild(style);
      
      document.getElementById('edp-minimize-btn').addEventListener('click', () => {
        if (window.electronAPI) {
          window.electronAPI.minimizeWindow();
        }
      });
      
      document.getElementById('edp-maximize-btn').addEventListener('click', () => {
        if (window.electronAPI) {
          window.electronAPI.maximizeWindow();
        }
      });
      
      document.getElementById('edp-close-btn').addEventListener('click', () => {
        if (window.electronAPI) {
          window.electronAPI.closeWindow();
        }
      });
    })();
  `;
  
  mainWindow.webContents.executeJavaScript(injectScript).catch(err => {
    console.error('Erreur injection barre:', err);
  });
}

// UndleEDPUnblockPage /edp-unblock
// Console log in the handlePostMessage.js in the extension.
function handleEdpUnblockPage() {
  const edpUnblockScript = `
    (function() {
      setTimeout(function() {
        const downloadBtn = document.querySelector('.edpu-download-link.available');
        
        if (downloadBtn && window.location.pathname.includes('/edp-unblock')) {
          console.log('Bouton UEDP Unblock trouvé, transformation...');
          
          downloadBtn.innerHTML = 'Extension Chargée';
          downloadBtn.style.cssText = 'background: linear-gradient(135deg, #181828 0%, #0d47a1 100%) !important; color: white !important; border: 2px solid #64b5f6 !important; border-radius: 10px !important; padding: 15px 30px !important; font-size: 18px !important; font-weight: bold !important; cursor: pointer !important; transition: all 0.3s ease !important; box-shadow: 0 4px 15px rgba(24, 24, 40, 0.3) !important; position: relative !important; overflow: hidden !important;';
          
          const activeBadge = document.createElement('span');
          activeBadge.innerHTML = '✓ Actif';
          activeBadge.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #4caf50; color: white; font-size: 12px; padding: 3px 8px; border-radius: 12px; font-weight: bold;';
          downloadBtn.style.position = 'relative';
          downloadBtn.appendChild(activeBadge);
          
          downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const popup = document.createElement('div');
            popup.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #181828 0%, #0d47a1 100%); color: white; border-radius: 15px; padding: 30px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); z-index: 99999; border: 2px solid #64b5f6;';
            
            popup.innerHTML = '<div style="font-size: 48px; margin-bottom: 15px;">✓</div><h2 style="color: #64b5f6; margin-top: 0; margin-bottom: 10px;">Extension Active !</h2><p style="margin-bottom: 25px; line-height: 1.5;">L\\'extension UEDP Unblock est déjà chargée et fonctionnelle dans votre application Electron.</p><div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px;"><div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;"><span style="color: #4caf50; font-size: 20px;">✓</span><span style="font-weight: bold;">Statut: Connecté</span></div><div style="display: flex; align-items: center; justify-content: center; gap: 10px;"><span style="color: #2196f3; font-size: 20px;">⚙</span><span>Mode: Application Electron</span></div></div><button id="popup-close-btn" style="background: #64b5f6; color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; width: 100%;">Compris !</button><p style="font-size: 12px; color: #90caf9; margin-top: 15px;">Vous pouvez également ouvrir le menu "Fichier → Ouvrir l\\'extension"</p>';
            
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 99998;';
            overlay.appendChild(popup);
            document.body.appendChild(overlay);
            
            document.getElementById('popup-close-btn').addEventListener('click', function() {
              document.body.removeChild(overlay);
            });
            
            overlay.addEventListener('click', function(e) {
              if (e.target === overlay) {
                document.body.removeChild(overlay);
              }
            });
            
            if (window.electronAPI && window.electronAPI.openExtensionPopup) {
              window.electronAPI.openExtensionPopup();
            }
          });
          
          const pageTitle = document.querySelector('h1, h2, h3');
          if (pageTitle && pageTitle.textContent.includes('Installez l\\'extension')) {
            pageTitle.textContent = 'Extension EDP Déjà Installée';
          }
        }
      }, 1000);
    })();
  `;
  
  // FR: Si cela ne marche pas, vérifiez la version de l'extension et que le script est bien injecté sur la page /edp-unblock. Vous devriez voir un message dans la console 
  // de l'extension (handlePostMessage.js) indiquant que le bouton a été transformé.
  mainWindow.webContents.executeJavaScript(edpUnblockScript).catch(err => {
    console.error('Erreur injection EDP Unblock:', err);
    console.error('Assurez-vous que le script est injecté sur la page /edp-unblock et que la console de l\'extension affiche le message de transformation du bouton.');
  });
}

app.whenReady().then(async () => {
  log('Démarrage de Ecole Directe Plus...', 'info');
  
  // Splash screen
  splashWindow = new BrowserWindow({
    width: 1054,
    height: 290,
    frame: false,
    center: true,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background-color: #181828;
          overflow: hidden;
        }
        .splash-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .loading-image {
          max-width: 1054px;
          max-height: 396px;
          object-fit: contain;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .splash-container {
          animation: fadeIn 0.5s ease;
        }
      </style>
    </head>
    <body>
      <div class="splash-container">
        <img src="cover.png" class="loading-image" />
      </div>
    </body>
    </html>
  `;
  
  const imagePath = path.join(__dirname, 'assets', 'cover.png');
  let imageDataUrl;
  
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const imageBase64 = imageBuffer.toString('base64');
    imageDataUrl = `data:image/png;base64,${imageBase64}`;
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
    imageDataUrl = '';
  }
  
  const finalHTML = splashHTML.replace('src="cover.png"', `src="${imageDataUrl}"`);
  splashWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(finalHTML)}`);
  
  splashWindow.once('ready-to-show', () => {
    splashWindow.show();
  });
  
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
  
  // Main window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: `Ecole Directe Plus - ${getCurrentSiteName()}`,
    backgroundColor: '#181828',
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
  
  // RPC Init
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
  
  ipcMain.on('open-extension-popup-from-web', () => {
    openExtensionPopup();
  });
  
  ipcMain.on('switch-site', () => {
    switchToNextSite();
  });
  
  mainWindow.webContents.on('did-navigate', (event, url) => {
    const pageInfo = getActivityFromUrl(url);
    log(`Page détectée: ${pageInfo.name} (${url})`, 'info');
    updateDiscordActivity(pageInfo);
    
    if (url.includes('/edp-unblock')) {
      setTimeout(() => {
        handleEdpUnblockPage();
      }, 1000);
    }
  });
  
  mainWindow.webContents.on('did-navigate-in-page', (event, url) => {
    const pageInfo = getActivityFromUrl(url);
    log(`Navigation interne: ${pageInfo.name}`, 'info');
    updateDiscordActivity(pageInfo);
    
    if (url.includes('/edp-unblock')) {
      setTimeout(() => {
        handleEdpUnblockPage();
      }, 1000);
    }
  });
  
  log(`Chargement de ${currentUrl}...`, 'info');
  
  mainWindow.loadURL(currentUrl).then(() => {
    log(`Site chargé: ${getCurrentSiteName()}`, 'success');
  }).catch(err => {
    log('Erreur de chargement: ' + err.message, 'error');
  });
  
  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      mainWindow.show();
      
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
      }
      
      log('Fenêtre principale affichée', 'success');
    }, 1000);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    log('Injection de la barre personnalisée...', 'info');
    log(`
                   /%&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
               #&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
            /&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
           &&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
         /&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
         %&&&&%/                                            
        /&&/                                                
        %/    /#&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
           /%&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
          %&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
         %&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
        (&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
        &&&&&&&&&&&&/                                       
        &&&&&&&&&&&&\\                                       
        (&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
         %&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
          %&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
           \\&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
              \\%&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&    
    
                Looking for curious minds. Are you in?      
          https://github.com/Magic-Fishes/Ecole-Directe-Plus`);
    
    const currentUrl = mainWindow.webContents.getURL();
    const pageInfo = getActivityFromUrl(currentUrl);
    updateDiscordActivity(pageInfo);
    
    injectCustomTitleBar();
    
    if (currentUrl.includes('/edp-unblock')) {
      setTimeout(() => {
        handleEdpUnblockPage();
      }, 1000);
    }
    
    setTimeout(() => {
      injectCustomTitleBar();
    }, 500);
    
    // Exemble scrollbar styling, you can customize it as you want
    mainWindow.webContents.insertCSS(`
      ::-webkit-scrollbar {
        width: 10px;
      }
      ::-webkit-scrollbar-track {
        background: #181828;
      }
      ::-webkit-scrollbar-thumb {
        background: #3949ab;
        border-radius: 5px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #5c6bc0;
      }
      
      body {
        padding-top: 32px !important;
      }
    `);
  });
  
  mainWindow.webContents.on('dom-ready', () => {
    injectCustomTitleBar();
    
    const currentUrl = mainWindow.webContents.getURL();
    if (currentUrl.includes('/edp-unblock')) {
      setTimeout(() => {
        handleEdpUnblockPage();
      }, 1000);
    }
  });
  
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 's') {
      event.preventDefault();
      switchToNextSite();
    }
    
    if (input.control && input.shift && input.key.toLowerCase() === 's') {
      event.preventDefault();
      showSiteSelectionMenu();
    }
  });
  
  mainWindow.on('closed', () => {
    shutdownRPC();
    mainWindow = null;
  });
  
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  }, 5000);
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
      // Main window
      mainWindow = new BrowserWindow({ 
        width: 1200, 
        height: 800, 
        frame: false,
        backgroundColor: '#181828',
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: {
          preload: path.join(__dirname, 'preload.js')
        }
      });
      mainWindow.loadURL(currentUrl);
      mainWindow.setTitle(`Unnoficial Ecole Directe Plus - ${getCurrentSiteName()}`);
      initializeRPC();
      config_loader();
    });
  }
});

process.on('uncaughtException', (error) => {
  log('Erreur non capturée: ' + error.message, 'error');
});

// Proccess exit event
process.on('exit', () => {
  if (rpc) {
    rpc.destroy();
  }
});
