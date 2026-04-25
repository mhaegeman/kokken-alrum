// Lightweight loading skeletons that mirror the shape of the home page.
// Shown only on first load, while we fetch from Supabase.

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
