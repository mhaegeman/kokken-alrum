import { useRef } from 'react';
import { useStore, exportJson, importJson } from '../state/store';
import { Avatar } from './Avatar';
import type { ViewId } from '../types';

export function TopBar({ onHome }: { onHome: (v: ViewId) => void }) {
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
        <button className="brand" onClick={() => onHome('home')}>
          <div className="brand-mark">K</div>
          <div>
            <p className="brand-title">Køkken alrum</p>
            <p className="brand-sub">Copenhagen</p>
          </div>
        </button>

        <div className="topbar-end">
          <div className="avatars" aria-label="Project members">
            <Avatar user="max" title="Max" />
            <Avatar user="karo" title="Karo" />
          </div>

          <div className="menu">
            <button className="icon-btn" onClick={() => exportJson(state)}>
              Export
            </button>
            <button
              className="icon-btn"
              onClick={() => fileInput.current?.click()}
            >
              Import
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={onImport}
            />
            <button className="icon-btn danger" onClick={onReset}>
              Reset
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
