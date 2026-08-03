#!/usr/bin/env bash
# Tears down the demo instance started by demo-up.sh: stops the api/web
# servers and deletes the demo SQLite database.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PID_DIR="apps/api/tmp"
API_PID_FILE="$PID_DIR/demo-api.pid"
WEB_PID_FILE="$PID_DIR/demo-web.pid"
DB_FILENAME="apps/api/tmp/demo.sqlite3"

# `node ace serve` (api) forks its own server child process, so killing just
# the pid we captured leaves that child running as an orphan - collect the
# whole descendant tree first and kill it root-to-leaf... actually leaf-first
# doesn't matter here (nothing re-spawns children), so signal them all.
descendants() {
  local pid="$1"
  local children
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  echo "$pid"
  local child
  for child in $children; do
    descendants "$child"
  done
}

stop_pid_file() {
  local file="$1" label="$2"
  if [ ! -f "$file" ]; then
    echo "No pid file for demo $label ($file) - already stopped?"
    return
  fi
  local pid
  pid="$(cat "$file")"
  if kill -0 "$pid" 2>/dev/null; then
    local pids
    pids="$(descendants "$pid")"
    echo "Stopping demo $label (pid $pid, tree: $(echo "$pids" | tr '\n' ' '))..."
    kill $pids 2>/dev/null
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.2
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "Demo $label (pid $pid) didn't stop, killing -9..."
      kill -9 $pids 2>/dev/null
    fi
  else
    echo "Demo $label pid $pid not running."
  fi
  rm -f "$file"
}

stop_pid_file "$API_PID_FILE" "api"
stop_pid_file "$WEB_PID_FILE" "web"

echo "Removing demo database..."
rm -f "$DB_FILENAME" "$DB_FILENAME-wal" "$DB_FILENAME-shm"
rm -f apps/api/tmp/demo-api.log apps/api/tmp/demo-web.log

echo "Demo environment stopped."
