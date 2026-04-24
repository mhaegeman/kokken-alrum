// ─── app.js ─────────────────────────────────────────────────────
// Main app: state, localStorage, view routing, top stats bar.

const STORAGE_KEY = 'kokken_alrum_state_v1';

// App state — starts from INITIAL_DATA, overwritten by localStorage on load.
const App = {
  state: null,
  currentView: 'tasks',

  init() {
    this.load();
    this.bindTopbar();
    this.bindTabs();
    this.renderCurrent();
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        // forward-compat: merge in any new phases/categories
        this.state.phases = { ...window.INITIAL_DATA.phases, ...(this.state.phases || {}) };
        this.state.budgetCategories = { ...window.INITIAL_DATA.budgetCategories, ...(this.state.budgetCategories || {}) };
        if (!this.state.currency) this.state.currency = window.INITIAL_DATA.currency;
        if (!this.state.startDate) this.state.startDate = window.INITIAL_DATA.startDate;
        if (!this.state.totalBudgetTarget) this.state.totalBudgetTarget = window.INITIAL_DATA.totalBudgetTarget;
        return;
      }
    } catch (e) {
      console.warn('Failed to load from localStorage, resetting.', e);
    }
    this.state = structuredClone(window.INITIAL_DATA);
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  },

  reset() {
    if (!confirm('Reset all data to defaults? This cannot be undone.')) return;
    this.state = structuredClone(window.INITIAL_DATA);
    this.save();
    this.renderCurrent();
  },

  // ─── export / import ─────────────────────────────────────
  exportJson() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kokken-alrum-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importJson(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.tasks || !data.budgetItems) {
        alert('Invalid file — missing tasks or budgetItems.');
        return;
      }
      this.state = data;
      this.save();
      this.renderCurrent();
    } catch (e) {
      alert('Failed to import: ' + e.message);
    }
  },

  // ─── top bar & tab wiring ────────────────────────────────
  bindTopbar() {
    document.getElementById('reset-btn').addEventListener('click', () => this.reset());
    document.getElementById('export-btn').addEventListener('click', () => this.exportJson());
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-file');
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      if (e.target.files[0]) this.importJson(e.target.files[0]);
      e.target.value = '';
    });
  },

  bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.dataset.view;
        this.renderCurrent();
      });
    });
  },

  // ─── stats & view rendering ──────────────────────────────
  renderStats() {
    const host = document.getElementById('stats');
    const tasks = this.state.tasks;
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const estTotal = this.state.budgetItems.reduce((s, i) => s + (+i.estimate || 0), 0);
    const actTotal = this.state.budgetItems.reduce((s, i) => s + (+i.actual || 0), 0);
    const cur = this.state.currency || 'DKK';

    host.innerHTML = `
      <div class="stat">
        <p class="stat-label">Progress</p>
        <p class="stat-value">${pct}%</p>
        <p class="stat-sub">${done} of ${total} done</p>
      </div>
      <div class="stat">
        <p class="stat-label">In progress</p>
        <p class="stat-value">${inProgress}</p>
        <p class="stat-sub">${blocked} blocked</p>
      </div>
      <div class="stat">
        <p class="stat-label">Estimated</p>
        <p class="stat-value">${fmtMoney(estTotal, cur)}</p>
        <p class="stat-sub">total budget</p>
      </div>
      <div class="stat">
        <p class="stat-label">Spent</p>
        <p class="stat-value">${fmtMoney(actTotal, cur)}</p>
        <p class="stat-sub">${estTotal ? Math.round((actTotal / estTotal) * 100) : 0}% of estimate</p>
      </div>
    `;
  },

  renderCurrent() {
    this.renderStats();
    const root = document.getElementById('view-root');
    root.innerHTML = '';
    if (this.currentView === 'tasks')    Views.tasks(root, this);
    if (this.currentView === 'timeline') Views.timeline(root, this);
    if (this.currentView === 'budget')   Views.budget(root, this);
  }
};

// ─── shared helpers ─────────────────────────────────────────────
function fmtMoney(n, cur) {
  return new Intl.NumberFormat('da-DK', {
    style: 'currency', currency: cur || 'DKK', maximumFractionDigits: 0
  }).format(n || 0);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

// Compute scheduled dates for all tasks based on startDate + durations + deps.
// Each task starts after the latest end of its dependencies.
function computeSchedule(state) {
  const tasksById = Object.fromEntries(state.tasks.map(t => [t.id, t]));
  const computed = {};

  function endOf(id) {
    if (computed[id]) return computed[id];
    const t = tasksById[id];
    let startAnchor = state.startDate;
    if (t.deps && t.deps.length) {
      const depEnds = t.deps.map(d => endOf(d).end);
      depEnds.sort();
      startAnchor = depEnds[depEnds.length - 1];
    }
    const start = t.start || startAnchor;
    const end = t.end || addDays(start, Math.max(1, t.duration || 1));
    computed[id] = { start, end };
    return computed[id];
  }

  state.tasks.forEach(t => endOf(t.id));
  return computed;
}

window.App = App;
window.fmtMoney = fmtMoney;
window.escapeHtml = escapeHtml;
window.addDays = addDays;
window.diffDays = diffDays;
window.computeSchedule = computeSchedule;

document.addEventListener('DOMContentLoaded', () => App.init());
