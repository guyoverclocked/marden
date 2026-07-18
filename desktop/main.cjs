const { app, BrowserWindow, nativeTheme, net, protocol, shell } = require('electron');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'marden';

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
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${APP_SCHEME}://`)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${APP_SCHEME}://`)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  window.once('ready-to-show', () => window.show());
  void window.loadURL(`${APP_SCHEME}://app/index.html`);
};

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
