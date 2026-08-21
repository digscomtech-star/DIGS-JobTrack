# DIGS JobTrack

A mobile-first field installation operations app for receiving, organizing, contacting, scheduling, completing, and reporting MTN ODU jobs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/digs-jobtrack/src/` — responsive JobTrack web interface and route screens
- `artifacts/api-server/src/routes/jobs.ts` — jobs, contacts, dashboard, settings, and reports API
- `lib/db/src/schema/jobs.ts` — persistent PostgreSQL schema for jobs, contacts, and settings
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- Phase 1 deliberately uses a persistent PostgreSQL data layer while leaving GPS, maps, route optimization, and automation out of the product surface.
- Native call, SMS, and WhatsApp actions stay device-level; contact history records the action/result without claiming cellular answer detection.
- Calendar-only job dates are stored as PostgreSQL `date` values to avoid timezone shifts.

## Product

Users can manage the full Phase 1 installation workflow: import and create jobs, search/filter the register, contact customers, schedule or postpone work, record completion and expenses, review reports, and configure message templates.

## User preferences

- Build only Phase 1 until the user explicitly requests a later phase.

## Gotchas

- Regenerate API clients with `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
