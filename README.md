# Køkken alrum

A small app to plan and track the kitchen renovation of a Copenhagen ground-floor apartment — turning the old kitchen space into a kids bedroom, and building a new kitchen in the living area (*køkken alrum*). Includes a task tracker, Gantt-style timeline, and budget tracker.

Live site: **https://mhaegeman.github.io/kokken-alrum/**

Data is currently stored locally in your browser (`localStorage`). A Supabase backend is being added in a later milestone so the two of us see the same data.

## Features

- **Tasks view** — task list grouped by phase, with status, priority, dependencies, dates, and comments
- **Timeline view** — Gantt-style chart showing estimated durations and dependencies
- **Budget view** — line items grouped by category, with estimated vs. actual costs and a running total
- Export/import JSON to back up or share your state

## Running locally

Requires Node 20+.

```bash
npm install
npm run dev
# then open http://localhost:5173/kokken-alrum/
```

## Deploying to GitHub Pages

Auto-deploys on every push to `main` via `.github/workflows/deploy.yml` — the workflow runs `npm ci && npm run build` and publishes `dist/`. In the repo on GitHub, under **Settings → Pages**, set **Source** to **GitHub Actions** (one-time).

## Structure

```
.
├── .github/workflows/deploy.yml   # GitHub Pages build + deploy
├── index.html                     # Vite entry
├── vite.config.ts
├── tsconfig*.json
├── package.json
└── src/
    ├── main.tsx                   # React entry
    ├── App.tsx                    # App shell: topbar, tabs, stats, view
    ├── types.ts
    ├── styles.css
    ├── state/
    │   ├── initial.ts             # Starter tasks + budget items
    │   └── store.ts               # Zustand store (persisted to localStorage)
    ├── lib/
    │   ├── format.ts              # Money + date helpers
    │   └── schedule.ts            # Dep-based date scheduling
    └── components/
        ├── TopBar.tsx
        ├── Tabs.tsx
        ├── Stats.tsx
        └── views/
            ├── TasksView.tsx
            ├── TimelineView.tsx
            └── BudgetView.tsx
```

## Editing the starter data

The default tasks and budget line items live in `src/state/initial.ts`. Existing users keep their `localStorage` data unless they click **Reset**.
