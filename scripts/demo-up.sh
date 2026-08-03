#!/usr/bin/env bash
# Brings up a disposable demo instance: fresh SQLite db seeded with fictional
# data via `demo:seed` (see README.md#demo-mode), api + web dev servers on
# isolated ports (3335/5175) so they never collide with the regular dev
# server (3333/5173, which AGENTS.md requires stay running/undisturbed) or
# the e2e suite's own servers (3334/5174).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

API_PORT=3335
WEB_PORT=5175
DB_FILENAME="tmp/demo.sqlite3"
PID_DIR="apps/api/tmp"
API_PID_FILE="$PID_DIR/demo-api.pid"
WEB_PID_FILE="$PID_DIR/demo-web.pid"

mkdir -p "$PID_DIR"

if [ -f "$API_PID_FILE" ] || [ -f "$WEB_PID_FILE" ]; then
  echo "Demo environment already appears to be running (pid files found in $PID_DIR)."
  echo "Run 'pnpm demo:down' first if it's stale."
  exit 1
fi

echo "Resetting demo database..."
rm -f "apps/api/$DB_FILENAME" "apps/api/$DB_FILENAME-wal" "apps/api/$DB_FILENAME-shm"

echo "Running migrations against demo database..."
(cd apps/api && DB_FILENAME="$DB_FILENAME" node ace migration:run --force)

# migration:run regenerates database/schema.ts / schema_rules.ts unformatted
# as a side effect regardless of which DB it targets - reformat back to the
# committed style so this doesn't leave a spurious diff (same fix applied in
# playwright.config.ts for the e2e suite).
(cd apps/api && npx prettier --write database/schema.ts database/schema_rules.ts)

echo "Seeding demo data..."
(cd apps/api && DB_FILENAME="$DB_FILENAME" node ace demo:seed)

echo "Starting demo API on :$API_PORT..."
(
  cd apps/api
  DB_FILENAME="$DB_FILENAME" PORT="$API_PORT" HOST=localhost \
    APP_URL="http://localhost:$API_PORT" NODE_ENV=development \
    nohup node ace serve >tmp/demo-api.log 2>&1 &
  echo $! >tmp/demo-api.pid
)

echo "Starting demo web on :$WEB_PORT..."
(
  cd apps/web
  API_PROXY_TARGET="http://localhost:$API_PORT" \
    nohup node_modules/.bin/vite dev --port "$WEB_PORT" --strictPort \
    >../api/tmp/demo-web.log 2>&1 &
  echo $! >../api/tmp/demo-web.pid
)

echo ""
echo "Demo environment is up:"
echo "  web: http://localhost:$WEB_PORT"
echo "  api: http://localhost:$API_PORT"
echo "  login: jordan@demo.local / DemoPass123! (or taylor@demo.local)"
echo "  logs: apps/api/tmp/demo-api.log, apps/api/tmp/demo-web.log"
echo "Run 'pnpm demo:down' to stop it and delete the demo database."
