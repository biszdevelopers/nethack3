# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14-alpine AS build
# hadolint ignore=DL3002
USER 0:0
WORKDIR /app

COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/site/package.json apps/site/package.json
COPY apps/workspace/package.json apps/workspace/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN bun install --frozen-lockfile

COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY packages/contracts/tsconfig.build.json packages/contracts/tsconfig.build.json
COPY packages/ui/src packages/ui/src
COPY packages/ui/styles.css packages/ui/styles.css
COPY packages/ui/tsconfig.json packages/ui/tsconfig.json
COPY packages/ui/tsconfig.build.json packages/ui/tsconfig.build.json
COPY packages/api-client/src packages/api-client/src
COPY packages/api-client/tsconfig.json packages/api-client/tsconfig.json
COPY packages/api-client/tsconfig.build.json packages/api-client/tsconfig.build.json
COPY apps/workspace/src apps/workspace/src
COPY apps/workspace/index.html apps/workspace/index.html
COPY apps/workspace/public apps/workspace/public
COPY apps/workspace/vite.config.ts apps/workspace/vite.config.ts
COPY apps/workspace/tsconfig.json apps/workspace/tsconfig.json
COPY apps/workspace/tsconfig.build.json apps/workspace/tsconfig.build.json

ARG VITE_API_ORIGIN=https://api.nethack.example
ARG VITE_SITE_ORIGIN=https://www.nethack.example
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}
ENV VITE_SITE_ORIGIN=${VITE_SITE_ORIGIN}

RUN bun run --cwd packages/contracts build \
    && bun run --cwd packages/ui build \
    && bun run --cwd apps/workspace build

FROM caddy:2.10.2-alpine AS runtime

COPY --from=build /app/apps/workspace/dist /srv/workspace
COPY deployment/caddy/Caddyfile /etc/caddy/Caddyfile

RUN caddy fmt --overwrite /etc/caddy/Caddyfile \
    && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

EXPOSE 80 443
