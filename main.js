const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('node:path');

const MAX_TABS = 6;
const HOME_URL = 'https://www.google.com';
let mainWindow;
let tabs = [];
let activeTabId = null;
let nextTabId = 1;
let tileMode = false;
let tileSelection = new Set();
let overlayWidth = 0;
let overlayView;
let overlayKind = null;

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId);
}

function createTab(url = HOME_URL, options = {}) {
  if (tabs.filter((tab) => !tab.settings).length >= MAX_TABS && !options.settings) return null;

  const tab = {
    id: nextTabId++,
    title: options.title || 'Nova guia',
    url,
    settings: Boolean(options.settings),
    zoomFactor: 1,
    view: new BrowserView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        partition: options.partition || `persist:tab-${nextTabId}`
      }
    })
  };

  tab.view.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    createTab(targetUrl);
    return { action: 'deny' };
  });
  tab.view.webContents.on('page-title-updated', (event, title) => {
    event.preventDefault();
    tab.title = title || 'Nova guia';
    sendState();
  });
  tab.view.webContents.on('did-navigate', (_event, targetUrl) => {
    tab.url = targetUrl;
    sendState();
  });
  tab.view.webContents.on('did-navigate-in-page', (_event, targetUrl) => {
    tab.url = targetUrl;
    sendState();
  });
  tab.view.webContents.on('did-finish-load', sendState);
  tab.view.webContents.on('did-finish-load', () => {
    tab.view.webContents.insertCSS('::-webkit-scrollbar { width: 0 !important; height: 0 !important; }').catch(() => {});
  });
  tab.view.webContents.on('before-input-event', (event, input) => {
    if (!input.control && !input.meta) return;
    if (input.key !== '+' && input.key !== '=' && input.key !== '-' && input.key !== '0') return;
    event.preventDefault();
    if (input.key === '0') tab.zoomFactor = 1;
    else tab.zoomFactor = Math.min(5, Math.max(0.25, tab.zoomFactor + (input.key === '-' ? -0.1 : 0.1)));
    tab.view.webContents.setZoomFactor(tileMode ? tab.zoomFactor * 0.9 : tab.zoomFactor);
  });

  tabs.push(tab);
  if (!activeTabId) activeTabId = tab.id;
  if (options.settings) tab.view.webContents.loadFile(url);
  else tab.view.webContents.loadURL(url);
  refreshBounds();
  sendState();
  return tab;
}

function closeTab(tabId) {
  const index = tabs.findIndex((tab) => tab.id === tabId);
  if (index < 0 || tabs[index].settings) return;
  const [tab] = tabs.splice(index, 1);
  if (mainWindow) mainWindow.removeBrowserView(tab.view);
  tab.view.webContents.destroy();
  if (activeTabId === tabId) activeTabId = tabs[index]?.id || tabs[index - 1]?.id || null;
  refreshBounds();
  sendState();
}

function activateTab(tabId) {
  if (!tabs.some((tab) => tab.id === tabId)) return;
  activeTabId = tabId;
  refreshBounds();
  sendState();
}

function refreshBounds() {
  if (!mainWindow) return;
  const [width, height] = mainWindow.getContentSize();
  const visibleTabs = tileMode ? tabs.filter((tab) => !tab.settings && tileSelection.has(tab.id)) : [getActiveTab()].filter(Boolean);
  for (const tab of tabs) mainWindow.removeBrowserView(tab.view);
  if (!visibleTabs.length) return;
  const rows = visibleTabs.length >= 3 ? 2 : 1;
  const columns = visibleTabs.length >= 5 ? 3 : visibleTabs.length >= 2 ? 2 : 1;
  const contentHeight = Math.max(0, height - 46);
  const gap = tileMode ? 2 : 0;
  const tileWidth = (width - gap * (columns - 1)) / columns;
  const tileHeight = (contentHeight - gap * (rows - 1)) / rows;
  visibleTabs.forEach((tab, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    mainWindow.addBrowserView(tab.view);
    tab.view.webContents.setZoomFactor(tileMode ? tab.zoomFactor * 0.9 : tab.zoomFactor);
    tab.view.setBounds({ x: Math.floor(column * (tileWidth + gap)), y: 46 + Math.floor(row * (tileHeight + gap)), width: Math.ceil(tileWidth), height: Math.ceil(tileHeight) });
    tab.view.setAutoResize({ width: true, height: true });
  });
  if (overlayView && overlayKind) {
    const overlayWidth = overlayKind === 'sidebar' ? 280 : 240;
    overlayView.setBounds({ x: width - overlayWidth, y: 46, width: overlayWidth, height: contentHeight });
    mainWindow.addBrowserView(overlayView);
  }
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const active = getActiveTab();
  mainWindow.webContents.send('browser:state', {
    tabs: tabs.map(({ id, title, url, settings }) => ({ id, title, url, settings })),
    activeTabId,
    canGoBack: Boolean(active?.view.webContents.canGoBack()),
    canGoForward: Boolean(active?.view.webContents.canGoForward()),
    isLoading: Boolean(active?.view.webContents.isLoading()),
    tileMode
  });
}

function navigate(value) {
  const active = getActiveTab();
  if (!active) return;
  let target = value.trim();
  if (!target) return;
  if (!/^https?:\/\//i.test(target)) {
    target = target.includes('.') && !target.includes(' ') ? `https://${target}` : `https://www.google.com/search?q=${encodeURIComponent(target)}`;
  }
  active.view.webContents.loadURL(target);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 760,
    minHeight: 480,
    frame: false,
    backgroundColor: '#101820',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  mainWindow.loadFile('index.html');
  mainWindow.on('resize', refreshBounds);
  mainWindow.on('maximize', refreshBounds);
  mainWindow.on('unmaximize', refreshBounds);
  createTab();
}

app.whenReady().then(() => {
  createWindow();
  ipcMain.on('browser:navigate', (_event, value) => navigate(value));
  ipcMain.on('browser:new-tab', () => createTab());
  ipcMain.on('browser:activate-tab', (_event, id) => activateTab(id));
  ipcMain.on('browser:close-tab', (_event, id) => closeTab(id));
  ipcMain.on('browser:back', () => getActiveTab()?.view.webContents.goBack());
  ipcMain.on('browser:forward', () => getActiveTab()?.view.webContents.goForward());
  ipcMain.on('browser:reload', () => getActiveTab()?.view.webContents.reload());
  ipcMain.on('browser:toggle-tile', (_event, selectedIds) => {
    tileSelection = new Set(selectedIds);
    tileMode = !tileMode;
    refreshBounds();
    sendState();
  });
  ipcMain.on('browser:set-tile-selection', (_event, selectedIds) => {
    tileSelection = new Set(selectedIds);
    if (tileMode) refreshBounds();
  });
  ipcMain.on('browser:set-overlay-width', (_event, width) => { overlayWidth = Math.max(0, Number(width) || 0); });
  ipcMain.on('browser:toggle-overlay', (_event, kind) => {
    if (!overlayView) {
      overlayView = new BrowserView({ webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
      mainWindow.addBrowserView(overlayView);
      overlayView.webContents.on('did-finish-load', () => {
        if (overlayKind) overlayView.webContents.send('overlay:show', overlayKind);
      });
      overlayView.webContents.loadFile('overlay.html');
    }
    overlayKind = overlayKind === kind ? null : kind;
    if (overlayKind) {
      const [, height] = mainWindow.getContentSize();
      const overlayWidth = overlayKind === 'sidebar' ? 280 : 240;
      overlayView.setBounds({ x: mainWindow.getContentSize()[0] - overlayWidth, y: 46, width: overlayWidth, height: Math.max(0, height - 46) });
      overlayView.webContents.send('overlay:show', overlayKind);
    } else {
      mainWindow.removeBrowserView(overlayView);
    }
  });
  ipcMain.on('browser:close-overlay', () => {
    overlayKind = null;
    if (overlayView) mainWindow.removeBrowserView(overlayView);
  });
  ipcMain.on('browser:overlay-action', (_event, action) => {
    if (action === 'settings') {
      const existing = tabs.find((tab) => tab.settings);
      return existing ? activateTab(existing.id) : createTab(path.join(__dirname, 'settings.html'), { settings: true, title: 'Configurações' });
    }
    if (action === 'devtools') return getActiveTab()?.view.webContents.toggleDevTools();
    if (action === 'clear-current') return getActiveTab()?.view.webContents.session.clearStorageData({ storages: ['cookies'] });
    if (action === 'clear-all') return Promise.all(tabs.map((tab) => tab.view.webContents.session.clearStorageData({ storages: ['cookies'] })));
  });
  ipcMain.on('browser:toggle-devtools', () => getActiveTab()?.view.webContents.toggleDevTools());
  ipcMain.on('window:minimize', () => mainWindow.minimize());
  ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.on('window:close', () => mainWindow.close());
  ipcMain.handle('browser:clear-cookies', async (_event, tabId) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (tab) await tab.view.webContents.session.clearStorageData({ storages: ['cookies'] });
    return true;
  });
  ipcMain.handle('browser:clear-all-cookies', async () => {
    await session.defaultSession.clearStorageData({ storages: ['cookies'] });
    await Promise.all(tabs.map((tab) => tab.view.webContents.session.clearStorageData({ storages: ['cookies'] })));
    return true;
  });
  ipcMain.handle('browser:open-settings', () => {
    const existing = tabs.find((tab) => tab.settings);
    if (existing) return activateTab(existing.id);
    return createTab(path.join(__dirname, 'settings.html'), { settings: true, title: 'Configurações' });
  });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
