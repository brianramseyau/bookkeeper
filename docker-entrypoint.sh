#!/bin/sh
# Aligns the built-in "node" user/group with PUID/PGID (unraid-style), fixes
# up ownership of the data volume, then drops from root to that user before
# handing off to the real command.
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

groupmod -o -g "$PGID" node
usermod -o -u "$PUID" node

mkdir -p /app/data
chown -R "$PUID:$PGID" /app/data

exec su-exec "$PUID:$PGID" "$@"
