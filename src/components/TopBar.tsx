import { useRef } from 'react';
import { useStore, exportJson, importJson } from '../state/store';

export function TopBar() {
  const state = useStore((s) => s.state);
  const reset = useStore((s) => s.reset);
  const replaceState = useStore((s) => s.replaceState);
  const fileInput = useRef<HTMLInputElement>(null);

  const onReset = () => {
    if (confirm('Reset all data to defaults? This cannot be undone.')) reset();
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importJson(file);
      replaceState(data);
    } catch (err) {
      alert('Failed to import: ' + (err as Error).message);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <header className="topbar">
      <div className="container">
        <div className="brand">
          <div className="logo">KA</div>
          <div>
            <h1>Køkken alrum</h1>
            <p className="subtitle">Copenhagen renovation tracker</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn-ghost" onClick={() => exportJson(state)}>
            Export
          </button>
          <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={onImport}
          />
          <button className="btn-ghost danger" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
