import express from 'express';
import { reportPdf } from './report-pdf.mjs';
import { statisticsReport } from './statistics.mjs';
import { operationStatus, isFulfilledOperation, availableGrams } from '../src/workflow.mjs';
import { createHash, randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import { auth, readState, transact, production, projectId } from './firebase.mjs';
import { applyCommand, BusinessError, visibleState, csv, normalizeUser } from './domain.mjs';

import { can } from './policy.mjs';
import { localConfig } from './local-config.mjs';
import { isLocalWebOrigin } from './local-origin.mjs';
export const app = express();
app.set('trust proxy', 1);
const sessionName = production ? '__session' : 'chasquero_session';
const allowedOrigins = new Set((process.env.CHASQUERO_ALLOWED_ORIGINS || (production ? `https://${projectId}.web.app,https://${projectId}.firebaseapp.com` : 'http://localhost:5173,http://127.0.0.1:5173,http://terminal.local:5173')).split(',').map(x => x.trim()));
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin;
    const permitted = origin ? (production ? allowedOrigins.has(origin) : allowedOrigins.has(origin) || isLocalWebOrigin(origin, localConfig.webPort)) : !production;
    if (!permitted || req.headers['x-chasquero-client'] !== 'local-app') return res.status(403).json({ error: 'Solicitud no permitida.' });
  }
  next();
});
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: production, path: '/api' };
const attempts = new Map();
app.get('/api/health', (_, res) => res.json({ ok: true, mode: production ? 'firebase-cloud' : 'firebase-emulators' }));
app.post('/api/login', async (req, res) => {
  const key = req.ip || 'local';
  const now = Date.now();
  let count = attempts.get(key);
  if (!count || now - count.at > 15 * 60 * 1000) { count = { at: now, failures: 0 }; attempts.set(key, count); }
  if (count.failures >= 20) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a ingresar.' });
  if (production && !process.env.CHASQUERO_WEB_API_KEY) return res.status(503).json({ error: 'El acceso aún no está configurado.' });
  const authUrl = production ? `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.CHASQUERO_WEB_API_KEY}` : `http://127.0.0.1:${localConfig.authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key`;
  const response = await fetch(authUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: req.body.email, password: req.body.password, returnSecureToken: true }),
  });
  const result = await response.json();
  if (!response.ok) { count.failures++; return res.status(401).json({ error: 'Correo o contraseña incorrectos.' }); }
  const state = await readState();
  const user = normalizeUser(state.users.find(u => u.id === result.localId && u.active));
  if (!user) return res.status(403).json({ error: 'Esta cuenta no tiene acceso activo al sistema.' });
  if (req.body.portal && req.body.portal !== user.role) return res.status(403).json({ error: 'Esta cuenta corresponde a otro perfil. Selecciona el acceso asignado por la empresa.' });
  await transact(state => applyCommand(state, { type: 'auth.login', requestId: randomUUID() }, state.users.find(x => x.id === user.id)));
  const session = await auth.createSessionCookie(result.idToken, { expiresIn: 8 * 60 * 60 * 1000 });
  count.failures = 0;
  res.cookie(sessionName, session, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  res.json({ user });
});
app.post('/api/logout', async (req, res) => {
  if (req.cookies[sessionName]) {
    let decoded;
    try { decoded = await auth.verifySessionCookie(req.cookies[sessionName], true); } catch {}
    if (decoded) await transact(state => {
      const actor = state.users.find(x => x.id === decoded.uid && x.active);
      return actor ? applyCommand(state, { type: 'auth.logout', requestId: randomUUID() }, actor) : state;
    });
  }
  res.clearCookie(sessionName, cookieOptions); res.json({ ok: true });
});
app.use('/api', async (req, res, next) => {
  try {
    if (!req.cookies[sessionName]) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    const decoded = await auth.verifySessionCookie(req.cookies[sessionName], true);
    const state = await readState();
    const actor = normalizeUser(state.users.find(u => u.id === decoded.uid && u.active));
    if (!actor) return res.status(403).json({ error: 'El acceso de esta cuenta está desactivado.' });
    req.actor = actor; req.state = state; next();
  } catch { res.status(401).json({ error: 'La sesión ha vencido. Vuelve a ingresar.' }); }
});
app.get('/api/me', (req, res) => res.json({ user: req.actor }));
app.get('/api/state', (req, res) => res.json(visibleState(req.state, req.actor)));
app.post('/api/commands', async (req, res) => {
  if (req.body.type === 'user.save') throw new BusinessError('Utiliza la gestión de equipo para cambiar accesos.');
  const next = await transact(state => {
    const actor = state.users.find(u => u.id === req.actor.id);
    return applyCommand(state, req.body, actor);
  });
  res.json(visibleState(next, req.actor));
});
app.post('/api/users', async (req, res) => {
  if (!can(req.actor, 'user.save')) throw new BusinessError('Solo administración y gerencia pueden gestionar accesos.', 403);
  const { id, password, ...values } = req.body.payload || {};
  values.email = String(values.email || '').trim().toLowerCase();
  if (typeof req.body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(req.body.requestId)) throw new BusinessError('Identificador de operación no válido.');
  const userId = id || `employee-${createHash('sha256').update(req.body.requestId).digest('hex').slice(0, 32)}`;
  const command = { type: 'user.save', payload: { ...values, id: userId }, requestId: req.body.requestId };
  if (req.state.audit.some(a => a.id === req.body.requestId)) {
    const next = await transact(state => applyCommand(state, command, state.users.find(u => u.id === req.actor.id)));
    return res.json(visibleState(next, req.actor));
  }
  if (id && req.state.users.find(u => u.id === id)?.email !== values.email) throw new BusinessError('El correo de un acceso existente no se puede cambiar.');
  applyCommand(req.state, command, req.actor); // Validate before creating an Auth account.
  let created = null;
  try {
    if (!id) {
      if (typeof password !== 'string' || password.length < 10 || password.length > 100) throw new BusinessError('La contraseña inicial debe tener entre 10 y 100 caracteres.');
      // Deterministic UID makes parallel retries refer to the same local account.
      try { created = await auth.createUser({ uid: userId, email: values.email, password, displayName: values.name }); }
      catch (error) {
        if (error.code !== 'auth/uid-already-exists') throw error;
        const found = await auth.getUser(userId);
        if (found.email !== values.email) throw new BusinessError('La solicitud corresponde a otro acceso.', 409);
      }
    }
    const next = await transact(state => applyCommand(state, command, state.users.find(u => u.id === req.actor.id)));
    res.json(visibleState(next, req.actor));
  } catch (error) {
    if (created) {
      const latest = await readState();
      if (!latest.users.some(u => u.id === created.uid)) await auth.deleteUser(created.uid);
    }
    throw error;
  }
});
app.get('/api/reports/:kind', async (req, res) => {
  const s = visibleState(req.state, req.actor);
  const from = String(req.query.from || '0000-01-01');
  const to = String(req.query.to || '9999-12-31');
  const q = String(req.query.q || '').toLowerCase();
  if (req.query.format && !['csv','pdf'].includes(req.query.format)) throw new BusinessError('Selecciona PDF o CSV.');
  if (from > to) throw new BusinessError('El inicio del periodo debe ser anterior al fin.');
  const inRange = item => item.date >= from && item.date <= to;
  const name = id => s.contacts.find(x => x.id === id)?.name || '';
  const lot = id => s.lots.find(x => x.id === id)?.code || '';
  let headers, rows;
  if (['sales', 'cash', 'summary', 'monthly', 'balances'].includes(req.params.kind) && !can(req.actor, 'cash.read')) throw new BusinessError('Tu rol no tiene acceso a este reporte.', 403);
  const statistical = statisticsReport(req.params.kind,s,{from,to,q,financial:can(req.actor,'cash.read')});
  if (statistical) { headers=statistical.headers; rows=statistical.rows; }
  else if (req.params.kind === 'purchases' || req.params.kind === 'sales') {
    headers = ['Entorno', 'ID', 'Fecha', 'Contacto', 'Lote', 'Rendimiento pergamino', 'Peso kg', 'Divisor humedad', 'Unidades truncadas', 'Tarifa PEN', 'Unidad tarifa', 'Total PEN', 'Pagado o cobrado PEN', 'Saldo PEN', 'Estado', 'Clasificación de humedad', 'Tabla de humedad', 'Humedad aplicada %', 'Lectura original %', 'Origen divisor', 'Especificación divisor'];
    rows = s[req.params.kind].filter(inRange).filter(x => !req.query.status || req.query.status === 'all' || operationStatus(x,req.params.kind === 'purchases'?'purchase':'sale') === req.query.status).filter(x => `${x.id} ${name(x.contactId)} ${lot(x.lotId)}`.toLowerCase().includes(q)).map(x => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), x.id, x.date, name(x.contactId), lot(x.lotId), x.quality ?? '', x.grams / 1000, x.moistureDivisor ?? '', x.settlementUnits ?? '', x.unitPriceCents / 100, x.priceUnit || 'kg', x.totalCents / 100, x.paidCents / 100, ['anulado','devuelto'].includes(x.status) ? 0 : (x.totalCents - x.paidCents) / 100, operationStatus(x,req.params.kind==='purchases'?'purchase':'sale'), x.moistureClass || '', x.moistureTableVersion || '', x.moisture ?? '', x.measuredMoisture ?? '', x.moistureDivisorSource || '', x.moistureDivisorReason || '']);
  } else if (req.params.kind === 'inventory') {
    headers = ['Entorno', 'Lote', 'Presentación', 'Rendimiento pergamino', 'Procedencia', 'Fecha ingreso', 'Stock físico kg', 'Reservado kg', 'Disponible kg', 'Valor costo PEN', 'Humedad %', 'Lote origen', 'Estado', 'Clasificación de humedad', 'Divisor de humedad', 'Tabla de humedad', 'Lectura original %'];
    rows = s.lots.filter(x => x.status === 'activo').filter(x => !req.query.stage || req.query.stage === 'all' || x.stage === req.query.stage).filter(x => !req.query.availability || req.query.availability === 'all' || (req.query.availability === 'low' ? x.stockGrams < s.settings.lowStockGrams : x.stockGrams > 0)).filter(x => `${x.code} ${x.stage} ${x.origin}`.toLowerCase().includes(q)).map(x => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), x.code, x.stage, x.quality ?? '', x.origin, x.date, x.stockGrams / 1000, (x.reservedGrams||0)/1000, availableGrams(x)/1000, x.valueCents / 100, x.moisture ?? '', lot(x.parentId), x.status, x.moistureClass || '', x.moistureDivisor ?? '', x.moistureTableVersion || '', x.measuredMoisture ?? '']);
  } else if (req.params.kind === 'cash') {
    headers = ['Entorno', 'ID', 'Fecha', 'Concepto', 'Ingreso PEN', 'Egreso PEN', 'Medio', 'Origen', 'Estado'];
    rows = s.cash.filter(x => !req.query.method || x.method === req.query.method).filter(inRange).filter(x => !req.query.direction || req.query.direction === 'all' || (req.query.direction === 'income' ? x.signedCents > 0 : x.signedCents < 0)).filter(x => `${x.concept} ${x.method}`.toLowerCase().includes(q)).map(x => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), x.id, x.date, x.concept, Math.max(0, x.signedCents) / 100, Math.max(0, -x.signedCents) / 100, x.method, x.sourceType, x.status]);
  } else if (req.params.kind === 'processes') {
    headers = ['Entorno', 'Fecha', 'Lote entrada', 'Lote salida', 'Entrada kg', 'Salida kg', 'Merma kg', 'Rendimiento %', 'Estado', 'Tipo proceso', 'Especificación envío', 'Humedad entrada %', 'Humedad final %', 'Fecha pesaje final', 'Costo técnico secado PEN', 'Venta estimada PEN', 'Margen estimado PEN', 'Precio referencia rendimiento PEN', 'Valoración retorno PEN', 'Margen referencia retorno PEN'];
    rows = s.processes.filter(inRange).filter(x => `${lot(x.inputLotId)} ${lot(x.outputLotId)}`.toLowerCase().includes(q)).map(x => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), x.date, lot(x.inputLotId), lot(x.outputLotId), x.inputGrams / 1000, x.status==='secando'?'Pendiente':x.outputGrams / 1000, x.status==='secando'?'Pendiente':x.wasteGrams / 1000, x.status==='secando'?'Pendiente':Number((100 * x.outputGrams / x.inputGrams).toFixed(2)), x.status, x.kind || 'transformación', x.specification || '', x.inputMoisture ?? '', x.outputMoisture ?? '', x.completedDate || '', x.dryingCostCents == null?'':x.dryingCostCents/100, x.estimate?x.estimate.revenueCents/100:'', x.estimate?x.estimate.marginCents/100:'', x.referencePriceCents==null?'':x.referencePriceCents/100, x.referenceRevenueCents==null?'':x.referenceRevenueCents/100, x.referenceMarginCents==null?'':x.referenceMarginCents/100]);
  } else if (req.params.kind === 'summary') {
    const active = list => list.filter(isFulfilledOperation);
    const sum = (list, key) => list.reduce((n, x) => n + x[key], 0);
    const cash = s.cash.filter(inRange);
    headers = ['Entorno', 'Desde', 'Hasta', 'Indicador', 'Valor', 'Unidad'];
    rows = [
      ['Café en secado',sum(s.processes.filter(x=>x.status==='secando'),'inputGrams')/1000,'kg'],
      ['Ventas entregadas', sum(active(s.sales).filter(x => inRange({date:x.fulfilledDate || x.date})), 'totalCents') / 100, 'PEN'],
      ['Compras recibidas', sum(active(s.purchases).filter(x => inRange({date:x.fulfilledDate || x.date})), 'totalCents') / 100, 'PEN'],
      ['Ingresos de caja', sum(cash.filter(x => x.signedCents > 0), 'signedCents') / 100, 'PEN'],
      ['Egresos de caja', -sum(cash.filter(x => x.signedCents < 0), 'signedCents') / 100, 'PEN'],
      ['Saldo de caja al cierre', sum(s.cash.filter(x => x.date <= to), 'signedCents') / 100, 'PEN'],
      ['Existencias actuales', sum(s.lots, 'stockGrams') / 1000, 'kg'],
    ].map(x => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), from, to, ...x]);
  } else if (req.params.kind === 'audit') {
    if (!can(req.actor, 'audit.read')) throw new BusinessError('Tu rol no puede consultar auditoría.', 403);
    headers = ['Fecha y hora', 'Responsable', 'Correo', 'Rol', 'Acción', 'Tabla', 'Registro', 'Campos', 'Antes', 'Después', 'Operación'];
    rows = s.audit.flatMap(event => (event.changes?.length ? event.changes : [{ collection: event.type.startsWith('auth.') ? 'sessions' : event.type.split('.')[0], recordId: event.entityId, operation: 'event', fields: [], before: null, after: null }]).map(change => ({ event, change })))
      .filter(({ event, change }) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(event.at)) >= from && new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date(event.at)) <= to && (!req.query.actor || event.actorId === req.query.actor) && (!req.query.collection || change.collection === req.query.collection) && (!req.query.action || change.operation === req.query.action))
      .filter(({ event, change }) => `${event.actorName} ${event.description} ${change.recordId}`.toLowerCase().includes(q))
      .map(({ event, change }) => [event.at, event.actorName, event.actorEmail || '', event.actorRole || '', change.operation, change.collection, change.recordId, change.fields.join(', '), JSON.stringify(change.before), JSON.stringify(change.after), event.id]);
  } else if (req.params.kind === 'prices') {
    headers = ['Presentación', 'Rendimiento pergamino', 'Operación', 'Unidad tarifa', 'Precio autorizado PEN', 'Estado', 'Versión', 'Actualizado', 'Responsable'];
    rows = s.prices.filter(x => (!req.query.quality || String(x.quality) === req.query.quality) && (!req.query.stage || x.stage === req.query.stage) && (!req.query.kind || x.kind === req.query.kind) && (!req.query.active || String(x.active) === req.query.active)).map(x => [x.stage, x.quality ?? '', x.kind, x.unit, x.amountCents / 100, x.active ? 'Activo' : 'Inactivo', x.version, x.updatedAt, x.updatedBy]);
  } else throw new BusinessError('Reporte no encontrado.', 404);
  if (['audit','prices'].includes(req.params.kind)) { headers.unshift('Entorno'); rows = rows.map(row => [(production ? 'CHASQUERO COFFEE' : 'LOCAL DE PRUEBA'), ...row]); }
  if (req.query.format === 'pdf') {
    const buffer = await reportPdf({kind:req.params.kind,headers,rows,company:s.settings.name,environment:production?'EMPRESA':'DEMOSTRACIÓN LOCAL',period:from+' a '+to,user:req.actor.name,filters:Object.entries(req.query).filter(([k])=>!['format','from','to'].includes(k)).map(([k,v])=>k+': '+String(v)).join(' | ')});
    res.set('Content-Type','application/pdf');res.set('Content-Disposition',`attachment; filename="Chasquero_${req.params.kind}_${from}_${to}.pdf"`);return res.send(buffer);
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="Chasquero_${req.params.kind}_${from}_${to}.csv"`);
  res.send(csv(headers, rows));
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (String(error.code || '').startsWith('auth/') ? 400 : 500);
  const message = error.code === 'auth/email-already-exists' ? 'Ya existe una cuenta con ese correo.' : error.code === 'auth/invalid-email' ? 'El correo no es válido.' : status < 500 ? error.message : 'No se pudo completar la operación. Vuelve a intentarlo en unos momentos.';
  if (status >= 500) console.error('Fallo de API:', error.message);
  res.status(status).json({ error: message });
});
if (!production) app.listen(localConfig.apiPort, '127.0.0.1', () => console.log(`API de Chasquero Coffee lista en localhost:${localConfig.apiPort}`));
