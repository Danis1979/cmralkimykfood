#!/usr/bin/env bash
set -euo pipefail

echo "→ Buscando backups (*.bak.*) en src/"
mapfile -t FILES < <(find src -type f -name '*.bak.*' | sort || true)

if (( ${#FILES[@]} == 0 )); then
  echo "✓ No hay backups para borrar."
else
  echo "Se eliminarán ${#FILES[@]} archivos:"
  printf '  %s\n' "${FILES[@]}"
  read -r -p "¿Confirmás? [y/N] " ans
  if [[ "${ans,,}" == "y" ]]; then
    rm -f "${FILES[@]}"
    echo "✓ Backups eliminados."
  else
    echo "✗ Cancelado."
  fi
fi

# asegurar .gitignore
touch .gitignore
if ! grep -qxE '\*\.bak\.\*' .gitignore; then
  echo '*.bak.*' >> .gitignore
  echo "✓ .gitignore actualizado (añadido *.bak.*)"
else
  echo "✓ .gitignore ya contenía *.bak.*"
fi
