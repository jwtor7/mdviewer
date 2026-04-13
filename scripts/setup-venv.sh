#!/usr/bin/env bash
set -euo pipefail

VENV_DIR="$(cd "$(dirname "$0")/.." && pwd)/.venv"
MARKITDOWN_BIN="$VENV_DIR/bin/markitdown"

if [ -x "$MARKITDOWN_BIN" ] && "$MARKITDOWN_BIN" --help >/dev/null 2>&1; then
  echo "[setup-venv] markitdown already installed at $MARKITDOWN_BIN"
  exit 0
fi

echo "[setup-venv] Creating Python venv at $VENV_DIR"
if command -v uv >/dev/null 2>&1; then
  uv venv "$VENV_DIR" --python 3.12 >/dev/null
  VIRTUAL_ENV="$VENV_DIR" uv pip install 'markitdown[all]'
else
  if ! command -v python3 >/dev/null 2>&1; then
    echo "[setup-venv] ERROR: python3 not found. Install Python 3.10+ or uv." >&2
    exit 1
  fi
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
  "$VENV_DIR/bin/pip" install 'markitdown[all]'
fi

echo "[setup-venv] markitdown ready at $MARKITDOWN_BIN"
