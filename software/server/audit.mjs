// Only accepted operations are recorded. Secrets never enter this structure.
export function recordAudit(previous, state, event) {
  const changes = [];
  const collections = Object.keys(state).filter(key => !['audit', 'settings'].includes(key) && Array.isArray(state[key]));
  for (const collection of [...collections, 'settings']) {
    const beforeRows = collection === 'settings' ? [previous.settings] : (previous[collection] || []);
    const afterRows = collection === 'settings' ? [state.settings] : (state[collection] || []);
    const beforeMap = new Map(beforeRows.map(row => [row.id, row]));
    const afterMap = new Map(afterRows.map(row => [row.id, row]));
    for (const recordId of new Set([...beforeMap.keys(), ...afterMap.keys()])) {
      const before = beforeMap.get(recordId) || null;
      const after = afterMap.get(recordId) || null;
      const fields = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
      if (!fields.length) continue;
      const operation = !before ? 'create' : !after || (before.active !== false && after.active === false) ? 'delete' : before.status !== 'anulado' && after.status === 'anulado' || before.status !== 'revertido' && after.status === 'revertido' ? 'void' : 'update';
      changes.push({ collection, recordId, operation, fields, before, after, logical: operation === 'delete' && !!after });
    }
  }
  state.audit.push({ ...event, changes });
  return state;
}
