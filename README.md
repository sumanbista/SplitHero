# SplitHero

SplitHero is a lightweight expense-splitting application for roommates, friends, families, classmates, and travel groups. Create a group, add people and shared expenses, see who owes whom, and record payments as the group settles up.

The MVP does not require accounts. Anyone with a group link can view and update that group, so links should be treated as unlisted rather than private.

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
- Private groups, invitations, and role-based access control are not implemented yet.
- Anyone with a group link can view and modify the group.
- Expenses support equal splits only.
- Each group uses a single US-dollar currency format.
- Existing members, expenses, and payments cannot be edited or deleted through the UI.
- Receipt uploads, notifications, recurring expenses, and payment-provider integrations are not included.
- Rate limiting is not yet implemented for public Server Actions.
