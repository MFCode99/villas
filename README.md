# Villas

Sistema web para catalogo, encomendas e gestao interna da marca Villas, com frontend em HTML/CSS/JS e backend Node.js ligado a MySQL.

## Visao geral

O projeto inclui:

- catalogo de produtos com variantes de cor, tamanho e quantidade
- carrinho de encomendas por utilizador
- login com sessao persistente no servidor
- area de cliente
- area de admin
- painel tecnico/developer
- gestao de produtos, categorias, clientes e definicoes do site
- envio de encomendas por email
- geracao de PDFs
- persistencia de carrinho e sessao na base de dados

## Stack

- Node.js
- MySQL
- HTML
- CSS
- JavaScript vanilla
- Nginx
- PM2
- Nodemailer
- Puppeteer

## Estrutura do projeto

- `server.js` - servidor principal e API
- `index.html` - app web principal
- `styles/` - estilos do site
- `js/` - logica do frontend
- `schema.sql` - schema da base de dados
- `sync-products.js` - sincroniza produtos do catalogo embutido para o MySQL
- `setup.sh` - script de instalacao no servidor
- `villas.nginx.conf` - configuracao Nginx

## Funcionalidades principais

### Publico / utilizador

- login em `/entrar`
- catalogo em `/catalogo`
- visualizacao de produtos por referencia, nome, tipo, cor e tamanho
- carrinho de compras
- ajuste de quantidade por incremento configuravel
- envio de encomenda por email
- guardado do carrinho na base de dados

### Admin

- area administrativa em `/admin`
- gestao de clientes
- gestao de encomendas
- edicao de produtos
- upload/alteracao de imagem do produto
- ativar/desativar produtos
- definir estacao do produto
- definir incremento de quantidade
- gerir categorias
- gerir definicoes do site
- ver logs de login e atividade

### Developer

- painel tecnico com estatisticas
- ultimos logins
- ultimas encomendas
- notas tecnicas

## Base de dados

O schema completo esta em [`schema.sql`](./schema.sql).

Tabelas principais:

- `clientes`
- `produtos`
- `categorias`
- `encomendas`
- `encomenda_linhas`
- `cart_states`
- `sessions`
- `login_logs`
- `error_logs`
- `dev_notes`
- `site_settings`

## Requisitos

- Node.js 18+
- MySQL 8+
- Nginx
- PM2
- Certbot, se quiseres HTTPS automatico

## Configuracao

As variaveis de ambiente usadas pelo servidor sao:

- `PORT`
- `VILLAS_DB_HOST`
- `VILLAS_DB_USER`
- `VILLAS_DB_PASS`
- `VILLAS_DB_NAME`
- `VILLAS_DB_PORT`
- `VILLAS_EMAIL_FROM`
- `VILLAS_EMAIL_TO`
- `VILLAS_EMAIL_PASS`

Exemplo:

```bash
export PORT=3000
export VILLAS_DB_HOST=localhost
export VILLAS_DB_USER=villas_user
export VILLAS_DB_PASS=your_password_here
export VILLAS_DB_NAME=villas
export VILLAS_DB_PORT=3306
export VILLAS_EMAIL_FROM=your_email@example.com
export VILLAS_EMAIL_TO=your_email@example.com
export VILLAS_EMAIL_PASS=your_smtp_password
```

## Instalar dependencias

```bash
npm install
```

Se precisares de gerar PDFs com Puppeteer no Ubuntu, instala tambem as dependencias do Chromium.

## Criar a base de dados

1. Criar a base e importar o schema:

```bash
mysql -u root -p < schema.sql
```

2. Confirmar que o utilizador da app tem permissao na base `villas`.

## Executar localmente

```bash
node server.js
```

Por defeito o servidor corre na porta `3000`.

## Rotas principais

- `/` - redireciona para login
- `/entrar` - pagina de login
- `/catalogo` - catalogo protegido
- `/admin` - area admin protegida

API principal:

- `GET /produtos`
- `GET /site-settings`
- `GET /me`
- `POST /logout`
- `GET /me/cart`
- `PUT /me/cart`
- `DELETE /me/cart`

## Sincronizar produtos

O ficheiro [`sync-products.js`](./sync-products.js) extrai o catalogo embutido no `index.html` e grava produtos/categorias no MySQL.

Executar:

```bash
node sync-products.js
```

## Deploy no servidor

### Com PM2

```bash
cd /home/nunogouveia/villas
git pull --rebase --autostash origin main
pm2 restart villas --update-env
```

### Com Nginx

O ficheiro [`villas.nginx.conf`](./villas.nginx.conf) faz proxy para `127.0.0.1:3000` e termina SSL em `villas.mlabcorp.net`.

## Script de instalacao

O [`setup.sh`](./setup.sh) instala dependencias do projeto, configura Nginx, Certbot e PM2 no servidor Ubuntu.

## Notas tecnicas

- A sessao do utilizador vive no servidor e expira ao fim de 30 minutos.
- O carrinho e guardado por utilizador na base de dados.
- O sitio usa MySQL como fonte de verdade para clientes, produtos, categorias, encomendas e logs.
- O frontend usa cache-busting por versao para evitar ficheiros antigos no browser.

## Resolucao de problemas

### O login nao aparece

- confirma que esta a abrir `/entrar`
- faz hard reload uma vez
- reinicia o processo com PM2

### O MySQL nao arranca

- verifica `systemctl status mysql`
- confere se o utilizador e a base existem
- confirma que o schema foi importado

### O site nao atualiza

```bash
cd /home/nunogouveia/villas
git pull --rebase --autostash origin main
pm2 restart villas --update-env
```

## Licenca

Projeto interno Villas. Uso conforme as regras do projeto.
