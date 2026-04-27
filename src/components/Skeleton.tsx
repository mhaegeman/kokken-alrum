// Lightweight loading skeletons that mirror the shape of each view.
// Shown only on first load, while we fetch from Supabase.

function PageHeaderSk() {
  return (
    <div className="page-header" style={{ marginBottom: 18 }}>
      <div className="sk sk-line" style={{ width: 180, height: 32 }} />
      <div className="sk sk-line" style={{ width: 320, height: 14, marginTop: 10 }} />
    </div>
  );
}

function StatsSk() {
  return (
    <section className="stats" style={{ marginBottom: 22 }}>
      {[0, 1, 2, 3].map((i) => (
        <div className="stat" key={i}>
          <div className="sk sk-line" style={{ width: 80, height: 11 }} />
          <div className="sk sk-line" style={{ width: 110, height: 28, marginTop: 10 }} />
        </div>
      ))}
    </section>
  );
}

export function TasksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading tasks">
      <PageHeaderSk />
      <StatsSk />
      <div className="filters" style={{ marginBottom: 14 }}>
        {[60, 60, 60].map((w, i) => (
          <div key={i} className="sk sk-line" style={{ width: w, height: 28 }} />
        ))}
      </div>
      {[0, 1].map((g) => (
        <div key={g} style={{ marginBottom: 22 }}>
          <div className="sk sk-line" style={{ width: 140, height: 16, margin: '14px 0 10px' }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="task-row-wrap" style={{ marginBottom: 6 }}>
              <div className="task-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sk sk-line" style={{ width: 24, height: 14 }} />
                <div className="sk sk-line" style={{ flex: 1, height: 14 }} />
                <div className="sk sk-line" style={{ width: 60, height: 18 }} />
                <div className="sk sk-line" style={{ width: 60, height: 18 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BudgetSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading budget">
      <PageHeaderSk />
      <StatsSk />
      <div className="budget-table">
        <div className="budget-item header-row">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="sk sk-line" style={{ width: 60, height: 12 }} />
            </div>
          ))}
        </div>
        {[0, 1].map((g) => (
          <div key={g}>
            <div className="budget-group-header">
              <div className="sk sk-line" style={{ width: 120, height: 14 }} />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="budget-item">
                <div className="sk sk-line" style={{ height: 18 }} />
                <div className="sk sk-line" style={{ height: 18 }} />
                <div className="sk sk-line" style={{ height: 18 }} />
                <div className="sk sk-line" style={{ height: 18 }} />
                <div className="sk sk-line" style={{ height: 18 }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading timeline">
      <PageHeaderSk />
      <StatsSk />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[80, 80, 80].map((w, i) => (
          <div key={i} className="sk sk-line" style={{ width: w, height: 28 }} />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
          <div className="sk sk-line" style={{ width: 160, height: 14 }} />
          <div className="sk sk-line" style={{ flex: 1, height: 18, borderRadius: 9 }} />
        </div>
      ))}
    </div>
  );
}

export function NotesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading notes">
      <PageHeaderSk />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
        <div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="sk sk-line" style={{ width: '80%', height: 14 }} />
              <div className="sk sk-line" style={{ width: '50%', height: 11, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div className="sk sk-line" style={{ width: 160, height: 14 }} />
              <div className="sk sk-line" style={{ width: '90%', height: 12, marginTop: 6 }} />
              <div className="sk sk-line" style={{ width: '60%', height: 12, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ContactsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading contacts">
      <PageHeaderSk />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
        <div>
          <div className="sk sk-line" style={{ width: '100%', height: 32, marginBottom: 12 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="sk sk-line" style={{ width: '70%', height: 14 }} />
              <div className="sk sk-line" style={{ width: '40%', height: 11, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div>
          <div className="sk sk-line" style={{ width: 200, height: 28, marginBottom: 18 }} />
          {[60, 80, 70, 90].map((w, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div className="sk sk-line" style={{ width: 80, height: 11 }} />
              <div className="sk sk-line" style={{ width: `${w}%`, height: 14, marginTop: 6 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <section className="hero" style={{ padding: '64px 0 28px' }}>
        <div className="sk sk-line" style={{ width: 220, height: 14 }} />
        <div className="sk sk-line" style={{ width: '70%', height: 56, marginTop: 18 }} />
        <div className="sk sk-line" style={{ width: '60%', height: 18, marginTop: 22 }} />
        <div className="sk sk-line" style={{ width: '50%', height: 18, marginTop: 8 }} />
      </section>

      <section className="home-summary">
        {[0, 1, 2].map((i) => (
          <div className="card" key={i}>
            <div className="sk sk-line" style={{ width: 80, height: 12 }} />
            <div className="sk sk-line" style={{ width: 140, height: 32, marginTop: 12 }} />
            <div className="sk sk-line" style={{ width: 180, height: 14, marginTop: 12 }} />
          </div>
        ))}
      </section>

      <section className="home-cols">
        <div className="home-col">
          <div className="sk sk-line" style={{ width: 120, height: 28, marginBottom: 18 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="next-up-item">
              <div className="sk sk-circle" style={{ width: 8, height: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="sk sk-line" style={{ width: '70%', height: 14 }} />
                <div className="sk sk-line" style={{ width: '40%', height: 11, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
        <div className="home-col">
          <div className="sk sk-line" style={{ width: 160, height: 28, marginBottom: 18 }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="activity-item">
              <div style={{ flex: 1 }}>
                <div className="sk sk-line" style={{ width: '85%', height: 14 }} />
                <div className="sk sk-line" style={{ width: '30%', height: 11, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
