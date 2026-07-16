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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by Server Components and Server Actions |

Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_` or commit `.env.local`.

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

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run type-check` | Run the TypeScript compiler without emitting files |
| `npm test` | Run the calculation and validation test suite |
| `npm run build` | Verify migrations and create a production build |
| `npm run verify:migrations` | Check migration order and required security rules |
| `npm run verify:supabase` | Check the configured live Supabase schema |
| `npm run verify` | Run lint, type-check, tests, migration checks, and build |

For production deployment and release checks, see [production-check.md](production-check.md).

## Limitations

- There is no authentication, ownership, or role-based access control in this MVP.
- Anyone with a group link can view and modify the group.
- Expenses support equal splits only.
- Each group uses a single US-dollar currency format.
- Existing members, expenses, and payments cannot be edited or deleted through the UI.
- Receipt uploads, notifications, recurring expenses, and payment-provider integrations are not included.
- Rate limiting is not yet implemented for public Server Actions.
