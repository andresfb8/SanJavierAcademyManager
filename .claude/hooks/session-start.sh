#!/bin/bash
set -euo pipefail

# Solo ejecutar en entornos remotos de Claude Code (web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

echo "=== San Javier Academy Manager — Configurando entorno ==="

# Instalar dependencias del frontend si no existen
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Instalando dependencias del frontend..."
  npm --prefix "$PROJECT_DIR" install
else
  echo "Dependencias del frontend: OK"
fi

# Instalar dependencias de Cloud Functions si no existen
if [ ! -d "$PROJECT_DIR/functions/node_modules" ]; then
  echo "Instalando dependencias de Cloud Functions..."
  npm --prefix "$PROJECT_DIR/functions" install
else
  echo "Dependencias de Cloud Functions: OK"
fi

# Instalar Firebase CLI si no está disponible
if ! command -v firebase &>/dev/null; then
  echo "Instalando Firebase CLI..."
  npm install -g firebase-tools
else
  echo "Firebase CLI: OK ($(firebase --version))"
fi

echo "=== Entorno listo ==="
