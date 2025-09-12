#!/usr/bin/env bash
set -euo pipefail

# Ejecutar desde backend/api o ajusta BASE_DIR si hace falta
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$BASE_DIR"
CRT="$OUT_DIR/localhost.crt"
KEY="$OUT_DIR/localhost.key"
CNF="$OUT_DIR/openssl.dev.cnf"

cat > "$CNF" <<'CONF'
[ req ]
default_bits       = 2048
prompt             = no
default_md         = sha256
req_extensions     = req_ext
distinguished_name = dn
x509_extensions    = v3_ext

[ dn ]
C  = AR
ST = Buenos Aires
L  = CABA
O  = Dev
CN = localhost

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1  = 127.0.0.1
IP.2  = ::1

[ v3_ext ]
subjectAltName      = @alt_names
basicConstraints    = CA:false
keyUsage            = digitalSignature, keyEncipherment, dataEncipherment
extendedKeyUsage    = serverAuth
CONF

echo "→ Generando key+crt auto-firmado para localhost…"
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$KEY" -out "$CRT" -config "$CNF" -extensions v3_ext

echo
echo "✓ Cert generado:"
ls -l "$CRT" "$KEY"
echo
echo "Si el navegador avisa que no es confiable, podés importarlo en 'Acceso a llaveros' y marcarlo como 'Confiar siempre'."
