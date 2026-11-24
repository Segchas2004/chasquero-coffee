export const isOpenOperation = op => !['anulado','devuelto'].includes(op.status);
// A closed operation keeps its original amounts for history, but carries no debt.
export const outstandingCents = op => isOpenOperation(op) ? Math.max(0, op.totalCents - op.paidCents) : 0;
/** @template T @param {T[]} operations @returns {T[]} */
export const pendingOperations = operations => operations.filter(op => outstandingCents(op) > 0);
export const isFulfilledOperation = op => isOpenOperation(op) && op.deliveryStatus !== 'pendiente';
export function operationStatus(op, kind) {
  if (op.status === 'anulado') return 'anulado';
  if (op.status === 'devuelto') return 'devuelto';
  if (op.deliveryStatus === 'pendiente') return 'pendiente';
  return kind === 'purchase' ? 'comprado' : 'vendido';
}
export const availableGrams = lot => lot.stockGrams - (lot.reservedGrams || 0);
