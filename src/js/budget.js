// ─── budget.js ──────────────────────────────────────────────────
// Budget tracker. Line items grouped by category. Estimate + actual
// per row, totals per group and overall, plus a target-vs-actual bar.

window.Views = window.Views || {};

window.Views.budget = function(root, app) {
  const cur = app.state.currency || 'DKK';
  const cats = app.state.budgetCategories;

  function render() {
    root.innerHTML = '';

    // ─── summary ─────────────────────────────────────────
    const estTotal = app.state.budgetItems.reduce((s, i) => s + (+i.estimate || 0), 0);
    const actTotal = app.state.budgetItems.reduce((s, i) => s + (+i.actual || 0), 0);
    const target = +app.state.totalBudgetTarget || 0;

    const summary = document.createElement('div');
    summary.className = 'budget-summary';
    summary.innerHTML = `
      <div class="stat">
        <p class="stat-label">Total estimated</p>
        <p class="stat-value">${fmtMoney(estTotal, cur)}</p>
      </div>
      <div class="stat">
        <p class="stat-label">Total spent</p>
        <p class="stat-value">${fmtMoney(actTotal, cur)}</p>
      </div>
      <div class="stat">
        <p class="stat-label">Remaining (est)</p>
        <p class="stat-value" style="color: ${(estTotal - actTotal) < 0 ? 'var(--danger-fg)' : 'var(--text)'}">
          ${fmtMoney(estTotal - actTotal, cur)}
        </p>
      </div>
      <div class="stat">
        <p class="stat-label">Budget target</p>
        <p class="stat-value" contenteditable="true" id="target-edit" style="outline: none;">${target}</p>
        <p class="stat-sub">click to edit</p>
      </div>
    `;
    root.appendChild(summary);

    summary.querySelector('#target-edit').addEventListener('blur', (e) => {
      const v = parseInt(e.target.textContent.replace(/\D/g, ''), 10) || 0;
      app.state.totalBudgetTarget = v;
      app.save();
      render();
    });

    // ─── target bar ──────────────────────────────────────
    if (target > 0) {
      const barWrap = document.createElement('div');
      barWrap.className = 'budget-bar-wrap';
      const estPct = Math.min(100, (estTotal / target) * 100);
      const actPct = Math.min(100, (actTotal / target) * 100);
      const over = estTotal > target;
      barWrap.innerHTML = `
        <div class="budget-bar-label">
          <span>Estimated vs target</span>
          <span>${fmtMoney(estTotal, cur)} / ${fmtMoney(target, cur)}
            ${over ? '<span style="color: var(--danger-fg)"> (over)</span>' : ''}
          </span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${over ? 'over' : ''}" style="width: ${estPct}%"></div>
        </div>
        <div class="budget-bar-label" style="margin-top: 10px;">
          <span>Spent vs target</span>
          <span>${fmtMoney(actTotal, cur)} / ${fmtMoney(target, cur)}</span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill" style="width: ${actPct}%"></div>
        </div>
      `;
      root.appendChild(barWrap);
    }

    // ─── grouped line items ──────────────────────────────
    const table = document.createElement('div');
    table.className = 'budget-table';

    // header row
    const headerRow = document.createElement('div');
    headerRow.className = 'budget-item header-row';
    headerRow.innerHTML = `
      <div>Item</div>
      <div>Category</div>
      <div class="num">Estimate</div>
      <div class="num">Actual</div>
      <div></div>
    `;
    table.appendChild(headerRow);

    // group by category in declared order
    const byCategory = {};
    Object.keys(cats).forEach(k => byCategory[k] = []);
    app.state.budgetItems.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });

    Object.entries(byCategory).forEach(([catKey, items]) => {
      if (items.length === 0) return;
      const groupEst = items.reduce((s, i) => s + (+i.estimate || 0), 0);
      const groupAct = items.reduce((s, i) => s + (+i.actual || 0), 0);

      const gh = document.createElement('div');
      gh.className = 'budget-group-header';
      gh.innerHTML = `
        <span>${escapeHtml(cats[catKey] || catKey)}</span>
        <span style="font-size: 12px; color: var(--text-2); text-transform: none; letter-spacing: 0;">
          ${fmtMoney(groupEst, cur)} est · ${fmtMoney(groupAct, cur)} spent
        </span>
      `;
      table.appendChild(gh);

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'budget-item';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = item.name;
        nameInput.addEventListener('change', () => { item.name = nameInput.value; app.save(); app.renderStats(); });

        const catSelect = document.createElement('select');
        catSelect.innerHTML = Object.entries(cats).map(([k, v]) =>
          `<option value="${k}" ${item.category === k ? 'selected' : ''}>${escapeHtml(v)}</option>`
        ).join('');
        catSelect.addEventListener('change', () => { item.category = catSelect.value; app.save(); render(); });

        const estInput = document.createElement('input');
        estInput.type = 'number'; estInput.min = 0; estInput.step = 100;
        estInput.value = item.estimate || 0;
        estInput.className = 'num';
        estInput.addEventListener('change', () => { item.estimate = +estInput.value; app.save(); render(); app.renderStats(); });

        const actInput = document.createElement('input');
        actInput.type = 'number'; actInput.min = 0; actInput.step = 100;
        actInput.value = item.actual || 0;
        actInput.className = 'num';
        actInput.addEventListener('change', () => { item.actual = +actInput.value; app.save(); render(); app.renderStats(); });

        const delBtn = document.createElement('button');
        delBtn.className = 'del-btn';
        delBtn.textContent = '✕';
        delBtn.title = 'Delete item';
        delBtn.addEventListener('click', () => {
          if (!confirm(`Delete "${item.name}"?`)) return;
          app.state.budgetItems = app.state.budgetItems.filter(i => i.id !== item.id);
          app.save(); render(); app.renderStats();
        });

        row.appendChild(nameInput);
        row.appendChild(catSelect);
        row.appendChild(estInput);
        row.appendChild(actInput);
        row.appendChild(delBtn);
        table.appendChild(row);
      });
    });

    // ─── add new item ────────────────────────────────────
    const addRow = document.createElement('div');
    addRow.className = 'add-item-row';
    addRow.innerHTML = `
      <input type="text" id="new-name" placeholder="New item name…" style="flex: 2;">
      <select id="new-cat">
        ${Object.entries(cats).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}
      </select>
      <input type="number" id="new-est" placeholder="Estimate" min="0" step="100" style="width: 100px;">
      <button class="btn-primary" id="new-add">Add</button>
    `;
    table.appendChild(addRow);

    addRow.querySelector('#new-add').addEventListener('click', () => {
      const name = addRow.querySelector('#new-name').value.trim();
      const category = addRow.querySelector('#new-cat').value;
      const estimate = +addRow.querySelector('#new-est').value || 0;
      if (!name) return;
      const nextId = Math.max(0, ...app.state.budgetItems.map(i => i.id)) + 1;
      app.state.budgetItems.push({ id: nextId, category, name, estimate, actual: 0 });
      app.save(); render(); app.renderStats();
    });

    root.appendChild(table);
  }

  render();
};
