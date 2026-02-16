/*
Install.js
Script d'installation pour UEDP.
- Vérifie les prérequis (Node.js, npm, Electron)
- Installe les dépendances manquantes
- Télécharge/installe bin.js dans #trmn
- Rend la commande 'uedp' accessible globalement (PATH Windows)
- Ne s'exécute qu'au premier lancement
*/

// RAPPEL : C'est un fichier distant à UEDP.

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const os = require('os');

if (process.platform === 'win32') {
  try {
    require('child_process').execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    console.warn("[WARN] Tentative d'éxécution échoué.")
  }
}

try {
  if (process.stdout && typeof process.stdout.setEncoding === 'function') {
    process.stdout.setEncoding('utf8');
  }
  if (process.stderr && typeof process.stderr.setEncoding === 'function') {
    process.stderr.setEncoding('utf8');
  }
} catch (e) {
  console.warn("[WARN] Tentative d'encodage échoué.")
}

const BIN_JS_URL = 'https://raw.githubusercontent.com/maxlware-fr/Unnoficial-Ecole-Directe-Plus/refs/heads/main/src/%23trmn/bin.js';
const INSTALL_FLAG_FILE = path.join(__dirname, '.installed');
const TRMN_DIR = path.join(__dirname, '#trmn');
const BIN_PATH = path.join(TRMN_DIR, 'bin.js');

// Installation
let installGlobally = true;

function log(message, type = 'info') {
  const types = {
    info: '[INFO]',
    success: '[OK]',
    error: '[ERROR]',
    warn: '[WARN]'
  };
  console.log(`${types[type] || '•'} ${message}`);
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function checkNodeVersion() {
  const version = process.version;
  const required = 'v16.0.0';
  if (version < required) {
    throw new Error(`Node.js ${required} ou supérieur requis (actuel: ${version})`);
  }
  log(`Node.js ${version} détecté`, 'success');
}

async function checkNpm() {
  try {
    const { stdout } = await execPromise('npm --version');
    log(`npm ${stdout.trim()} détecté`, 'success');
  } catch {
    throw new Error('npm n\'est pas installé ou accessible');
  }
}

async function checkElectron() {
  try {
    require.resolve('electron');
    log('Electron est déjà installé', 'success');
    return true;
  } catch {
    log('Electron n\'est pas installé', 'warn');
    return false;
  }
}

async function installDependencies() {
  log('Installation des dépendances...', 'info');
  try {
    await execPromise('npm install electron discord-rpc node-notifier --save-dev');
    log('Dépendances installées avec succès', 'success');
  } catch (err) {
    throw new Error(`Échec installation dépendances: ${err.error?.message || 'inconnu'}`);
  }
}

/*
Download bin.js
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function createFallbackBinJs() {
  log('Création d\'un bin.js de secours...', 'warn');
  const fallbackContent = `#!/usr/bin/env node
console.log('⚠️  Version de secours de UEDP installée.');
console.log('Le fichier bin.js officiel n\\'a pas pu être téléchargé.');
console.log('Veuillez vérifier votre connexion ou contacter le support.');
process.exit(1);
`;
  await fs.writeFile(BIN_PATH, fallbackContent, { mode: 0o755 });
}

async function setupBinJs() {
  await fs.mkdir(TRMN_DIR, { recursive: true });

  let downloadSuccess = true;

  if (BIN_JS_URL !== 'https://raw.githubusercontent.com/maxlware-fr/Unnoficial-Ecole-Directe-Plus/refs/heads/main/src/%23trmn/bin.js' || BIN_JS_URL.includes('votre-compte')) {
    try {
      log(`Téléchargement de bin.js depuis ${BIN_JS_URL}...`, 'info');
      await downloadFile(BIN_JS_URL, BIN_PATH);
      await fs.chmod(BIN_PATH, 0o755);
      log('bin.js téléchargé avec succès', 'success');
      downloadSuccess = true;
    } catch (err) {
      log(`Échec du téléchargement: ${err.message}`, 'error');
    }
  } else {
    log('URL de bin.js non configurée (toujours 404)', 'warn');
  }

  if (!downloadSuccess) {
    await createFallbackBinJs();
    log('Version de secours installée. Éditez install.js avec la bonne URL.', 'warn');
  }
}

async function installGlobalCommand() {
  if (!installGlobally || process.platform !== 'win32') return;

  log('Configuration de la commande globale "uedp"...', 'info');
  
  try {
    const userDir = os.homedir();
    const batchPath = path.join(userDir, 'uedp.cmd');
    
    const batchContent = `@echo off
node "${BIN_PATH}" %*`;
    await fs.writeFile(batchPath, batchContent);
    
    const { stdout: pathOutput } = await execPromise('reg query HKCU\\Environment /v Path');
    const currentPath = pathOutput.split('\n')
      .find(line => line.includes('Path'))
      ?.split('REG_EXPAND_SZ')[1]
      ?.trim() || '';
    
    if (!currentPath.includes(userDir)) {
      const newPath = `${currentPath};${userDir}`;
      await execPromise(`setx Path "${newPath}"`);
      log(`Dossier ${userDir} ajouté au PATH. Redémarrez votre terminal.`, 'success');
    } else {
      log('Commande "uedp" déjà accessible', 'success');
    }
  } catch (err) {
    log(`Impossible de configurer la commande globale: ${err.message}`, 'warn');
    log('Vous pouvez toujours utiliser "node #trmn/bin.js" à la place', 'info');
  }
}
*/

async function runInstall() {
  log('=== Installation de UEDP ===', 'info');
  
  try {
    await fs.access(INSTALL_FLAG_FILE);
    log('Installation déjà effectuée. Pour réinstaller, supprimez .installed', 'info');
    return false;
  } catch {
    log('Vérification .installed réussi.')
  }

  try {
    await checkNodeVersion();
    await checkNpm();
    
    const electronInstalled = await checkElectron();
    if (!electronInstalled) {
      await installDependencies();
    }
    
    // await setupBinJs();
    
    // await installGlobalCommand();
    
    await fs.writeFile(INSTALL_FLAG_FILE, new Date().toISOString());
    
    log('Installation terminée avec succès !', 'success');
    // log('Vous pouvez maintenant utiliser "uedp start" dans un nouveau terminal.', 'success');
    return true;
    
  } catch (error) {
    log(`ERREUR D'INSTALLATION: ${error.message}`, 'error');
    return false;
  }
}

if (require.main === module) {
  runInstall().then(success => {
    process.exit(success ? 0 : 1);
  });
} else {
  module.exports = runInstall;
}
