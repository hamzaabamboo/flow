#!/usr/bin/env bash
set -euo pipefail

NODE_ENV=development bun run src/server/index.ts > /tmp/hamflow-endpoints-server.log 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

for _ in {1..30}; do
  if curl -sSf http://127.0.0.1:3000/ >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}" bun run scripts/test-endpoints.ts
