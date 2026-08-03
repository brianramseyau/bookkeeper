# syntax=docker/dockerfile:1

# ---- stage 1: build the SvelteKit static SPA ----
FROM node:24-alpine AS web-build
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter web --frozen-lockfile
COPY apps/web apps/web
RUN pnpm --filter web build

# ---- stage 2: build the AdonisJS app ----
FROM node:24-alpine AS api-build
WORKDIR /app
RUN npm install -g pnpm
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter api --frozen-lockfile
COPY apps/api apps/api
COPY --from=web-build /app/apps/web/build apps/api/public
RUN pnpm --filter api build
WORKDIR /app/apps/api/build
RUN npm install --omit=dev --no-audit --no-fund

# ---- stage 3: runtime ----
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache shadow su-exec
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333
ENV LOG_LEVEL=info
ENV SESSION_DRIVER=cookie
ENV LIMITER_STORE=database
ENV DB_FILENAME=/app/data/bookkeeper.sqlite3
# Unraid-style: set these to match the host user that should own files under
# the /app/data volume mount. The container starts as root just long enough
# to apply them, then drops to that uid/gid to run migrations and the server.
ENV PUID=1000
ENV PGID=1000
COPY --from=api-build /app/apps/api/build ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
VOLUME /app/data
EXPOSE 3333
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "node ace migration:run --force && node bin/server.js"]
