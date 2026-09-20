const panel = document.querySelector('#panel');
const title = document.querySelector('#panel-title');
const description = document.querySelector('#panel-description');
const content = document.querySelector('#panel-content');

function render(kind) {
  panel.hidden = false;
  const isMenu = kind === 'menu';
  title.textContent = isMenu ? 'Menu' : 'Painel lateral';
  description.textContent = isMenu ? 'Ações do navegador' : 'Favoritos e abas selecionadas';
  content.innerHTML = isMenu ? '<button class="menu-item" data-action="settings">Perfil e configurações</button><button class="menu-item" data-action="extensions">Extensões</button><button class="menu-item" data-action="clear-current">Limpar cookies desta aba</button><button class="menu-item" data-action="clear-all">Limpar cookies de todas as abas</button><button class="menu-item" data-action="devtools">Ferramentas de desenvolvedor</button>' : '<p>Use o botão de estrela para adicionar a página atual aos favoritos.</p>';
}

window.browserAPI.onOverlayShow(render);
document.querySelector('#close').addEventListener('click', () => window.browserAPI.closeOverlay());
content.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  window.browserAPI.overlayAction(button.dataset.action);
  window.browserAPI.closeOverlay();
});