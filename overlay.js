const panel = document.querySelector('#panel');
const title = document.querySelector('#panel-title');
const description = document.querySelector('#panel-description');
const content = document.querySelector('#panel-content');

function render(kind, data = []) {
  panel.hidden = false;
  const isMenu = kind === 'menu';
  title.textContent = isMenu ? 'Menu' : 'Painel lateral';
  description.textContent = isMenu ? 'Ações do navegador' : 'Favoritos e abas selecionadas';
  content.innerHTML = isMenu ? '<button class="menu-item" data-action="settings">Perfil e configurações</button><button class="menu-item" data-action="extensions">Extensões <span>›</span></button><button class="menu-item" data-action="clear-current">Limpar cookies desta aba</button><button class="menu-item" data-action="clear-all">Limpar cookies de todas as abas</button><button class="menu-item" data-action="devtools">Ferramentas de desenvolvedor</button>' : data.length ? data.map((favorite) => `<button class="favorite-entry" data-url="${escapeHtml(favorite.url)}">★ ${escapeHtml(favorite.title || favorite.url)}</button>`).join('') : '<p>Nenhum favorito salvo.</p>';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function renderExtensions(extensions) {
  title.textContent = 'Extensões';
  description.textContent = 'Extensões instaladas';
  content.innerHTML = `${extensions.map((extension) => `<button class="menu-item">${extension.name} <small>${extension.version}</small></button>`).join('')}<button class="menu-item" data-action="install-extension">+ Adicionar extensão descompactada</button>`;
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