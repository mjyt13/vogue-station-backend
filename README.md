<div align="center">

# Vogue Station — Backend

**The API behind the live 3D garment editor: accounts, uploads, moderation, and the public gallery.**

[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e?logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169e1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748?logo=prisma&logoColor=white)](https://www.prisma.io)

</div>

<br>

## What this is

The API for [Vogue Station](https://github.com/mjyt13/vogue-station-frontend),
a full-stack pet project: a live 3D garment editor backed by real
infrastructure rather than a mocked API. This service owns accounts,
user-submitted content (garment models, colors, patterns, looks), object
storage, and the admin moderation queue that gates what becomes public.

- [**vogue-station-frontend**](https://github.com/mjyt13/vogue-station-frontend) — the React + three.js editor, cabinet, gallery, and admin UI.
- **This repo** — NestJS API, Prisma/Postgres, S3-compatible storage, JWT auth, moderation.

## Features

- **Accounts** — register/login, JWT access token + rotating httpOnly refresh
  cookie, role-based access control (`USER` / `ADMIN`) enforced by guards on
  every route.
- **Garment models, colors, patterns** — CRUD for the three building blocks
  of a look. Uploads (a `.glb` model, a pattern image) are validated
  server-side (magic bytes, size, dimensions) and thumbnailed with `sharp`
  before being marked `confirmed`; unconfirmed assets can't be published or
  used in a look.
  - Global presets (owner-less rows, seeded) sit alongside user-submitted
    assets in the same tables.
- **Looks** — a look composes a model + color (+ optional pattern) into
  something a user can save, reopen, and re-save. `colorHex` is snapshotted
  onto the look so it keeps rendering even if the color is later edited or
  deleted; `patternId`/`garmentModelId` are live references instead
  (deleting a model in use is blocked at the DB level).
- **Publishing + moderation** — every shareable entity (model, color,
  pattern, look) carries the same three-field flow: `publishRequested` (owner
  intent) → `status` (admin verdict: `PENDING`/`APPROVED`/`REJECTED`) →
  `isPublic` (visibility, settable only by an admin approval). A look can
  only be approved once the model and pattern it references are already
  public. See the comment above `ModerationStatus` in
  [prisma/schema.prisma](prisma/schema.prisma) for the full state diagram.
- **Admin endpoints** — `admin/{users,models,colors,patterns,looks}`:
  list-with-filters, approve/reject, promote/demote a user's role, delete a
  user (cascades their content).
- **Object storage** — pluggable driver: `local` filesystem for zero-setup
  dev, or any S3-compatible store (MinIO locally, Cloudflare R2/AWS in
  prod) via presigned URLs, selected by `STORAGE_DRIVER`.
- **OpenAPI spec** — the frontend's typed API client is generated from this
  service's Swagger document (served at `/docs`, emitted to a JSON file by
  `npm run openapi:emit`).

## Tech stack

| Layer      | Choice                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| Core       | NestJS 11, TypeScript                                                        |
| Data       | Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 17                              |
| Auth       | `@nestjs/jwt`, argon2 password hashing, httpOnly rotating refresh cookie     |
| Validation | class-validator / class-transformer, global `ValidationPipe`                |
| Storage    | `@aws-sdk/client-s3` + presigned URLs (S3-compatible) or local filesystem   |
| Images     | `sharp` for thumbnail generation and upload validation                      |
| API docs   | `@nestjs/swagger`, served at `/docs`                                        |
| Rate limit | `@nestjs/throttler` (global guard)                                          |

## Architecture notes

- **Feature modules per entity** — `auth`, `users`, `models`, `colors`,
  `patterns`, `looks`, `storage`, each with its own controller(s), service,
  and DTOs. Admin-only routes live in a separate `admin-*.controller.ts`
  per module rather than branching inside the public controller.
- **Guard order matters**: throttle → authenticate (`AccessTokenGuard`) →
  authorize (`RolesGuard`), wired globally in [src/app.module.ts](src/app.module.ts).
- **The moderation trio lives on four entities, not one shared table** —
  `publishRequested` / `status` / `isPublic` are duplicated fields on
  `GarmentModel`, `Color`, `Pattern`, and `Look` rather than a generic
  polymorphic "moderatable" join, so each entity keeps its own indexes and
  FK constraints simple. Allowed transitions are enforced in the service
  layer, not the DB.
- **Reference vs. snapshot** — a `Look` snapshots `colorHex` (so edits/deletes
  to a `Color` never change a saved look's render) but keeps live foreign
  keys to `GarmentModel`/`Pattern` (so those must stay valid — deleting a
  model that's in use is restricted, deleting a pattern in use nulls the
  reference and the look renders color-only).
- **Body parsing is manual** in [src/main.ts](src/main.ts): `bodyParser: false` on the Nest
  app, then `json`/`urlencoded` are wired by hand and explicitly skipped for
  `/storage/*` so raw upload bytes streamed to that route aren't consumed
  before the storage handler sees them.
- **Storage driver is swappable** without touching callers — `STORAGE_DRIVER=local`
  writes to `STORAGE_LOCAL_ROOT` on disk for zero-setup dev; `s3` points at
  MinIO/R2/AWS via presigned URLs. Same interface either way.

## Getting started

You'll need Postgres and an S3-compatible store (or just use the `local`
storage driver to skip the latter). The frontend
([`vogue-station-frontend`](https://github.com/mjyt13/vogue-station-frontend))
expects this API at `http://localhost:3000`.

```bash
npm install
cp .env.example .env      # fill in secrets — see below

npm run db:up              # Postgres via docker compose (Steam Deck: db:up:deck, podman)
# npm run minio:up:deck     # only if STORAGE_DRIVER=s3 and using podman/MinIO locally

npm run db:migrate         # apply Prisma migrations
npm run db:seed            # admin user + preset colors/patterns/catalog model
npm run storage:bootstrap  # create the bucket (s3 driver) / seed dirs (local) + upload catalog assets

npm run start:dev          # → http://localhost:3000, Swagger UI at /docs
```

### Environment

See [.env.example](.env.example) for the full list with generation hints. The
essentials:

| Variable                | Purpose                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `DATABASE_URL`           | Postgres connection string                                     |
| `JWT_ACCESS_SECRET`      | Signs access tokens (`openssl rand -base64 48`)                |
| `STORAGE_SIGNING_SECRET` | Signs local-driver storage URLs (`openssl rand -base64 48`)    |
| `STORAGE_DRIVER`         | `local` (filesystem, zero setup) or `s3` (MinIO/R2/AWS)         |
| `S3_*`                   | Only required when `STORAGE_DRIVER=s3`                          |
| `CORS_ORIGIN`            | Must match the frontend's origin (default `http://localhost:5173`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Optional — promoted/created by `npm run db:seed`         |

### Scripts

```bash
npm run start:dev      # watch mode
npm run test            # unit tests
npm run test:e2e        # e2e tests
npm run lint             # eslint --fix
npm run db:generate     # regenerate the Prisma client after a schema change
npm run openapi:emit    # write the current OpenAPI spec to docs/openapi.json
```

## API docs

With the server running, interactive Swagger UI is at
[`http://localhost:3000/docs`](http://localhost:3000/docs). A static snapshot
of the spec is checked in at [docs/openapi.json](docs/openapi.json) and is
what the frontend's typed client is generated from.
