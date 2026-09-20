const panel = document.querySelector('#panel');
const title = document.querySelector('#panel-title');
const description = document.querySelector('#panel-description');
const content = document.querySelector('#panel-content');
let currentKind = null;

function render(kind, data = []) {
  currentKind = kind;
  panel.hidden = false;
  const isMenu = kind === 'menu';
  const isFavorites = kind === 'favorites';
  const isPanel = kind === 'panel';
  title.textContent = isFavorites ? 'Favoritos' : isMenu ? 'Menu' : 'Painel lateral';
  description.textContent = isFavorites ? 'Páginas salvas' : isMenu ? 'Ações do navegador' : '';
  content.innerHTML = isMenu ? '<button class="menu-item" data-action="settings">Perfil e configurações</button><button class="menu-item" data-action="extensions">Extensões <span>›</span></button><button class="menu-item" data-action="clear-current">Limpar cookies desta aba</button><button class="menu-item" data-action="clear-all">Limpar cookies de todas as abas</button><button class="menu-item" data-action="devtools">Ferramentas de desenvolvedor</button>' : isFavorites ? (data.length ? data.map((favorite) => `<button class="favorite-entry" data-url="${escapeHtml(favorite.url)}">★ ${escapeHtml(favorite.title || favorite.url)}</button>`).join('') : '<p>Nenhum favorito salvo.</p>') : '';
}

panel.addEventListener('mouseleave', () => {
  if (currentKind === 'menu' || currentKind === 'favorites') window.browserAPI.closeOverlay();
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function renderExtensions(extensions) {
  title.textContent = 'Extensões';
  description.textContent = 'Extensões instaladas';
  content.innerHTML = `${extensions.map((extension) => `<button class="extension-entry menu-item" data-extension-id="${extension.id}" data-enabled="${extension.enabled !== false}">${extension.name} <small>${extension.version}</small><input type="checkbox" class="extension-toggle" ${extension.enabled !== false ? 'checked' : ''} aria-label="Ativar extensão"></button>`).join('')}<button class="menu-item" data-action="install-extension">+ Adicionar extensão descompactada</button>`;
}

window.browserAPI.onOverlayShow(render);
window.browserAPI.onOverlayExtensions(renderExtensions);
document.querySelector('#close').addEventListener('click', () => window.browserAPI.closeOverlay());
content.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const favorite = event.target.closest('[data-url]');
  if (favorite) return window.browserAPI.navigate(favorite.dataset.url);
  if (!button) return;
  if (button.dataset.action === 'extensions') {
    window.browserAPI.listExtensions().then(renderExtensions);
    return;
  }
  if (button.dataset.action === 'install-extension') {
    window.browserAPI.installExtension().then(renderExtensions);
    return;
  }
  window.browserAPI.overlayAction(button.dataset.action);
  window.browserAPI.closeOverlay();
});
content.addEventListener('change', async (event) => {
  if (!event.target.classList.contains('extension-toggle')) return;
  await window.browserAPI.toggleExtension(event.target.closest('[data-extension-id]').dataset.extensionId);
  const extensions = await window.browserAPI.listExtensions();
  renderExtensions(extensions);
});
content.addEventListener('contextmenu', async (event) => {
  const entry = event.target.closest('[data-extension-id]');
  if (!entry) return;
  event.preventDefault();
  document.querySelectorAll('.extension-context-menu').forEach((menu) => menu.remove());
  const menu = document.createElement('div');
  menu.className = 'extension-context-menu';
  menu.innerHTML = '<button data-extension-action="options">Opções</button><button data-extension-action="manage">Gerenciar Extensão</button><button data-extension-action="remove">Remover Extensão</button>';
  menu.style.left = `${event.offsetX}px`;
  menu.style.top = `${event.offsetY}px`;
  content.appendChild(menu);
  menu.addEventListener('click', async (menuEvent) => {
    const action = menuEvent.target.dataset.extensionAction;
    if (action === 'options') await window.browserAPI.openExtensionOptions(entry.dataset.extensionId);
    if (action === 'remove') await window.browserAPI.removeExtension(entry.dataset.extensionId);
    if (action === 'manage') window.browserAPI.navigate(`chrome://extensions/?id=${entry.dataset.extensionId}`);
    menu.remove();
    renderExtensions(await window.browserAPI.listExtensions());
  });
});