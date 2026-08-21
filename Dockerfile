# syntax=docker/dockerfile:1

# ---- deps: install once with dev deps, reused by the build stage ----
# argon2 has no musl prebuild bundled for every arch and may compile from
# source here; sharp resolves its @img/sharp-linuxmusl-* optional deps here
# too. Both MUST be installed inside this musl (alpine) container, never
# copied in from a host's node_modules.
FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: generate the Prisma client, compile TS, drop dev deps ----
FROM deps AS build
COPY . .
# prisma.config.ts resolves DATABASE_URL eagerly even for `generate`, which
# needs no live DB — just the var present. Real value comes at runtime.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
  npx prisma generate
RUN npm run build
RUN npm prune --omit=dev

# ---- runtime: slim image, prod deps + compiled output only ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apk add --no-cache tini \
  && addgroup -S app && adduser -S app -G app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
