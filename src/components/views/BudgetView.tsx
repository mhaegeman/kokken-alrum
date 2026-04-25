import { useState } from 'react';
import { useStore } from '../../state/store';
import { fmtMoney } from '../../lib/format';
import type { BudgetItem } from '../../types';
import { AttachmentList } from '../AttachmentList';
import type { Profile } from '../../lib/auth';

export function BudgetView({
  currentUserId,
  profilesById,
}: {
  currentUserId: string | null;
  profilesById: Record<string, Profile>;
}) {
  const state = useStore((s) => s.state);
  const updateBudgetItem = useStore((s) => s.updateBudgetItem);
  const addBudgetItem = useStore((s) => s.addBudgetItem);
  const deleteBudgetItem = useStore((s) => s.deleteBudgetItem);
  const setBudgetTarget = useStore((s) => s.setBudgetTarget);
  const uploadBudgetAttachment = useStore((s) => s.uploadBudgetAttachment);
  const addBudgetLink = useStore((s) => s.addBudgetLink);
  const deleteBudgetAttachment = useStore((s) => s.deleteBudgetAttachment);

  const [openItemId, setOpenItemId] = useState<number | null>(null);

  const cur = state.currency || 'DKK';
  const cats = state.budgetCategories;

  const estTotal = state.budgetItems.reduce((s, i) => s + (+i.estimate || 0), 0);
  const actTotal = state.budgetItems.reduce((s, i) => s + (+i.actual || 0), 0);
  const target = +state.totalBudgetTarget || 0;

  const byCategory: Record<string, BudgetItem[]> = {};
  Object.keys(cats).forEach((k) => (byCategory[k] = []));
  state.budgetItems.forEach((item) => {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  });

  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState(Object.keys(cats)[0] ?? '');
  const [newEst, setNewEst] = useState<number | ''>('');

  const onAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addBudgetItem({
      category: newCat,
      name,
      estimate: Number(newEst) || 0,
      actual: 0,
      attachments: [],
    });
    setNewName('');
    setNewEst('');
  };

  return (
    <>
      <div className="budget-summary">
        <div className="stat">
          <p className="stat-label">Total estimated</p>
          <p className="stat-value">{fmtMoney(estTotal, cur)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Total spent</p>
          <p className="stat-value">{fmtMoney(actTotal, cur)}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Remaining (est)</p>
          <p
            className="stat-value"
            style={{
              color: estTotal - actTotal < 0 ? 'var(--danger-fg)' : 'var(--text)',
            }}
          >
            {fmtMoney(estTotal - actTotal, cur)}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Budget target</p>
          <p
            className="stat-value"
            contentEditable
            suppressContentEditableWarning
            style={{ outline: 'none' }}
            onBlur={(e) => {
              const v = parseInt(
                (e.target.textContent || '').replace(/\D/g, ''),
                10,
              ) || 0;
              setBudgetTarget(v);
            }}
          >
            {target}
          </p>
          <p className="stat-sub">click to edit</p>
        </div>
      </div>

      {target > 0 && (
        <div className="budget-bar-wrap">
          <BudgetBar
            label="Estimated vs target"
            value={estTotal}
            target={target}
            cur={cur}
            markOver
          />
          <div style={{ height: 10 }} />
          <BudgetBar
            label="Spent vs target"
            value={actTotal}
            target={target}
            cur={cur}
          />
        </div>
      )}

      <div className="budget-table">
        <div className="budget-item header-row">
          <div>Item</div>
          <div>Category</div>
          <div className="num">Estimate</div>
          <div className="num">Actual</div>
          <div></div>
        </div>

        {Object.entries(byCategory).map(([catKey, items]) => {
          if (items.length === 0) return null;
          const groupEst = items.reduce((s, i) => s + (+i.estimate || 0), 0);
          const groupAct = items.reduce((s, i) => s + (+i.actual || 0), 0);
          return (
            <div key={catKey}>
              <div className="budget-group-header">
                <span>{cats[catKey] || catKey}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-2)',
                    textTransform: 'none',
                    letterSpacing: 0,
                  }}
                >
                  {fmtMoney(groupEst, cur)} est · {fmtMoney(groupAct, cur)} spent
                </span>
              </div>
              {items.map((item) => {
                const isOpen = openItemId === item.id;
                const attachCount = item.attachments?.length ?? 0;
                return (
                  <div key={item.id}>
                    <div className="budget-item">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateBudgetItem(item.id, { name: e.target.value })
                        }
                      />
                      <select
                        value={item.category}
                        onChange={(e) =>
                          updateBudgetItem(item.id, { category: e.target.value })
                        }
                      >
                        {Object.entries(cats).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="num"
                        value={item.estimate || 0}
                        onChange={(e) =>
                          updateBudgetItem(item.id, {
                            estimate: +e.target.value || 0,
                          })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        step={100}
                        className="num"
                        value={item.actual || 0}
                        onChange={(e) =>
                          updateBudgetItem(item.id, { actual: +e.target.value || 0 })
                        }
                      />
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className={`paperclip-btn ${attachCount > 0 ? 'has-attach' : ''}`}
                          title={
                            attachCount === 0
                              ? 'Attach receipt or link'
                              : `${attachCount} attached`
                          }
                          onClick={() => setOpenItemId(isOpen ? null : item.id)}
                        >
                          📎{attachCount > 0 ? ` ${attachCount}` : ''}
                        </button>
                        <button
                          className="del-btn"
                          title="Delete item"
                          onClick={() => {
                            if (confirm(`Delete "${item.name}"?`)) {
                              deleteBudgetItem(item.id);
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="budget-attachments">
                        <AttachmentList
                          attachments={item.attachments ?? []}
                          canEdit={!!currentUserId}
                          currentUserId={currentUserId}
                          uploaderName={(id) =>
                            id ? profilesById[id]?.display_name : undefined
                          }
                          onUploadFile={(file) =>
                            currentUserId
                              ? uploadBudgetAttachment(item.id, file, currentUserId)
                              : undefined
                          }
                          onAddLink={(url, label) =>
                            currentUserId
                              ? addBudgetLink(item.id, url, label, currentUserId)
                              : undefined
                          }
                          onDelete={(a) => deleteBudgetAttachment(item.id, a)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="add-item-row">
          <input
            type="text"
            placeholder="New item name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 2 }}
          />
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)}>
            {Object.entries(cats).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Estimate"
            min={0}
            step={100}
            value={newEst}
            onChange={(e) =>
              setNewEst(e.target.value === '' ? '' : +e.target.value)
            }
            style={{ width: 100 }}
          />
          <button className="btn-primary" onClick={onAdd}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}

function BudgetBar({
  label,
  value,
  target,
  cur,
  markOver,
}: {
  label: string;
  value: number;
  target: number;
  cur: string;
  markOver?: boolean;
}) {
  const pct = Math.min(100, (value / target) * 100);
  const over = markOver && value > target;
  return (
    <>
      <div className="budget-bar-label">
        <span>{label}</span>
        <span>
          {fmtMoney(value, cur)} / {fmtMoney(target, cur)}
          {over && <span style={{ color: 'var(--danger-fg)' }}> (over)</span>}
        </span>
      </div>
      <div className="budget-bar-track">
        <div
          className={`budget-bar-fill ${over ? 'over' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );
}
