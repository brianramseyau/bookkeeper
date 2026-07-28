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
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333
ENV LOG_LEVEL=info
ENV SESSION_DRIVER=cookie
ENV DB_FILENAME=/app/data/bookkeeper.sqlite3
COPY --from=api-build --chown=node:node /app/apps/api/build ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME /app/data
EXPOSE 3333
CMD ["sh", "-c", "node ace migration:run --force && node bin/server.js"]
