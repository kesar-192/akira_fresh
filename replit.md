# AdPilot

A multi-brand workspace for agencies to create interactive social ads, manage client brands, schedule campaigns, and track engagement.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/adpilot run dev` — run the AdPilot web app
- `pnpm --filter @workspace/api-server run seed` — seed the development database with demo brands, ads, leads, accounts, and activity
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Replit provides `DATABASE_URL`; Clerk keys are provisioned through Replit Auth setup

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React + Vite, Wouter, Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/adpilot/src/` — application UI and interactive ad experiences
- `artifacts/api-server/src/routes/adpilot.ts` — AdPilot API routes
- `lib/api-spec/openapi.yaml` — API contract and route documentation source
- `lib/db/src/schema/` — PostgreSQL schema, one module per data model
- `artifacts/api-server/src/seed.ts` — idempotent demo-data seeder

## Architecture decisions

- Use the shared React/Vite + Express/Drizzle workspace and generated OpenAPI client rather than maintaining a separate Next.js API stack.
- Clerk manages sign-in; the first account becomes agency admin, and later members receive roles from invitations or start with no brand access.
- Social connections use a mock adapter surface; no platform credentials or real publishing API calls are made.
- Public ad events are stored as view, interaction, click, completion, and lead-submission events; analytics are derived from those events.

## Product

AdPilot includes agency and brand workspaces, an image-led interactive ad builder, shareable public ad pages, social-account mock connections, scheduled posts, leads, analytics, and team role assignment.

## User preferences

- Interactive campaign imagery and animation are central to the ad experience, not limited to dashboard decoration.

## Gotchas

- Edit the OpenAPI contract before changing API schemas; rerun codegen before consuming updated client or validator types.
- Public ad routes are intentionally available without a signed-in session. Workspace routes require Clerk authentication.
- Seed data is development-only and the script skips when the three demo brands already exist.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
