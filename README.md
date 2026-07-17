# SplitHero

SplitHero is a lightweight expense-splitting application for roommates, friends, families, classmates, and travel groups. Create a group, add people and shared expenses, see who owes whom, and record payments as the group settles up.

Accounts remain optional. Public groups use permanent unlisted share-link access,
while private groups require an authenticated owner, member, or viewer role.

## Features

- Create an expense-sharing group with a unique shareable link
- Add members without requiring email addresses or accounts
- Record expenses with a payer, participants, date, and optional notes
- Split expenses equally with deterministic remainder-cent handling
- Calculate each member’s current balance using integer cents
- Generate simplified payment recommendations
- Record settlement payments and update balances immediately
- View expense and settlement-payment history
- Responsive dashboard with loading, empty, error, and invalid-link states
- Optional email/password accounts with persistent Supabase Auth sessions
- Account-owned groups created while signed in and listed on the dashboard
- Secure invitations with expiring, single-lifecycle tokens and replay-safe acceptance
- Private groups with server-enforced owner, member, and viewer permissions
- Database-backed rate limits and minimal security audit events for sensitive actions

## Tech stack

- **Framework:** Next.js 16 App Router
- **UI:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, and Base UI
- **Validation:** Zod
- **Backend:** Next.js Server Components and Server Actions
- **Database:** Supabase PostgreSQL
- **Database access:** Supabase JavaScript and SSR clients
- **Testing:** Node.js test runner
- **Hosting:** Vercel with Supabase as the production database

## Installation and setup

### Requirements

- Node.js 20.9 or newer
- npm
- A Supabase project
- Supabase CLI, or access to the Supabase SQL Editor

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure the environment

Copy the example file and replace every placeholder with values from your Supabase project:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | Application origin used for authentication email callbacks |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by Server Components and Server Actions |

Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_` or commit `.env.local`.
`NEXT_PUBLIC_SITE_URL` must be the exact HTTPS production origin in production;
public-prefixed variables are embedded in browser bundles at build time.

In Supabase Authentication URL settings, set the Site URL to the deployed
application origin and allow `<application-origin>/auth/callback` as a redirect
URL. Keep localhost in the allow list for local account confirmation.

### 3. Apply the database migrations

Apply every SQL file in `supabase/migrations` in filename order. With a linked Supabase CLI project:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

The migrations can also be applied individually through the Supabase SQL Editor.

### 4. Verify and run the application

```bash
npm run verify:supabase
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Limitations

- Accounts are optional; groups created while signed in are connected to their
  owner, while guest-created groups remain unowned.
- Public groups intentionally allow anyone with the unpredictable share link to
  view and modify the group. Treat those URLs as secrets; use private mode when
  account membership must be required.
- Anonymous group claiming (Spec 015) is intentionally not implemented. Guest
  groups remain unowned and cannot be claimed through the normal share URL.
- Expenses support equal splits only.
- Each group uses a single US-dollar currency format.
- Existing members, expenses, and payments cannot be edited or deleted through the UI.
- Receipt uploads, notifications, recurring expenses, and payment-provider integrations are not included.

## Production deployment

1. Use separate Supabase projects for production and non-production data.
2. Apply every migration in `supabase/migrations` in filename order, including
   `08_add_security_hardening.sql`, before deploying the matching application.
3. In Supabase Auth, set the Site URL to the deployed HTTPS origin and allow
   only the required `/auth/callback` origins (plus intentional local development).
4. Configure all four variables from the environment table above in the hosting
   provider. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and sensitive.
5. Run `npm run check:production`. This runs lint, type-checking, all tests, the
   production build, strict environment validation, and a live Supabase schema
   check.
6. Verify both a public share-link group in a signed-out browser and a private
   group as owner, member, viewer, and unrelated user. Exercise invitation
   acceptance once and confirm a replay creates no duplicate membership.

The service-role key is confined to `server-only` modules. Browser roles have
RLS-filtered reads and self-profile updates but no direct application-table
mutation grants; all product mutations pass through validated, authorized,
rate-limited Server Actions. Audit events intentionally exclude invitation
tokens, email addresses, raw IP addresses, and secrets.
