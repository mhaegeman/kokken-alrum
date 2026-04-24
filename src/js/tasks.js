// ─── tasks.js ───────────────────────────────────────────────────
// Task tracker view. Grouped by phase, expandable rows, comments.

window.Views = window.Views || {};

window.Views.tasks = function(root, app) {
  const openIds = window.Views._openIds = window.Views._openIds || new Set();

  // Filters ────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'filters';
  filterBar.innerHTML = `
    <label>Status</label>
    <select id="f-status">
      <option value="all">All</option>
      <option value="not_started">Not started</option>
      <option value="in_progress">In progress</option>
      <option value="blocked">Blocked</option>
      <option value="done">Done</option>
    </select>
    <label>Phase</label>
    <select id="f-phase">
      <option value="all">All</option>
      ${Object.entries(app.state.phases).map(([id, p]) =>
        `<option value="${id}">${id}. ${escapeHtml(p.name)}</option>`).join('')}
    </select>
    <label>Priority</label>
    <select id="f-priority">
      <option value="all">All</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  `;
  root.appendChild(filterBar);

  const listWrap = document.createElement('div');
  root.appendChild(listWrap);

  function renderList() {
    const fStatus = filterBar.querySelector('#f-status').value;
    const fPhase = filterBar.querySelector('#f-phase').value;
    const fPriority = filterBar.querySelector('#f-priority').value;
    listWrap.innerHTML = '';

    const tasks = app.state.tasks.filter(t => {
      if (fStatus !== 'all' && t.status !== fStatus) return false;
      if (fPhase !== 'all' && String(t.phase) !== fPhase) return false;
      if (fPriority !== 'all' && t.priority !== fPriority) return false;
      return true;
    });

    let lastPhase = null;
    tasks.forEach(t => {
      if (t.phase !== lastPhase) {
        const h = document.createElement('div');
        h.className = 'phase-header';
        h.textContent = `Phase ${t.phase} · ${app.state.phases[t.phase].name}`;
        listWrap.appendChild(h);
        lastPhase = t.phase;
      }
      listWrap.appendChild(renderTask(t));
    });

    if (tasks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No tasks match the current filters.';
      listWrap.appendChild(empty);
    }
  }

  function renderTask(t) {
    const row = document.createElement('div');
    row.className = 'task-row';
    const isOpen = openIds.has(t.id);

    const titleById = id => {
      const x = app.state.tasks.find(tt => tt.id === id);
      return x ? x.title : '?';
    };

    const head = document.createElement('div');
    head.className = 'task-head';
    head.innerHTML = `
      <span class="chev ${isOpen ? 'open' : ''}">▶</span>
      <span class="task-num">#${t.id}</span>
      <span class="task-title ${t.status === 'done' ? 'done' : ''}">${escapeHtml(t.title)}</span>
      <span class="task-dur">${t.duration || 0}d</span>
      <span class="pill pill-${t.priority}">${t.priority}</span>
      <span class="pill pill-${t.status}">${t.status.replace('_', ' ')}</span>
    `;
    head.addEventListener('click', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      if (openIds.has(t.id)) openIds.delete(t.id);
      else openIds.add(t.id);
      renderList();
    });
    row.appendChild(head);

    const body = document.createElement('div');
    body.className = 'task-body' + (isOpen ? ' open' : '');

    body.innerHTML = `
      <div class="task-meta">
        <div class="field">
          <label>Status</label>
          <select data-field="status">
            <option value="not_started" ${t.status==='not_started'?'selected':''}>Not started</option>
            <option value="in_progress" ${t.status==='in_progress'?'selected':''}>In progress</option>
            <option value="blocked" ${t.status==='blocked'?'selected':''}>Blocked</option>
            <option value="done" ${t.status==='done'?'selected':''}>Done</option>
          </select>
        </div>
        <div class="field">
          <label>Priority</label>
          <select data-field="priority">
            <option value="high" ${t.priority==='high'?'selected':''}>High</option>
            <option value="medium" ${t.priority==='medium'?'selected':''}>Medium</option>
            <option value="low" ${t.priority==='low'?'selected':''}>Low</option>
          </select>
        </div>
        <div class="field">
          <label>Duration (days)</label>
          <input type="number" min="0" data-field="duration" value="${t.duration || 0}">
        </div>
        <div class="field">
          <label>Start date (override)</label>
          <input type="date" data-field="start" value="${t.start || ''}">
        </div>
        <div class="field">
          <label>End date (override)</label>
          <input type="date" data-field="end" value="${t.end || ''}">
        </div>
      </div>
    `;

    body.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('change', (e) => {
        const field = el.dataset.field;
        let v = e.target.value;
        if (field === 'duration') v = Math.max(0, parseInt(v, 10) || 0);
        t[field] = v;
        app.save();
        app.renderStats();
        renderList();
      });
    });

    if (t.deps && t.deps.length) {
      const deps = document.createElement('div');
      deps.className = 'deps';
      deps.innerHTML = `<strong>Depends on:</strong> ${
        t.deps.map(d => `#${d} ${escapeHtml(titleById(d))}`).join(' · ')
      }`;
      body.appendChild(deps);
    }

    // Comments ───────────────────────────────────────────
    const comments = document.createElement('div');
    comments.className = 'comments';
    comments.innerHTML = `<h4>Comments (${t.comments.length})</h4>`;
    t.comments.forEach((c, i) => {
      const cDiv = document.createElement('div');
      cDiv.className = 'comment';
      cDiv.innerHTML = `
        <div class="comment-text">${escapeHtml(c.text)}</div>
        <div class="comment-date">${c.date}</div>
        <button class="comment-del" title="Delete">✕</button>
      `;
      cDiv.querySelector('.comment-del').addEventListener('click', () => {
        t.comments.splice(i, 1);
        app.save();
        renderList();
      });
      comments.appendChild(cDiv);
    });

    const addBox = document.createElement('div');
    addBox.className = 'comment-add';
    addBox.innerHTML = `<input type="text" placeholder="Add a comment..."><button class="btn-primary">Add</button>`;
    const input = addBox.querySelector('input');
    const btn = addBox.querySelector('button');
    const doAdd = () => {
      const v = input.value.trim();
      if (!v) return;
      t.comments.push({ text: v, date: new Date().toISOString().slice(0, 10) });
      input.value = '';
      app.save();
      renderList();
    };
    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
    comments.appendChild(addBox);
    body.appendChild(comments);

    row.appendChild(body);
    return row;
  }

  filterBar.addEventListener('change', renderList);
  renderList();
};
