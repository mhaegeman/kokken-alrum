// ─── timeline.js ────────────────────────────────────────────────
// Gantt-style timeline view. One row per task, bars positioned by
// week offset from the project start. Dates auto-computed from
// durations + dependencies, unless a task has explicit start/end.

window.Views = window.Views || {};

window.Views.timeline = function(root, app) {
  const schedule = computeSchedule(app.state);

  // Find earliest start and latest end.
  const entries = app.state.tasks.map(t => ({ task: t, ...schedule[t.id] }));
  const projectStart = app.state.startDate;
  const projectEnd = entries.reduce((max, e) => e.end > max ? e.end : max, projectStart);

  const totalDays = Math.max(7, diffDays(projectStart, projectEnd) + 1);
  const totalWeeks = Math.ceil(totalDays / 7);

  const startDateLabel = formatDateShort(projectStart);
  const endDateLabel = formatDateShort(projectEnd);

  // Controls ───────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.className = 'filters';
  controls.innerHTML = `
    <label>Project start</label>
    <input type="date" id="start-date" value="${app.state.startDate}">
    <span style="color: var(--text-3); font-size: 12px;">
      · ${totalWeeks} weeks · ends approx. ${endDateLabel}
    </span>
  `;
  controls.querySelector('#start-date').addEventListener('change', (e) => {
    app.state.startDate = e.target.value;
    app.save();
    app.renderCurrent();
  });
  root.appendChild(controls);

  // Wrap + legend ──────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'timeline-wrap';

  const legend = document.createElement('div');
  legend.className = 'timeline-legend';
  legend.innerHTML = Object.entries(app.state.phases).map(([id, p]) =>
    `<span><span class="legend-swatch" style="background:${p.color}"></span>${escapeHtml(p.name)}</span>`
  ).join('') + `<span><span class="legend-swatch" style="background:#888; opacity: 0.45"></span>Done</span>`;
  wrap.appendChild(legend);

  const grid = document.createElement('div');
  grid.className = 'timeline-grid';
  grid.style.setProperty('--weeks', totalWeeks);

  // Axis ───────────────────────────────────────────────────
  const axis = document.createElement('div');
  axis.className = 'timeline-axis';
  const axisLabelCol = document.createElement('div');
  axisLabelCol.className = 'axis-label-col';
  axisLabelCol.style.width = '280px';
  axisLabelCol.textContent = 'Task';
  axis.appendChild(axisLabelCol);

  const axisWeeks = document.createElement('div');
  axisWeeks.className = 'axis-weeks';
  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(projectStart, w * 7);
    const cell = document.createElement('div');
    cell.className = 'axis-week';
    cell.textContent = `W${w + 1}`;
    cell.title = formatDateShort(weekStart);
    axisWeeks.appendChild(cell);
  }
  axis.appendChild(axisWeeks);
  grid.appendChild(axis);

  // Rows ───────────────────────────────────────────────────
  entries.forEach(({ task, start, end }) => {
    const row = document.createElement('div');
    row.className = 'timeline-row';

    const label = document.createElement('div');
    label.className = 'timeline-label';
    label.style.width = '280px';
    label.textContent = `#${task.id} ${task.title}`;
    label.title = `${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)} (${task.duration}d)`;
    row.appendChild(label);

    const track = document.createElement('div');
    track.className = 'timeline-track';

    const startOffset = diffDays(projectStart, start);
    const barDays = Math.max(1, diffDays(start, end));

    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (barDays / totalDays) * 100;

    const bar = document.createElement('div');
    let barClass = `timeline-bar bar-phase-${task.phase}`;
    if (task.status === 'done') barClass += ' bar-done';
    if (task.status === 'blocked') barClass += ' bar-blocked';
    bar.className = barClass;
    bar.style.left = `${leftPct}%`;
    bar.style.width = `${widthPct}%`;
    bar.textContent = `${task.duration}d`;
    bar.title = `${task.title}\n${formatDateShort(start)} → ${formatDateShort(end)}\nStatus: ${task.status.replace('_',' ')}`;
    track.appendChild(bar);

    row.appendChild(track);
    grid.appendChild(row);
  });

  wrap.appendChild(grid);
  root.appendChild(wrap);

  // Note below ─────────────────────────────────────────────
  const note = document.createElement('p');
  note.style.cssText = 'font-size: 12px; color: var(--text-3); margin-top: 12px;';
  note.textContent = `Dates are auto-scheduled from durations and dependencies. Override a task's start/end in the Tasks view to pin it.`;
  root.appendChild(note);
};

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
