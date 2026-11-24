import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, X, ChevronLeft, ChevronRight, ArrowUpRight, CalendarDays, Bean, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Range } from './types';

export function Brand() { return <Link className="brand" to="/dashboard" aria-label="Chasquero Coffee inicio"><span className="brand-mark"><Bean strokeWidth={1.4}/></span><span>Chasquero<small>COFFEE · GESTIÓN</small></span></Link>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function SearchField({ value, onChange, placeholder = 'Buscar…' }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <div className="search-field"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <button className="icon-button" aria-label="Limpiar búsqueda" onClick={() => onChange('')}><X size={15}/></button>}</div>;
}
export function Empty({ title = 'No hay registros', children }: { title?: string; children?: ReactNode }) { return <div className="empty"><span><Inbox size={28} strokeWidth={1.4}/></span><h3>{title}</h3><p>{children || 'Prueba otra búsqueda o registra la primera operación.'}</p></div>; }
export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
export function CardHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="card-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const [draft, setDraft] = useState(value); const [error, setError] = useState('');
  useEffect(() => setDraft(value), [value]);
  return <form className="range-picker" onSubmit={e => { e.preventDefault(); if (draft.from > draft.to) { setError('La fecha inicial debe ser anterior a la final.'); return; } setError(''); onChange(draft); }}><CalendarDays size={17}/><label><span className="sr-only">Desde</span><input type="date" aria-label="Desde" required value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })}/></label><span className="range-separator">—</span><label><span className="sr-only">Hasta</span><input type="date" aria-label="Hasta" required value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })}/></label><button className="button small" type="submit">Aplicar</button>{error && <span className="range-error" role="alert">{error}</span>}</form>;
}
export type Column<T> = { title: string; render: (row: T) => ReactNode; numeric?: boolean };
export function DataTable<T extends { id: string }>({ rows, columns, empty, pageSize = 8 }: { rows: T[]; columns: Column<T>[]; empty?: ReactNode; pageSize?: number }) {
  const [page, setPage] = useState(1); const count = Math.max(1, Math.ceil(rows.length / pageSize)); const current = Math.min(page, count);
  if (!rows.length) return empty || <Empty/>;
  return <><div className="table-scroll"><table><thead><tr>{columns.map((c, i) => <th key={i} className={c.numeric ? 'numeric' : ''}>{c.title}</th>)}</tr></thead><tbody>{rows.slice((current - 1) * pageSize, current * pageSize).map(row => <tr key={row.id}>{columns.map((c, i) => <td key={i} className={c.numeric ? 'numeric' : ''}>{c.render(row)}</td>)}</tr>)}</tbody></table></div>{rows.length > pageSize && <div className="pagination"><span>{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, rows.length)} de {rows.length} registros</span><div><button className="icon-button" disabled={current === 1} aria-label="Página anterior" onClick={() => setPage(current - 1)}><ChevronLeft size={17}/></button><span>{current} / {count}</span><button className="icon-button" disabled={current === count} aria-label="Página siguiente" onClick={() => setPage(current + 1)}><ChevronRight size={17}/></button></div></div>}</>;
}
export function RowAction({ label, onClick }: { label: string; onClick: () => void }) { return <button className="row-action" aria-label={label} onClick={onClick}><ArrowUpRight size={18}/></button>; }
export function Dialog({ title, subtitle, children, onClose, busy = false, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'wide' : ''}`} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><div className="dialog-heading"><div><div className="eyebrow">CHASQUERO COFFEE</div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><X size={21}/></button></div>{children}</dialog>;
}
