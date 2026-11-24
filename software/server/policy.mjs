export const ROLES = ['administrador', 'gerente', 'trabajador'];
export const AREAS = ['almacen', 'caja'];
export function normalizeUser(user) {
  if (!user) return user;
  const legacy = { director: 'gerente', almacen: 'trabajador', caja: 'trabajador' };
  const role = legacy[user.role] || user.role;
  const area = role === 'trabajador' ? (user.area || (user.role === 'caja' ? 'caja' : 'almacen')) : 'general';
  return { ...user, role, area };
}
export const isManagement = user => ['administrador', 'gerente'].includes(normalizeUser(typeof user === 'string' ? { role: user } : user)?.role);
export function can(subject, action) {
  const user = normalizeUser(typeof subject === 'string' ? { role: subject } : subject);
  if (!user || !ROLES.includes(user.role)) return false;
  if (['auth.login', 'auth.logout', 'contact.save', 'inventory.read', 'prices.read'].includes(action)) return true;
  if (['price.save', 'price.archive', 'lot.classify'].includes(action)) return user.role === 'administrador';
  if (['user.save', 'audit.read', 'settings.update', 'operation.void', 'operation.return', 'cash.void', 'summary.read'].includes(action)) return isManagement(user);
  if (['purchase.create', 'purchase.receive', 'process.create', 'drying.start', 'drying.finish', 'stock.read'].includes(action)) return isManagement(user) || user.area === 'almacen';
  if (action === 'drying.cancel') return isManagement(user);
  if (['sale.create', 'sale.deliver', 'payment.create', 'cash.create', 'cash.read'].includes(action)) return isManagement(user) || user.area === 'caja';
  return false;
}
