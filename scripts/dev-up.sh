#!/usr/bin/env bash
# Starts both dev servers (api + web) together, prefixing their output so
# it's clear which log line came from which, and stops both when this script
# exits - whether via Ctrl+C or one of them crashing - so a killed terminal
# doesn't leave an orphan behind (see dev-down.sh, which cleans up by port
# instead, for when this script itself gets killed too hard to run its trap).
set -uo pipefail

cleanup() {
  # `trap - EXIT INT TERM` first, not decoration - `kill 0` below signals
  # this script's own process group, which re-delivers TERM/INT to this same
  # process and re-enters cleanup unless the trap is cleared first, looping
  # "Stopping dev servers..." until the group is fully dead.
  trap - EXIT INT TERM
  echo ""
  echo "Stopping dev servers..."
  kill 0 2>/dev/null
}
trap cleanup EXIT INT TERM

(pnpm --filter api dev 2>&1 | sed -e 's/^/[api] /') &
(pnpm --filter web dev 2>&1 | sed -e 's/^/[web] /') &

wait
