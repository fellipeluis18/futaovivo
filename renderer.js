const $ = (selector) => document.querySelector(selector);
const state = { tabs: [], activeTabId: null, selected: new Set(), favorites: JSON.parse(localStorage.getItem('favorites') || '[]') };
const overlays = { sidebar: false, menu: false };

function updateSelectAllState() {
  const internetTabs = state.tabs.filter((tab) => !tab.settings);
  const allSelected = internetTabs.length > 0 && internetTabs.every((tab) => state.selected.has(tab.id));
  $('#select-all').classList.toggle('all-selected', allSelected);
}

function updateOverlayWidth() {
  window.browserAPI.setOverlayWidth(overlays.sidebar ? 280 : overlays.menu ? 240 : 0);
}

function renderTabs() {
  const container = $('#tabs');
  container.innerHTML = '';
  for (const tab of state.tabs) {
    const item = document.createElement('div');
    item.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
    item.draggable = !tab.settings;
    item.dataset.id = tab.id;
    item.innerHTML = `<span class="tab-title">${escapeHtml(tab.title)}</span><input type="checkbox" class="tab-check" ${state.selected.has(tab.id) ? 'checked' : ''} aria-label="Selecionar ${escapeHtml(tab.title)}"><button class="tab-close" aria-label="Fechar aba">×</button>`;
    item.addEventListener('click', (event) => {
      if (!event.target.closest('.tab-close') && !event.target.closest('.tab-check')) window.browserAPI.activateTab(tab.id);
    });
    item.querySelector('.tab-close').addEventListener('click', () => window.browserAPI.closeTab(tab.id));
    item.querySelector('.tab-check').addEventListener('change', (event) => {
      event.target.checked ? state.selected.add(tab.id) : state.selected.delete(tab.id);
      window.browserAPI.setTileSelection([...state.selected]);
      updateSelectAllState();
      renderSidebar();
    });
    item.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', tab.id));
    item.addEventListener('dragover', (event) => event.preventDefault());
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = state.tabs.findIndex((entry) => entry.id === Number(event.dataTransfer.getData('text/plain')));
      const to = state.tabs.findIndex((entry) => entry.id === tab.id);
      if (from >= 0 && to >= 0) {
        const [moved] = state.tabs.splice(from, 1);
        state.tabs.splice(to, 0, moved);
        renderTabs();
      }
    });
    container.appendChild(item);
  }
  updateSelectAllState();
}

function renderState(nextState) {
  state.tabs = nextState.tabs;
  state.activeTabId = nextState.activeTabId;
  document.body.classList.toggle('tile-mode', nextState.tileMode);
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);
  $('#address').value = active?.url || '';
  const onWebStore = active?.url?.includes('chromewebstore.google.com');
  $('#install-extension').hidden = !onWebStore;
  $('#install-extension').textContent = nextState.installedExtensions?.length ? 'Instalado' : 'Instalar';
  $('#back').disabled = !nextState.canGoBack;
  $('#forward').disabled = !nextState.canGoForward;
  renderTabs();
  renderSidebar();
}

function renderSidebar() {
  $('#favorites-list').innerHTML = state.favorites.map((favorite) => `<button class="favorite-entry" data-url="${escapeHtml(favorite.url)}">★ ${escapeHtml(favorite.title || favorite.url)}</button>`).join('');
  $('#selected-list').innerHTML = [...state.selected].map((id) => {
    const tab = state.tabs.find((entry) => entry.id === id);
    return tab ? `<button data-id="${tab.id}">${escapeHtml(tab.title)}</button>` : '';
  }).join('');
  document.querySelectorAll('.favorite-entry').forEach((button) => button.addEventListener('click', () => window.browserAPI.navigate(button.dataset.url)));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

$('#address-form').addEventListener('submit', (event) => { event.preventDefault(); window.browserAPI.navigate($('#address').value); });
$('#address').addEventListener('focus', (event) => event.target.select());
$('#back').addEventListener('click', () => window.browserAPI.back());
$('#forward').addEventListener('click', () => window.browserAPI.forward());
$('#reload').addEventListener('click', () => window.browserAPI.reload());
$('#new-tab').addEventListener('click', () => window.browserAPI.newTab());
$('#install-extension').addEventListener('click', async () => {
  const extensions = await window.browserAPI.installExtension();
  $('#install-extension').textContent = extensions.length ? 'Instalado' : 'Instalar';
});
$('#tile').addEventListener('click', () => window.browserAPI.toggleTile([...state.selected]));
$('#select-all').addEventListener('click', () => {
  const allSelected = state.tabs.filter((tab) => !tab.settings).every((tab) => state.selected.has(tab.id));
  state.tabs.filter((tab) => !tab.settings).forEach((tab) => allSelected ? state.selected.delete(tab.id) : state.selected.add(tab.id));
  window.browserAPI.setTileSelection([...state.selected]);
  renderTabs(); renderSidebar();
  updateSelectAllState();
});
$('#side-panel').addEventListener('click', () => {
  overlays.sidebar = !overlays.sidebar;
  $('#sidebar').hidden = !overlays.sidebar;
  updateOverlayWidth();
  window.browserAPI.toggleOverlay('sidebar', state.favorites);
});
$('#favorite-pages').addEventListener('click', () => {
  overlays.sidebar = true;
  $('#sidebar').hidden = false;
  updateOverlayWidth();
  window.browserAPI.toggleOverlay('sidebar', state.favorites);
});
$('#close-sidebar').addEventListener('click', () => {
  overlays.sidebar = false;
  $('#sidebar').hidden = true;
  updateOverlayWidth();
});
$('#favorite').addEventListener('click', () => {
  const active = state.tabs.find((tab) => tab.id === state.activeTabId);
  if (!active || active.settings) return;
  if (!state.favorites.some((favorite) => favorite.url === active.url)) state.favorites.push({ title: active.title, url: active.url });
  localStorage.setItem('favorites', JSON.stringify(state.favorites));
  $('#favorite').textContent = '★';
  renderSidebar();
});
$('#menu-button').addEventListener('click', () => {
  overlays.menu = !overlays.menu;
  $('#menu').hidden = !overlays.menu;
  updateOverlayWidth();
  window.browserAPI.toggleOverlay('menu');
});
$('#settings').addEventListener('click', () => window.browserAPI.openSettings());
$('#devtools').addEventListener('click', () => window.browserAPI.toggleDevTools());
$('#clear-current').addEventListener('click', async () => { await window.browserAPI.clearCookies(state.activeTabId); overlays.menu = false; $('#menu').hidden = true; updateOverlayWidth(); });
$('#clear-all').addEventListener('click', async () => { await window.browserAPI.clearAllCookies(); overlays.menu = false; $('#menu').hidden = true; updateOverlayWidth(); });
$('#minimize').addEventListener('click', () => window.browserAPI.minimize());
$('#maximize').addEventListener('click', () => window.browserAPI.maximize());
$('#close').addEventListener('click', () => window.browserAPI.close());
window.addEventListener('keydown', (event) => { if (event.key === 'F5') { event.preventDefault(); window.browserAPI.reload(); } });
window.browserAPI.onState(renderState);
