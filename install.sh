#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required but was not found in PATH." >&2
  exit 1
fi

bun install --silent --cwd "$SCRIPT_DIR"
bun run "$SCRIPT_DIR/bin/install.ts"
