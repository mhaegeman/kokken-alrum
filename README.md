# Køkken alrum

A small app Max and Karo use to plan the kitchen / kids-room renovation of our Copenhagen ground-floor apartment. Tasks, timeline, budget, notes — all in one place.

Live site: **https://mhaegeman.github.io/kokken-alrum/**

Shared backend on Supabase (Postgres + Auth + Realtime). Only two accounts — Max and Karo — can log in via magic link.

## Tech

- Vite + React 18 + TypeScript
- Zustand for view state; Supabase-js for DB + auth + realtime
- Deployed as static files to GitHub Pages (GitHub Actions builds on every push to `main`)

## Running locally

Requires Node 20+.

```bash
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
# then open http://localhost:5173/kokken-alrum/
```

## Supabase setup (one-time)

Do this once in the Supabase dashboard for the project:

1. **Run the schema.** Supabase Dashboard → **SQL Editor** → paste the entire contents of `supabase/schema.sql` and run. Creates tables, RLS policies, seed data, the realtime publication, and a private `attachments` storage bucket with its access policies. The script is idempotent — re-running it is safe, so re-run after pulling any schema changes.
2. **Disable email sign-ups.** **Authentication → Providers → Email** → turn **Enable sign-ups** OFF. The only two people who can ever sign in via email are the ones you invite in the next step.
3. **Enable anonymous sign-ins.** **Authentication → Providers** → toggle **Allow anonymous sign-ins** ON. Guest invite links use anonymous Supabase sessions; the schema's RLS policies keep guests strictly read-only on shared data.
4. **Invite the two users.** **Authentication → Users** → **Invite user** → enter `maximehaegeman@gmail.com` and then `karoline.j.geiker@gmail.com`. Each person clicks the email link to set up their account. The schema's trigger fills in their profile (display name + avatar) automatically when the `auth.users` row is created.
5. **Set Site URL.** **Authentication → URL Configuration** → Site URL = `https://mhaegeman.github.io/kokken-alrum/`. Also add it to **Additional redirect URLs** so magic links work.

## Inviting a guest

Max or Karo can share a read-mostly view of the project with a friend, family member or contractor:

1. Click **Invite** in the top bar (visible only to full members).
2. Optionally label the invite ("Mom", "Builder", …) and pick an expiry. Click **Create invite link** — the link is copied to your clipboard.
3. Send that link to the guest. When they open it they pick a display name, get an anonymous Supabase session, and land in the app.

Guests can browse every view and post comments, replies and document uploads (files / links). They cannot edit or delete tasks, budget items, topics or anyone else's content — both the UI and the database RLS policies enforce that. Revoke a link any time from the same **Invite** panel.

## GitHub Pages setup (one-time)

1. In the GitHub repo → **Settings → Pages** → Source = **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions**, add repository secrets:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase **publishable** key (safe to ship in the client; never add the `service_role` one)
3. The workflow at `.github/workflows/deploy.yml` runs `npm ci && npm run build` and publishes `dist/` on every push to `main`.

## Structure

```
.
├── .github/workflows/deploy.yml
├── supabase/
│   └── schema.sql               # Full schema + seed + RLS + realtime publication
├── index.html
├── vite.config.ts
├── tsconfig*.json
├── package.json
└── src/
    ├── main.tsx                 # React entry
    ├── App.tsx                  # Auth gate + routing
    ├── styles.css
    ├── types.ts
    ├── vite-env.d.ts
    ├── state/
    │   └── store.ts             # Zustand store backed by Supabase
    ├── lib/
    │   ├── supabase.ts          # Client factory
    │   ├── auth.ts              # useAuth hook + magic link / sign-out
    │   ├── api.ts               # DB reads/writes + realtime subscription
    │   ├── format.ts            # Money + date helpers
    │   └── schedule.ts          # Dep-based date scheduling
    └── components/
        ├── LoginScreen.tsx
        ├── TopBar.tsx
        ├── Tabs.tsx             # Nav
        ├── Stats.tsx
        ├── Avatar.tsx
        ├── ProgressRing.tsx
        ├── icons/
        │   ├── PalmTree.tsx
        │   └── Rose.tsx
        └── views/
            ├── HomeView.tsx
            ├── TasksView.tsx
            ├── TimelineView.tsx
            ├── BudgetView.tsx
            └── NotesView.tsx    # (placeholder until milestone 5)
        ├── TaskDrawer.tsx        # Slide-from-right detail view for a task
```

## Editing seed data

The canonical seed data for new projects lives in `supabase/schema.sql` (phases, categories, tasks, budget items). Once a project is running, the DB is the source of truth — edit in-app or via the Supabase table editor.
