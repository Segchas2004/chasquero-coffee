import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Sprout, Package, Factory, ShoppingBag, Wallet, ContactRound, ChartNoAxesCombined, Users, Settings, History, Menu, LogOut, RefreshCw, X, ChevronRight, ArrowRight, Bean, LoaderCircle, ShieldCheck, Tags, BriefcaseBusiness, HardHat, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { api, ApiError } from './api';
import { AppContext } from './context';
import Editor from './Editor';
import { Brand } from './ui';
import { initials, isManager, isCash, isStock, roleName, homePath, areaName, today } from './lib';
import type { User, Role, Data, EditorSpec, Range } from './types';
import { DashboardPage, OperationsPage, InventoryPage, ProcessesPage, TreasuryPage, ContactsPage, ReportsPage, TeamPage, SettingsPage } from './pages';
import { AdminPanel, WorkerPanel, PricesPage, AuditTrailPage, ManagerWelcome } from './workspace';

const navigation = [
  { path: '/dashboard', label: 'Mi panel', icon: LayoutDashboard, group: 'MI ESPACIO' },
  { path: '/compras', label: 'Compras', icon: Sprout, group: 'OPERACIONES' },
  { path: '/inventario', label: 'Inventario', icon: Package, group: '' },
  { path: '/procesamiento', label: 'Procesamiento', icon: Factory, group: '' },
  { path: '/ventas', label: 'Ventas', icon: ShoppingBag, group: '' },
  { path: '/tesoreria', label: 'Caja y saldos', icon: Wallet, group: 'NEGOCIO' },
  { path: '/precios', label: 'Precios del café', icon: Tags, group: '' },
  { path: '/contactos', label: 'Productores y clientes', icon: ContactRound, group: '' },
  { path: '/reportes', label: 'Reportes', icon: ChartNoAxesCombined, group: '' },
  { path: '/equipo', label: 'Usuarios y permisos', icon: Users, group: 'ADMINISTRACIÓN' },
  { path: '/auditoria', label: 'Auditoría', icon: History, group: '' },
  { path: '/configuracion', label: 'Configuración', icon: Settings, group: '' },
];
const allowed = (user: User, path: string) => {
  if (['/equipo', '/auditoria', '/configuracion'].includes(path)) return isManager(user.role);
  if (['/ventas', '/tesoreria'].includes(path)) return isCash(user);
  if (['/compras', '/procesamiento'].includes(path)) return isStock(user);
  if (path.startsWith('/panel/')) return path === homePath(user);
  return true;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [syncing, setSyncing] = useState(false);
  const [editor, setEditor] = useState<EditorSpec | null>(null); const [collapsed, setCollapsed] = useState(false); const [mobile, setMobile] = useState(false);
  const [range, setRange] = useState<Range>({ from: '2026-09-09', to: today() });
  const location = useLocation(); const navigate = useNavigate();
  const refresh = useCallback(async () => {
    setSyncing(true);
    try { const [session, state] = await Promise.all([api('/me'), api('/state')]); setUser(session.user); setData(state); setError(''); }
    catch (e) { if (e instanceof ApiError && [401, 403].includes(e.status)) { setUser(null); setData(null); setEditor(null); } else setError((e as Error).message); }
    finally { setInitial(false); setSyncing(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (!user) return; const timer = setInterval(() => { void refresh(); }, 15000); return () => clearInterval(timer); }, [user?.id, refresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { setMobile(false); document.querySelector('main')?.focus(); }, [location.pathname]);
  async function command(type: string, payload: any, requestId: string) {
    const state = await api(type === 'user.save' ? '/users' : '/commands', { type, payload, requestId });
    setData(state);
    if (state.users?.some((x: User) => x.id === user?.id)) setUser(state.users.find((x: User) => x.id === user?.id));
  }
  async function login(email: string, password: string, portal: Role) {
    const session = await api('/login', { email, password, portal });
    const state = await api('/state'); setUser(session.user); setData(state); setError('');
    navigate(homePath(session.user), { replace: true });
  }
  async function logout() {
    try { await api('/logout', {}); const portal = user?.role; setUser(null); setData(null); setEditor(null); navigate(`/acceso/${portal || ''}`, { replace: true }); }
    catch (e) { setError((e as Error).message); }
  }
  if (initial) return <div className="loading-screen" role="status"><Bean size={38}/><h1>Chasquero Coffee</h1><p>Preparando tu espacio de trabajo…</p><LoaderCircle size={20} className="spin"/></div>;
  if (!user || !data) return <Routes><Route path="/acceso" element={<Login onLogin={login} connectionError={error}/>}/><Route path="/acceso/:perfil" element={<Login onLogin={login} connectionError={error}/>}/><Route path="*" element={<Navigate to="/acceso" replace/>}/></Routes>;
  const active = navigation.find(n => n.path === location.pathname);
  const panel = location.pathname.startsWith('/panel/');
  return <AppContext.Provider value={{ data, user, range, setRange, open: setEditor, close: () => setEditor(null), command, refresh, notify: setNotice }}>
    <div className={`app-shell role-${user.role} ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}>
      <a href="#main-content" className="skip-link">Saltar al contenido</a>
      {mobile && <button aria-label="Cerrar menú lateral" className="mobile-overlay" onClick={() => setMobile(false)}/>}
      <aside className="sidebar"><div className="sidebar-top"><Brand/><span className="workspace-tag"><span/>{areaName(user).toUpperCase()}</span></div>
        <nav aria-label="Menú principal">{navigation.filter(item => allowed(user, item.path)).map(item => <div key={item.path}>{item.group && <div className="nav-label">{item.group}</div>}<NavLink to={item.path === '/dashboard' ? homePath(user) : item.path} title={item.label} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><item.icon size={19} strokeWidth={1.7}/><span>{item.label}</span><i/></NavLink></div>)}</nav>
        <div className="sidebar-bottom"><div className="origin-note"><Bean size={23}/><p>De Las Pirias<br/><em>a cada decisión.</em></p><small>Cajamarca · Perú</small></div><div className="user-block"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name.split(' ').slice(0, 2).join(' ')}</strong><small>{roleName[user.role]}</small></div><button className="logout" aria-label="Cerrar sesión" onClick={logout}><LogOut size={18}/></button></div></div>
      </aside>
      <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button" aria-label="Abrir o cerrar menú" aria-expanded={mobile || !collapsed} onClick={() => window.innerWidth <= 900 ? setMobile(!mobile) : setCollapsed(!collapsed)}><Menu size={20}/></button><Link to={homePath(user)}>Mi espacio</Link><ChevronRight size={13}/><span>{panel ? `Panel de ${roleName[user.role].toLowerCase()}` : active?.label || 'Gestión'}</span></div><div className="topbar-actions"><span className="environment-badge"><span/>{import.meta.env.DEV ? 'Local · Práctica' : 'Chasquero · Empresa'}</span><button className="icon-button" aria-label="Actualizar datos" disabled={syncing} onClick={() => void refresh()}><RefreshCw size={17} className={syncing ? 'spin' : ''}/></button><span className="avatar header-avatar" title={user.name}>{initials(user.name)}</span></div></header>
        {error && <div className="connection-error" role="alert">{error}<button onClick={() => void refresh()}>Reintentar</button></div>}
        <main id="main-content" tabIndex={-1}>{!allowed(user, location.pathname) ? <Navigate to={homePath(user)} replace/> : <Routes>
          <Route path="/" element={<Navigate to={homePath(user)} replace/>}/><Route path="/dashboard" element={<Navigate to={homePath(user)} replace/>}/><Route path="/acceso/*" element={<Navigate to={homePath(user)} replace/>}/>
          <Route path="/panel/administrador" element={<AdminPanel/>}/><Route path="/panel/gerente" element={<><ManagerWelcome/><DashboardPage/></>}/><Route path="/panel/trabajador" element={<WorkerPanel/>}/>
          <Route path="/compras" element={<OperationsPage key="purchases" kind="purchase"/>}/><Route path="/inventario" element={<InventoryPage/>}/><Route path="/procesamiento" element={<ProcessesPage/>}/><Route path="/ventas" element={<OperationsPage key="sales" kind="sale"/>}/><Route path="/tesoreria" element={<TreasuryPage/>}/><Route path="/precios" element={<PricesPage/>}/><Route path="/contactos" element={<ContactsPage/>}/><Route path="/reportes" element={<ReportsPage/>}/><Route path="/equipo" element={<TeamPage/>}/><Route path="/configuracion" element={<SettingsPage/>}/><Route path="/auditoria" element={<AuditTrailPage/>}/>
          <Route path="*" element={<div className="not-found"><h1>No encontramos esta página</h1><Link className="button primary" to={homePath(user)}>Ir a mi panel <ArrowRight size={17}/></Link></div>}/>
        </Routes>}<footer className="app-footer"><span><Bean size={14}/>Chasquero Coffee</span><span>{areaName(user)} · Gestión de café</span></footer></main>
      </div>
    </div>
    {editor && <Editor key={`${editor.kind}-${editor.target?.id || ''}-${editor.sourceType || ''}`} spec={editor}/>}
    {notice && <div className="toast" role="status"><ShieldCheck size={19}/><span>{notice}</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={15}/></button></div>}
  </AppContext.Provider>;
}

const portals = [
  { role: 'administrador' as Role, title: 'Administrador', icon: ShieldCheck, copy: 'Precios, personas y control del sistema.', heading: 'Organiza el negocio.', detail: 'Gestiona el tarifario, los accesos y cada cambio en la operación.', email: 'administracion@chasquero.local' },
  { role: 'gerente' as Role, title: 'Gerente', icon: BriefcaseBusiness, copy: 'Indicadores y decisiones del negocio.', heading: 'Mira el panorama completo.', detail: 'Consulta ventas, caja, existencias y el historial de tu empresa.', email: 'director@chasquero.local' },
  { role: 'trabajador' as Role, title: 'Trabajador', icon: HardHat, copy: 'Las tareas que mueven nuestro café.', heading: 'Tu jornada empieza aquí.', detail: 'Registra las operaciones de tu área y sigue el recorrido de cada lote.', email: 'almacen@chasquero.local' },
];
function Login({ onLogin, connectionError }: { onLogin: (email: string, password: string, portal: Role) => Promise<void>; connectionError: string }) {
  const location = useLocation();
  const current = portals.find(p => p.role === location.pathname.split('/')[2]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setError(''); setPassword(''); setEmail(''); }, [current?.role]);
  async function enter(email: string, password: string) { if (!current) return; setError(''); setBusy(true); try { await onLogin(email, password, current.role); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }
  return <div className={`portal-login ${current ? 'selected' : ''}`}>
    <section className="portal-form-side"><div className="portal-brand"><span className="brand-mark"><Bean strokeWidth={1.4}/></span><div>Chasquero<small>COFFEE · LAS PIRIAS</small></div></div>
      <div className="portal-content"><Link className="back-to-profiles" to="/">← Volver a Chasquero Coffee</Link>{current ? <>
        <Link className="back-to-profiles" to="/acceso"><ArrowLeft size={15}/>Cambiar de perfil</Link>
        <div className={`portal-icon ${current.role}`}><current.icon size={28}/></div><div className="eyebrow">ACCESO DE {current.title.toUpperCase()}</div><h1>{current.heading}</h1><p>{current.detail}</p>
        <div className="portal-tabs" aria-label="Perfiles de acceso">{portals.map(p => <Link key={p.role} to={`/acceso/${p.role}`} className={p.role === current.role ? 'active' : ''}>{p.title}</Link>)}</div>
        <form onSubmit={e => { e.preventDefault(); void enter(email, password); }}><label className="field"><span>Correo de acceso</span><input type="email" required autoComplete="username" placeholder="Tu correo de empresa" value={email} onChange={e => setEmail(e.target.value)}/></label><label className="field"><span>Contraseña</span><div className="password-control"><input type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Ingresa tu contraseña" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShow(!show)}>{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
          {(error || connectionError) && <div className="form-error" role="alert">{error || connectionError}</div>}
          <button className="button primary portal-submit" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <ArrowRight size={18}/>} {busy ? 'Ingresando…' : `Ingresar como ${current.title.toLowerCase()}`}</button>
        </form>
        {import.meta.env.DEV && <details className="practice-access"><summary>Probar con una cuenta de demostración</summary><p>Datos ficticios. Contraseña: <code>CafeLocal2026!</code></p><button className="button" disabled={busy} onClick={() => void enter(current.email, 'CafeLocal2026!')}>Abrir demostración de {current.title.toLowerCase()}</button>{current.role === 'trabajador' && <button className="button" disabled={busy} onClick={() => void enter('caja@chasquero.local', 'CafeLocal2026!')}>Abrir demostración de caja</button>}</details>}
      </> : <><div className="eyebrow">BIENVENIDO A TU ESPACIO DE TRABAJO</div><h1>Buen café.<br/><em>Mejores decisiones.</em></h1><p>Selecciona tu perfil para empezar. Cada persona, con las herramientas que necesita.</p><div className="portal-choices">{portals.map(p => <Link className="portal-choice" key={p.role} to={`/acceso/${p.role}`}><span className={`portal-icon ${p.role}`}><p.icon size={25}/></span><span><strong>{p.title}</strong><small>{p.copy}</small></span><ArrowRight size={18}/></Link>)}</div><div className="portal-security"><ShieldCheck size={17}/><span>Acceso personal · Permisos verificados en cada operación</span></div></>}
      </div><footer>Chasquero Coffee © 2026 <span>Hecho para nuestra gente.</span></footer>
    </section>
    <section className="portal-photo"><img src="/coffee-origin.png" alt="Granos de café tostado"/><div className="portal-photo-overlay"/><div className="origin-pill"><span/> LAS PIRIAS · CAJAMARCA · PERÚ</div><div className="portal-photo-copy"><span>DESDE EL ORIGEN</span><h2>El valor de nuestro café<br/>está en cada detalle.</h2><p>Una empresa, un equipo y una forma más clara<br/>de acompañar cada etapa.</p><div className="coffee-journey"><span>01 <b>Origen</b></span><span>02 <b>Proceso</b></span><span>03 <b>Destino</b></span></div></div><small className="photo-note">Fotografía referencial</small></section>
  </div>;
}
