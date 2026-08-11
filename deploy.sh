#!/usr/bin/env bash
set -euo pipefail

cd /home/nunogouveia/villas

git pull --rebase --autostash origin main
pm2 restart villas --update-env
