#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  VILLAS — Script de Instalação Automática
#  Corre este script no servidor Ubuntu como nunogouveia
# ─────────────────────────────────────────────────────────────

set -e  # Para se houver erro

echo ""
echo "================================================"
echo "  VILLAS — Instalação do Servidor"
echo "================================================"
echo ""

# ── 1. Instalar Puppeteer ─────────────────────────────────────
echo "→ A instalar Puppeteer (gerador de PDF)..."
cd /home/nunogouveia/villas
npm install puppeteer

# ── 2. Instalar dependências do Chromium (para Puppeteer) ─────
echo "→ A instalar dependências do Chromium..."
sudo apt install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0 2>/dev/null || true

# ── 3. Copiar config Nginx ─────────────────────────────────────
echo "→ A configurar Nginx..."
sudo cp /home/nunogouveia/villas/villas.nginx.conf /etc/nginx/sites-available/villas
sudo ln -sf /etc/nginx/sites-available/villas /etc/nginx/sites-enabled/villas
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ── 4. Instalar Certbot (SSL gratuito) ────────────────────────
echo "→ A instalar certificado SSL..."
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d villas.mlabcorp.net --non-interactive --agree-tos -m nunomggouveia@gmail.com

# ── 5. Iniciar servidor com PM2 ───────────────────────────────
echo "→ A iniciar servidor Node.js..."
cd /home/nunogouveia/villas
pm2 start server.js --name villas
pm2 save
pm2 startup | tail -1 | sudo bash

echo ""
echo "================================================"
echo "  ✓ Instalação concluída!"
echo "  App disponível em: https://villas.mlabcorp.net"
echo "================================================"
echo ""
