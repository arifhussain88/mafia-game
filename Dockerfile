# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/game-lobby/package.json ./artifacts/game-lobby/
COPY artifacts/mobile-app/package.json ./artifacts/mobile-app/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY scripts/package.json ./scripts/
# Lockfile was generated on Windows with platform overrides; allow resolve on Linux builders.
RUN pnpm install --no-frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY scripts ./scripts
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/game-lobby ./artifacts/game-lobby
ENV NODE_ENV=production
RUN pnpm --filter @workspace/game-lobby run build \
 && pnpm --filter @workspace/api-server run build \
 && mkdir -p /app/artifacts/api-server/dist/public \
 && cp -R /app/artifacts/game-lobby/dist/public/. /app/artifacts/api-server/dist/public/

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV USERS_FILE=/data/users.json
ENV STATIC_DIR=/app/public

RUN mkdir -p /data /app/public
COPY --from=build /app/artifacts/api-server/dist ./dist
COPY --from=build /app/artifacts/api-server/dist/public ./public
# Runtime deps for any externals left unbundled
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=deps /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
