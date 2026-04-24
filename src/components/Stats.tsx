import { useStore } from '../state/store';
import { fmtMoney } from '../lib/format';

export function Stats() {
  const state = useStore((s) => s.state);
  const tasks = state.tasks;
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const estTotal = state.budgetItems.reduce((s, i) => s + (+i.estimate || 0), 0);
  const actTotal = state.budgetItems.reduce((s, i) => s + (+i.actual || 0), 0);
  const cur = state.currency || 'DKK';

  return (
    <section className="stats">
      <div className="stat">
        <p className="stat-label">Progress</p>
        <p className="stat-value">{pct}%</p>
        <p className="stat-sub">
          {done} of {total} done
        </p>
      </div>
      <div className="stat">
        <p className="stat-label">In progress</p>
        <p className="stat-value">{inProgress}</p>
        <p className="stat-sub">{blocked} blocked</p>
      </div>
      <div className="stat">
        <p className="stat-label">Estimated</p>
        <p className="stat-value">{fmtMoney(estTotal, cur)}</p>
        <p className="stat-sub">total budget</p>
      </div>
      <div className="stat">
        <p className="stat-label">Spent</p>
        <p className="stat-value">{fmtMoney(actTotal, cur)}</p>
        <p className="stat-sub">
          {estTotal ? Math.round((actTotal / estTotal) * 100) : 0}% of estimate
        </p>
      </div>
    </section>
  );
}
