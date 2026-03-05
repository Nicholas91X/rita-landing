# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rita Landing is an Italian-language fitness platform for a personal trainer (Rita Zanicchi). It's a Next.js 15 app with a public landing page, user dashboard for purchased workout video content, Stripe payments, and an admin panel for content/user management.

## Commands

- **Dev server:** `npm run dev` (uses Turbopack)
- **Build:** `npm run build` (uses Turbopack)
- **Start production:** `npm run start`
- **Lint:** `npm run lint` (ESLint with next/core-web-vitals + next/typescript)

## Tech Stack

- **Framework:** Next.js 15.5 with App Router, React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`), CSS custom properties for theming in `globals.css`
- **UI Components:** shadcn/ui (new-york style, `@/components/ui/`), Radix primitives, Lucide icons
- **Auth & DB:** Supabase (auth + Postgres). Three client patterns:
  - `@/utils/supabase/client.ts` — browser client
  - `@/utils/supabase/server.ts` — server client (cookies-based) + `createServiceRoleClient()`
  - `@/utils/supabase/middleware.ts` — session refresh, route protection, maintenance mode
- **Payments:** Stripe (checkout sessions, subscriptions, webhooks at `/api/webhooks/stripe`)
- **Video hosting:** Bunny Stream (upload, proxy via `/api/admin/bunny-proxy/`)
- **PWA:** `@ducanh2912/next-pwa` (disabled in dev)
- **Fonts:** Plus Jakarta Sans (body), Caveat (handwritten accents) via `next/font`
- **Toast notifications:** Sonner

## Architecture

### Path alias
`@/*` maps to `./src/*`

### Route structure
- `/` — Public landing page (sections: Hero, Metodo, PerChi, Storia, Faq, Contact)
- `/login` — Client-side auth (login/signup/forgot-password/forgot-email)
- `/auth/callback` — Supabase OAuth callback
- `/auth/reset-password` — Password reset form
- `/dashboard` — User dashboard (protected, redirects admins to `/admin`)
- `/dashboard/package/[id]` — Package detail / video player
- `/admin` — Admin panel (protected, checks `admins` table)
- `/pacchetti` — Packages listing
- `/maintenance` — Maintenance mode page

### Server Actions (`src/app/actions/`)
All business logic uses Next.js Server Actions (`'use server'`):
- `stripe.ts` — Checkout session creation, refunds
- `content.ts` — Content hierarchy (levels → courses → packages)
- `user.ts` — Profile management, password recovery, sign out
- `video.ts` — Video upload to Bunny Stream
- `admin_actions/` — Admin-only: packages, sales stats, user management, video management

### Middleware (`src/middleware.ts`)
Runs on all non-static routes. Handles: Supabase session refresh, maintenance mode redirect, auth protection for `/dashboard` and `/admin`, admin role check via `admins` table.

### Data model
Content is hierarchical: **Levels → Courses → Packages**. Users purchase packages (one-time or subscription via Stripe). Admin role is determined by presence in the `admins` Supabase table.

## Environment Variables

Public (client-safe):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (defaults to `https://fitandsmile.it`)
- `NEXT_PUBLIC_MAINTENANCE_MODE` (`'true'` to enable)
- `NEXT_PUBLIC_BUNNY_CDN_HOSTNAME`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LOYALTY_COUPON_ID`
- `BUNNY_LIBRARY_ID`, `BUNNY_LIBRARY_API_KEY`, `BUNNY_STREAM_API_KEY`

## Theme

CSS custom properties defined in `src/app/globals.css`:
- Brand orange: `--brand: #F46530` / `--primary: #F46530`
- Navy: `--secondary: #001F3D` / `--navy: #001F3D`
- Accent yellow: `--accent: #FBB80F`
- Use semantic variables (`--bg`, `--text`, `--brand`, `--panel`) rather than raw colors.

## Conventions

- All UI text is in Italian.
- Dashboard components are co-located in `src/app/dashboard/` and `src/app/admin/` (not in `src/components/`).
- Landing page sections live in `src/components/sections/`.
- shadcn/ui components go in `src/components/ui/` — add new ones via `npx shadcn@latest add <component>`.
- Server Actions body size limit is 10MB (for video uploads).
