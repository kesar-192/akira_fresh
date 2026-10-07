# AdPilot

AdPilot is an agency workspace for managing multiple client brands, building interactive social ads, scheduling campaigns, and reviewing engagement.

## Included

- Clerk-powered sign-up and sign-in with role-aware API access.
- Brand and team management, social account mock connections, and seed data.
- Interactive ad types: poll, quiz, spin-the-wheel, carousel, lead form, and swipe cards.
- Draft/publish lifecycle, public share links, event tracking, and an embeddable ad experience.
- Scheduling calendar, lead search and CSV export, dashboard KPIs, and analytics.

## Run in Replit

The project uses the workspace's managed web and API workflows. The development database is provided through `DATABASE_URL`; Clerk keys are provisioned by Replit.

To prepare demo content or update the schema:

```sh
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run seed
```

To check the project:

```sh
pnpm run typecheck
```

For local setup, start the API and web workflows separately:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/adpilot run dev
```

Do not put real credentials in `.env.example` or commit a populated `.env` file.

## API routes

The OpenAPI contract at `../../lib/api-spec/openapi.yaml` is the source of truth. It also generates the client hooks and request/response validators.

| Area | Routes |
| --- | --- |
| Health | `GET /api/healthz` |
| Brands | `GET/POST /api/brands`, `PATCH/DELETE /api/brands/{brandId}` |
| Team | `GET/POST /api/team-members`, `PATCH/DELETE /api/team-members/{memberId}` |
| Social accounts | `GET/POST /api/brands/{brandId}/social-accounts`, `DELETE /api/social-accounts/{accountId}` |
| Ads | `GET/POST /api/ads`, `GET/PATCH/DELETE /api/ads/{adId}` |
| Public ads | `GET /api/public/ads/{slug}`, `POST /api/public/ads/{slug}/events`, `POST /api/public/ads/{slug}/leads` |
| Scheduling | `GET/POST /api/scheduled-posts`, `PATCH/DELETE /api/scheduled-posts/{postId}` |
| Leads | `GET /api/leads` (search and pagination) |
| Insights | `GET /api/dashboard`, `GET /api/analytics`, `GET /api/activities` |

Public ad routes do not require an account. Workspace routes require an authenticated Clerk session; role and brand access are checked by the API.

## Embedding an ad

Every published ad lives at `/ad/{slug}`. Add `?embed=1` to hide the AdPilot header and footer and use it inside any page:

```html
<iframe src="https://YOUR-DOMAIN/ad/your-ad-slug?embed=1" width="420" height="720" style="border:0;border-radius:16px" loading="lazy" title="Interactive ad"></iframe>
```

Public ads record `view`, `interaction`, `click` (lead-form CTA), `completion` (poll/quiz choice, wheel spin) and `lead_submit` events. Poll and quiz choices come from the ad's saved choices.

The API server also runs a 30-second publishing simulation that flips due `scheduled` posts to `published`.

## Data and extension points

PostgreSQL tables are defined in `lib/db/src/schema/`. `artifacts/api-server/src/seed.ts` seeds three example brands, six example ads, mock social accounts, scheduled posts, leads, and activity. The social-account flow is intentionally an adapter-style mock: replace its generated follower counts and local connect/disconnect behavior with provider OAuth and API adapters when real publishing access is available.

The current app follows the workspace's React + Vite, Express, Drizzle, and Replit-managed deployment conventions. It does not use the originally suggested Next.js/NextAuth/Prisma/Vercel stack.
