import type { Data, Role, Stage, Range, User } from './types';
export const money = (cents: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(cents / 100);
export const number = (n: number, digits = 2) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: digits }).format(n);
export const kg = (grams: number) => `${number(grams / 1000, 3)} kg`;
export const dateLabel = (v: string) => new Date(v + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
export const stageName: Record<Stage, string> = { coco: 'Café coco', pergamino: 'Pergamino', verde: 'Café verde', tostado: 'Tostado en grano', molido: 'Café molido' };
export const roleName: Record<Role, string> = { administrador: 'Administrador', gerente: 'Gerente', trabajador: 'Trabajador' };
export const nextStage: Partial<Record<Stage, Stage>> = { coco: 'verde', pergamino: 'verde', verde: 'tostado', tostado: 'molido' };
export const isManager = (r: Role) => ['gerente', 'administrador'].includes(r);
export const isCash = (u: User) => isManager(u.role) || u.area === 'caja';
export const isStock = (u: User) => isManager(u.role) || u.area === 'almacen';
export const homePath = (u: User) => `/panel/${u.role}`;
export const areaName = (u: User) => u.role === 'trabajador' ? (u.area === 'caja' ? 'Ventas y caja' : 'Almacén y producción') : roleName[u.role];
export const initials = (s: string) => s.split(' ').slice(0, 2).map(x => x[0]).join('');
export const contactName = (d: Data, id: string) => d.contacts.find(c => c.id === id)?.name || 'Contacto';
export const lotCode = (d: Data, id: string | null) => d.lots.find(l => l.id === id)?.code || 'Sin lote';
export const ordered = <T extends { date: string }>(items: T[]) => [...items].sort((a, b) => b.date.localeCompare(a.date));
export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;
export function reportLink(kind: string, range: Range, query = '') {
  return `/api/reports/${kind}?${new URLSearchParams({ ...range, q: query })}`;
}
export { summarize } from './summary.mjs';
