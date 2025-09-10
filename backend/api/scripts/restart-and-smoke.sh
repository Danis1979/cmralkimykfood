#!/usr/bin/env bash
set -euo pipefail

# 1) Ubicación del API
cd ~/Desktop/cmr-alkimyk-structure/backend/api 2>/dev/null || cd backend/api

# 2) ¿Hay algo escuchando?
echo "== Estado del puerto 3000 =="
lsof -nP -iTCP:3000 -sTCP:LISTEN || echo "Nada escuchando en :3000"

# 3) Variables para HTTPS local
export HTTPS=true PORT=3000
[[ -f localhost.crt && -f localhost.key ]] || {
  echo "⚠️ Faltan localhost.crt/.key (si usás HTTPS)."
}

# 4) Levantar en dev (este comando queda en foreground)
echo "== Levantando Nest en modo dev =="
npm run start:dev
