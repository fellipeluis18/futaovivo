const panel = document.querySelector('#panel');
const title = document.querySelector('#panel-title');
const description = document.querySelector('#panel-description');
const content = document.querySelector('#panel-content');
let currentKind = null;
let currentOverlayData = {};
let favoriteContextOpen = false;

function render(kind, data = []) {
  currentKind = kind;
  currentOverlayData = data;
  favoriteContextOpen = false;
  panel.hidden = false;
  const isMenu = kind === 'menu';
  const isFavorites = kind === 'favorites';
  const isTabContext = kind === 'tab-context';
  panel.className = isTabContext ? 'context-panel' : '';
  title.textContent = isTabContext ? '' : isFavorites ? 'Favoritos' : isMenu ? 'Menu' : 'Painel lateral';
  description.textContent = isFavorites ? 'Páginas salvas' : isMenu ? 'Ações do navegador' : '';
  content.innerHTML = isTabContext ? `<button class="tab-menu-item" data-tab-action="pin">${data.pinned ? 'Desafixar' : 'Fixar'}</button><button class="tab-menu-item" data-tab-action="mute">${data.muted ? 'Ativar som' : 'Desativar Som'}</button><button class="tab-menu-item" data-tab-action="duplicate">Duplicar</button><button class="tab-menu-item" data-tab-action="close-right">Fechar à Direita</button>` : isMenu ? '<button class="menu-item" data-action="settings">Perfil e configurações</button><button class="menu-item" data-action="extensions">Extensões <span>›</span></button><button class="menu-item" data-action="clear-current">Limpar cookies desta aba</button><button class="menu-item" data-action="clear-all">Limpar cookies de todas as abas</button><button class="menu-item" data-action="devtools">Ferramentas de desenvolvedor</button>' : isFavorites ? `<button class="menu-item" data-favorite-action="create-folder">+ Criar pasta</button>${data.length ? renderFavoriteItems(data) : '<p>Nenhum favorito salvo.</p>'}` : '';
}

panel.addEventListener('mouseleave', () => {
  if ((currentKind === 'menu' || currentKind === 'favorites' || currentKind === 'tab-context') && !favoriteContextOpen) window.browserAPI.closeOverlay();
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function renderFavoriteItems(items, depth = 0) {
  return items.map((item) => item.type === 'folder'
    ? `<div class="favorite-folder" data-favorite-id="${item.id}" style="margin-left:${depth * 10}px">📁 ${escapeHtml(item.name)}${renderFavoriteItems(item.children, depth + 1)}</div>`
    : `<button class="favorite-entry" data-url="${escapeHtml(item.url)}" data-favorite-id="${item.id}" style="margin-left:${depth * 10}px">★ ${escapeHtml(item.title || item.url)}</button>`).join('');
}

function enableFavoriteDrag() {
  content.querySelectorAll('[data-favorite-id]').forEach((item) => {
    item.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', item.dataset.favoriteId));
    item.addEventListener('dragover', (event) => { if (item.classList.contains('favorite-folder')) event.preventDefault(); });
    item.addEventListener('drop', (event) => {
      if (!item.classList.contains('favorite-folder')) return;
      event.preventDefault();
      window.browserAPI.favoriteAction('move', { id: event.dataTransfer.getData('text/plain'), folderId: item.dataset.favoriteId });
    });
  });
}

function favoriteContextMenu(event, itemId) {
  event.preventDefault();
  document.querySelectorAll('.favorite-context-menu').forEach((menu) => menu.remove());
  const menu = document.createElement('div');
  menu.className = 'favorite-context-menu';
  favoriteContextOpen = true;
  menu.innerHTML = '<button data-favorite-action="move">Mover</button><button data-favorite-action="edit">Editar</button><button data-favorite-action="delete">Excluir</button><button data-favorite-action="create-folder">Criar pasta</button>';
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - 150)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - 150)}px`;
  document.body.appendChild(menu);
  menu.addEventListener('click', (clickEvent) => {
    const action = clickEvent.target.dataset.favoriteAction;
    if (!action) return;
    const data = { id: itemId };
    if (action === 'create-folder') data.name = prompt('Nome da pasta:');
    if (action === 'move') {
      const folders = [];
      const collectFolders = (items) => items.forEach((item) => { if (item.type === 'folder') { folders.push(`${item.name} (${item.id})`); collectFolders(item.children); } });
      collectFolders(currentOverlayData);
      const selectedFolder = prompt(`Pasta de destino (deixe vazio para raiz):\n${folders.join('\n')}`) || '';
      data.folderId = folders.find((folder) => folder.startsWith(selectedFolder))?.match(/\(([^)]+)\)$/)?.[1] || null;
    }
    window.browserAPI.favoriteAction(action, data);
    favoriteContextOpen = false;
    menu.remove();
  });
  menu.addEventListener('mouseleave', () => { favoriteContextOpen = false; menu.remove(); });
  if (isFavorites) enableFavoriteDrag();
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
  const favoriteAction = event.target.closest('[data-favorite-action]');
  if (favoriteAction) {
    if (favoriteAction.dataset.favoriteAction === 'create-folder') {
      const name = prompt('Nome da pasta:');
      if (name?.trim()) window.browserAPI.favoriteAction('create-folder', { name: name.trim() });
    }
    return;
  }
  const tabAction = event.target.closest('[data-tab-action]');
  if (tabAction && currentKind === 'tab-context') {
    window.browserAPI.tabAction(currentOverlayData.tabId, tabAction.dataset.tabAction);
    window.browserAPI.closeOverlay();
    return;
  }
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
content.addEventListener('contextmenu', (event) => {
  const item = event.target.closest('[data-favorite-id]');
  if (currentKind === 'favorites' && item) favoriteContextMenu(event, item.dataset.favoriteId);
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
  content.appendChild(menu);
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const margin = 8;
  menu.style.left = `${Math.max(margin, Math.min(event.clientX, window.innerWidth - menuWidth - margin))}px`;
  menu.style.top = `${Math.max(margin, Math.min(event.clientY, window.innerHeight - menuHeight - margin))}px`;
  menu.addEventListener('click', async (menuEvent) => {
    const action = menuEvent.target.dataset.extensionAction;
    if (action === 'options') await window.browserAPI.openExtensionOptions(entry.dataset.extensionId);
    if (action === 'remove') await window.browserAPI.removeExtension(entry.dataset.extensionId);
    if (action === 'manage') window.browserAPI.navigate(`chrome://extensions/?id=${entry.dataset.extensionId}`);
    menu.remove();
    renderExtensions(await window.browserAPI.listExtensions());
  });
  menu.addEventListener('mouseleave', () => menu.remove());
});