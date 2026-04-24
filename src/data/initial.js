// Initial seed data for tasks and budget items.
// Edit freely — existing users keep their localStorage until they hit "Reset".

window.INITIAL_DATA = {
  startDate: '2026-05-01', // project kickoff anchor date for the timeline

  phases: {
    1: { name: 'Planning & design', color: '#7f77dd' },
    2: { name: 'Approvals & quotes', color: '#1d9e75' },
    3: { name: 'Execution',          color: '#d85a30' },
    4: { name: 'Kids room',          color: '#378add' }
  },

  tasks: [
    { id: 1, phase: 1, title: 'Agree on a layout',
      priority: 'high', status: 'not_started',
      duration: 7, deps: [], start: '', end: '',
      comments: [{ text: 'Sketch 2–3 options, pick together.', date: '2026-04-24' }] },

    { id: 2, phase: 1, title: 'Review by family architect & get technical drawings',
      priority: 'high', status: 'not_started',
      duration: 14, deps: [1], start: '', end: '',
      comments: [] },

    { id: 3, phase: 2, title: 'Plumber estimate (VVS of residence)',
      priority: 'high', status: 'not_started',
      duration: 10, deps: [2], start: '', end: '',
      comments: [] },

    { id: 4, phase: 2, title: 'Electrician estimate',
      priority: 'high', status: 'not_started',
      duration: 10, deps: [2], start: '', end: '',
      comments: [] },

    { id: 5, phase: 2, title: 'Kitchen builder friend: reuse vs buy vs build',
      priority: 'high', status: 'not_started',
      duration: 10, deps: [2], start: '', end: '',
      comments: [{ text: 'List what to reuse from old kitchen; ask about labor cost.', date: '2026-04-24' }] },

    { id: 6, phase: 2, title: 'Make total budget',
      priority: 'high', status: 'not_started',
      duration: 5, deps: [3, 4, 5], start: '', end: '',
      comments: [] },

    { id: 7, phase: 2, title: 'Get board approval (residence)',
      priority: 'high', status: 'not_started',
      duration: 21, deps: [2, 6], start: '', end: '',
      comments: [{ text: 'Board usually wants drawings + contractor info.', date: '2026-04-24' }] },

    { id: 8, phase: 2, title: 'Get kommune approval',
      priority: 'high', status: 'not_started',
      duration: 30, deps: [7], start: '', end: '',
      comments: [] },

    { id: 9, phase: 3, title: 'Old kitchen removal',
      priority: 'medium', status: 'not_started',
      duration: 3, deps: [8], start: '', end: '',
      comments: [] },

    { id: 10, phase: 3, title: 'Inspect floor & walls of old kitchen',
      priority: 'medium', status: 'not_started',
      duration: 2, deps: [9], start: '', end: '',
      comments: [{ text: 'Check damp, insulation, existing electrical.', date: '2026-04-24' }] },

    { id: 11, phase: 3, title: 'Plumbing and electrical work',
      priority: 'high', status: 'not_started',
      duration: 7, deps: [9], start: '', end: '',
      comments: [] },

    { id: 12, phase: 3, title: 'New kitchen installation',
      priority: 'high', status: 'not_started',
      duration: 10, deps: [11], start: '', end: '',
      comments: [] },

    { id: 13, phase: 4, title: 'Make kids room',
      priority: 'medium', status: 'not_started',
      duration: 14, deps: [10, 12], start: '', end: '',
      comments: [] }
  ],

  budgetCategories: {
    design:   'Design & approvals',
    plumbing: 'Plumbing',
    electric: 'Electrical',
    cabinets: 'Cabinets & countertops',
    appliances: 'Appliances',
    demolition: 'Demolition & disposal',
    labor:    'Labor',
    kids:     'Kids room',
    misc:     'Misc & contingency'
  },

  budgetItems: [
    { id: 1, category: 'design',     name: 'Architect drawings', estimate: 0, actual: 0 },
    { id: 2, category: 'design',     name: 'Kommune application fees', estimate: 1000, actual: 0 },
    { id: 3, category: 'plumbing',   name: 'VVS work (rerouting + new)', estimate: 25000, actual: 0 },
    { id: 4, category: 'electric',   name: 'Electrical work (new circuits, sockets)', estimate: 18000, actual: 0 },
    { id: 5, category: 'cabinets',   name: 'New cabinets + countertop', estimate: 45000, actual: 0 },
    { id: 6, category: 'appliances', name: 'Oven, hob, extractor', estimate: 15000, actual: 0 },
    { id: 7, category: 'appliances', name: 'Dishwasher', estimate: 6000, actual: 0 },
    { id: 8, category: 'appliances', name: 'Fridge/freezer', estimate: 8000, actual: 0 },
    { id: 9, category: 'demolition', name: 'Old kitchen removal + waste', estimate: 5000, actual: 0 },
    { id: 10, category: 'labor',     name: 'Kitchen builder friend', estimate: 20000, actual: 0 },
    { id: 11, category: 'kids',      name: 'Flooring / wall repair', estimate: 10000, actual: 0 },
    { id: 12, category: 'kids',      name: 'Paint, fixtures, lighting', estimate: 5000, actual: 0 },
    { id: 13, category: 'misc',      name: 'Contingency (~10%)', estimate: 15000, actual: 0 }
  ],

  currency: 'DKK',

  totalBudgetTarget: 180000 // optional cap, shown as a progress bar
};
