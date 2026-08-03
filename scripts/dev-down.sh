#!/usr/bin/env bash
# Stops whatever is listening on the standard dev ports (3333 api, 5173 web),
# no matter how it was started - a foreground terminal you lost track of, or
# a background/detached process. Finds processes by port instead of relying
# on a pid file, so there's nothing to hunt for by hand.
set -uo pipefail

API_PORT=3333
WEB_PORT=5173

# `node ace serve --hmr` forks a child server process that actually holds the
# listening socket - if we only kill that child, the `ace serve` wrapper is
# left as an orphan. Walk up to the parent and take it too, but only when its
# command line confirms it's the ace wrapper (avoid killing an unrelated
# parent shell/terminal).
stop_port() {
  local port="$1" label="$2"
  local listen_pid
  listen_pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)"

  if [ -z "$listen_pid" ]; then
    echo "Nothing listening on :$port ($label) - already stopped."
    return
  fi

  local pids="$listen_pid"
  local ppid parent_cmd
  ppid="$(ps -o ppid= -p "$listen_pid" 2>/dev/null | tr -d ' ')"
  if [ -n "$ppid" ] && [ "$ppid" != "1" ]; then
    parent_cmd="$(ps -o command= -p "$ppid" 2>/dev/null)"
    case "$parent_cmd" in
      *"ace serve"*) pids="$pids $ppid" ;;
    esac
  fi

  echo "Stopping $label on :$port (pid(s): $pids)..."
  kill $pids 2>/dev/null
  for _ in $(seq 1 20); do
    kill -0 "$listen_pid" 2>/dev/null || break
    sleep 0.2
  done
  if kill -0 "$listen_pid" 2>/dev/null; then
    echo "$label didn't stop, killing -9..."
    kill -9 $pids 2>/dev/null
  fi
}

stop_port "$API_PORT" "api"
stop_port "$WEB_PORT" "web"

echo "Dev servers stopped."
