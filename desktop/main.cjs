const { app, BrowserWindow, ipcMain, nativeTheme, net, protocol, shell } = require('electron');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'marden';
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;
const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|mkd)$/i;
let mainWindow = null;
let rendererReady = false;
const pendingMarkdownFiles = [];
let pendingAuthUrl = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      codeCache: true,
    },
  },
]);

const isMarkdownPath = (filePath) => MARKDOWN_EXTENSION.test(filePath);

const isAuthCallbackUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === `${APP_SCHEME}:` && parsed.hostname === 'auth';
  } catch {
    return false;
  }
};

const handleAuthCallback = (url) => {
  if (!isAuthCallbackUrl(url)) return false;

  const callback = new URL(url);
  const appUrl = new URL(`${APP_SCHEME}://app/index.html`);
  appUrl.search = callback.search;
  appUrl.hash = callback.hash;

  if (mainWindow && !mainWindow.isDestroyed()) {
    void mainWindow.loadURL(appUrl.toString());
  } else {
    pendingAuthUrl = appUrl.toString();
  }
  return true;
};

const registerAsProtocolClient = () => {
  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(APP_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(APP_SCHEME);
  }
};

const readMarkdownFile = (filePath) => {
  if (!isMarkdownPath(filePath) || !existsSync(filePath)) return null;

  try {
    const stat = statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_MARKDOWN_BYTES) return null;
    return {
      name: path.basename(filePath),
      content: readFileSync(filePath, 'utf8'),
    };
  } catch {
    return null;
  }
};

const deliverPendingMarkdown = () => {
  if (!rendererReady || !mainWindow || mainWindow.isDestroyed()) return;
  while (pendingMarkdownFiles.length > 0) {
    mainWindow.webContents.send('marden:open-markdown', pendingMarkdownFiles.shift());
  }
};

const openMarkdownFile = (filePath) => {
  const markdownFile = readMarkdownFile(filePath);
  if (!markdownFile) return;
  pendingMarkdownFiles.push(markdownFile);
  if (app.isReady() && (!mainWindow || mainWindow.isDestroyed())) createWindow();
  deliverPendingMarkdown();
};

const distDirectory = () =>
  app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', 'dist');

const registerAppProtocol = () => {
  const distRoot = path.resolve(distDirectory());

  protocol.handle(APP_SCHEME, (request) => {
    const requestUrl = new URL(request.url);
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^[/\\]+/, '') || 'index.html';
    const filePath = path.resolve(distRoot, relativePath);
    const isInsideBundle = filePath === distRoot || filePath.startsWith(`${distRoot}${path.sep}`);

    if (!isInsideBundle || !existsSync(filePath)) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).toString());
  });
};

const initAutoUpdater = () => {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    const electronLog = require('electron-log');

    autoUpdater.logger = electronLog;
    electronLog.transports.file.level = 'info';
    autoUpdater.autoInstallEvent = 'onNextLaunch';
    autoUpdater.autoDownload = true;

    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      electronLog.warn('Could not check for updates', error);
    });

    autoUpdater.on('error', (error) => {
      electronLog.warn('Auto-update error', error);
    });

    autoUpdater.on('update-available', () => {
      mainWindow?.webContents.send('marden:update-status', { status: 'available' });
    });
    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('marden:update-status', {
        status: 'downloading',
        percent: progress.percent,
      });
    });
    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('marden:update-status', { status: 'downloaded' });
    });
  } catch {
    // electron-updater may not be installed in dev
  }
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 760,
    minHeight: 620,
    title: 'Marden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141816' : '#F5F3ED',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  mainWindow = window;
  rendererReady = false;

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${APP_SCHEME}://app/`)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${APP_SCHEME}://app/`)) return;
    event.preventDefault();
    if (!handleAuthCallback(url)) void shell.openExternal(url);
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.once('did-finish-load', () => {
    rendererReady = true;
    deliverPendingMarkdown();
  });
  window.on('closed', () => {
    mainWindow = null;
    rendererReady = false;
  });
  const initialUrl = pendingAuthUrl ?? `${APP_SCHEME}://app/index.html`;
  pendingAuthUrl = null;
  void window.loadURL(initialUrl);
};

ipcMain.handle('marden:open-external', async (_event, url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS links can be opened');
  await shell.openExternal(parsed.toString());
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openMarkdownFile(filePath);
});

// macOS delivers custom protocol launches with open-url. On Windows and
// Linux, Electron passes the URL to the second-instance command line instead.
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const authUrl = commandLine.find(isAuthCallbackUrl);
    if (authUrl) handleAuthCallback(authUrl);

    const markdownPath = commandLine.find(isMarkdownPath);
    if (markdownPath) openMarkdownFile(markdownPath);

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAsProtocolClient();
    registerAppProtocol();
    const authUrl = process.argv.slice(1).find(isAuthCallbackUrl);
    if (authUrl) handleAuthCallback(authUrl);
    const markdownPath = process.argv.slice(1).find(isMarkdownPath);
    if (markdownPath) openMarkdownFile(markdownPath);
    createWindow();
    initAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
