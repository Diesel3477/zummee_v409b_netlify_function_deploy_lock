
/* ===== SMART ALERTS REBUILD (CANONICAL) ===== */
function buildSmartAlertsState(data){
  data = data || {};
  const board = data.board || {};
  const maintenance = data.maintenance || {};
  const approvals = data.approvals || {};

  return {
    board: {
      tone: board.overdue > 0 ? 'urgent' : (board.open > 0 ? 'attention' : 'good'),
      title: board.overdue > 0 ? 'Board review overdue' : 'Board review status',
      badge: board.overdue > 0 ? 'URGENT' : (board.open > 0 ? 'OPEN' : 'STABLE'),
      copy: board.overdue > 0 
        ? `${board.open || 0} open item, ${board.overdue || 0} overdue.`
        : (board.open > 0 ? `${board.open} open items` : 'No open board items for the selected community.')
    },
    maintenance: {
      tone: (maintenance.urgent || 0) > 0 ? 'urgent' : ((maintenance.open || 0) > 0 ? 'attention' : 'good'),
      title: 'Maintenance activity',
      badge: (maintenance.open || 0) > 0 ? `${maintenance.open} OPEN` : 'QUIET',
      copy: (maintenance.open || maintenance.live)
        ? `${maintenance.open || 0} open work orders, ${maintenance.live || 0} live updates`
        : 'No active maintenance activity'
    },
    approvals: {
      tone: approvals.open > 0 ? 'attention' : 'good',
      title: 'Annual meeting approvals',
      badge: approvals.open > 0 ? 'OPEN' : 'CLEAR',
      copy: approvals.open > 0 
        ? `${approvals.open} pending approvals`
        : 'No active items'
    }
  };
}

function renderSmartAlerts(state){
  if (!state) return;
  if (state.board) {
    setAlertCard('mh2AlertBoard', {
      tone: state.board.tone,
      title: state.board.title,
      badge: state.board.badge,
      copy: state.board.copy,
      href: 'board_member_hub.html'
    });
  }
  if (state.maintenance) {
    setAlertCard('mh2AlertActivity', {
      tone: state.maintenance.tone,
      title: state.maintenance.title,
      badge: state.maintenance.badge,
      copy: state.maintenance.copy,
      href: 'maintenance_updates.html'
    });
  }
  if (state.approvals) {
    setAlertCard('mh2AlertApprovals', {
      tone: state.approvals.tone,
      title: state.approvals.title,
      badge: state.approvals.badge,
      copy: state.approvals.copy,
      href: 'annual_meeting_approvals.html'
    });
  }
}
/* ===== END SMART ALERTS REBUILD ===== */
