#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' 'Node.js e npm precisam estar instalados para abrir o navegador.'
  printf '%s\n' 'Instale-os em https://nodejs.org/ e execute este arquivo novamente.'
  read -r -p 'Pressione Enter para fechar...'
  exit 1
fi

if [ ! -d node_modules/electron ]; then
  printf '%s\n' 'Instalando dependências do navegador...'
  npm install
fi

npm start
