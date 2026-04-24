# Køkken alrum

A small single-page app to plan and track the kitchen renovation of a Copenhagen ground-floor apartment — turning the old kitchen space into a kids bedroom, and building a new kitchen in the living area (*køkken alrum*). Includes a task tracker, Gantt-style timeline, and budget tracker.

Live site: **https://mhaegeman.github.io/kokken-alrum/**

All data is stored locally in your browser (`localStorage`) — nothing is sent anywhere. Reset the data from the UI at any time.

## Features

- **Tasks view** — task list grouped by phase, with status, priority, dependencies, dates, and comments
- **Timeline view** — Gantt-style chart showing estimated durations and dependencies
- **Budget view** — line items grouped by category, with estimated vs. actual costs and a running total
- Progress, budget, and status stats at a glance
- Data persists in the browser via `localStorage`
- Export/import JSON to back up or share your state

## Running locally

No build step. Just serve the `src/` folder with any static server:

```bash
cd src
python3 -m http.server 8000
# then open http://localhost:8000
```

Or open `src/index.html` directly in a browser.

## Deploying to GitHub Pages

The repo is already wired for Pages via GitHub Actions. On first push:

1. In the repo on GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. The workflow at `.github/workflows/deploy.yml` deploys on every push to `main`.
4. Site goes live at `https://mhaegeman.github.io/kokken-alrum/`.

## Structure

```
.
├── .github/workflows/deploy.yml   # GitHub Pages deploy action
├── src/
│   ├── index.html
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js                 # Main app, view routing, storage
│   │   ├── tasks.js               # Task tracker view
│   │   ├── timeline.js            # Gantt-style timeline view
│   │   └── budget.js              # Budget tracker view
│   └── data/initial.js            # Starter tasks + budget items
└── README.md
```

## Editing the starter data

The default tasks and budget line items live in `src/data/initial.js`. Edit that file to change what new users see on first load. Existing users keep their `localStorage` data unless they click **Reset data**.
