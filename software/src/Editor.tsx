import { createRequestId } from './request-id.mjs';
import { useRef, useState, useEffect } from 'react';
import { availableGrams, operationStatus, isOpenOperation } from './workflow.mjs';
import { settlePergamino } from './settlement.mjs';
import { moistureRule } from './moisture.mjs';
import DryingEditor from './DryingEditor';
import { Check, LoaderCircle, ArrowRight, AlertTriangle } from 'lucide-react';
import { useApp } from './context';
import { Dialog, Badge } from './ui';
import { money, kg, dateLabel, contactName, lotCode, stageName, nextStage, roleName, isManager, isCash, isStock, today, number } from './lib';
import type { EditorSpec, Stage } from './types';

type Field = { key: string; label: string; type?: string; options?: { value: string; label: string }[]; required?: boolean; step?: string; min?: string; max?: string; wide?: boolean; readOnly?: boolean; hint?: string };
const paymentOptions = [{ value: 'efectivo', label: 'Efectivo' }, { value: 'transferencia', label: 'Transferencia' }, { value: 'yape', label: 'Yape' }, { value: 'plin', label: 'Plin' }];
const dateField: Field = { key: 'date', label: 'Fecha de operación', type: 'date', required: true };
const methodField: Field = { key: 'method', label: 'Medio de pago', options: paymentOptions };
const noteField: Field = { key: 'note', label: 'Observación', type: 'textarea', wide: true };
const amountField = (key: string, label: string): Field => ({ key, label, type: 'number', step: '0.01', min: '0', required: true });
const weightField = (key: string, label: string): Field => ({ key, label, type: 'number', step: '0.001', min: '0.001', required: true });

export default function Editor({ spec }: { spec: EditorSpec }) {
  const { data, user, command, close, notify, open } = useApp();
  const target = spec.target;
  const requestId = useRef<string | null>(null);
  if (requestId.current === null) requestId.current = createRequestId();
  const stableRequestId = requestId.current;
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = { date: today(), paid: '0', method: 'efectivo', stage: 'pergamino', type: user.area === 'caja' ? 'cliente' : 'proveedor', active: 'true', direction: 'egreso', role: 'trabajador', area: 'almacen', kind: 'venta', ...Object.fromEntries(Object.entries(target || {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v)])) };
    if (spec.kind === 'purchase' || spec.kind === 'sale') initial.deliveryStatus = spec.kind === 'purchase' ? 'comprado' : 'vendido';
    if (target?.quality != null) initial.quality = String(target.quality);
    if (target?.active !== undefined) initial.active = String(target.active);
    if (spec.kind === 'payment') initial.amount = ((target.totalCents - target.paidCents) / 100).toFixed(2);
    if (['void','payment','return','fulfill'].includes(spec.kind)) initial.date = today();
    if (spec.kind === 'price' || spec.kind === 'priceArchive') { initial.amount = target ? (target.amountCents / 100).toFixed(2) : ''; initial.version = String(target?.version || 0); initial.reason = ''; }
    return initial;
  });
  useEffect(() => {
    if (!['purchase', 'sale'].includes(spec.kind)) return;
    const stage = spec.kind === 'purchase' ? values.stage : data.lots.find(l => l.id === values.lotId)?.stage;
    const quality = stage === 'pergamino' ? (spec.kind === 'purchase' ? Number(values.quality) : data.lots.find(l => l.id === values.lotId)?.quality) : null;
    const needsDryQuote=spec.kind==='sale'&&data.lots.find(l=>l.id===values.lotId)?.dryingProcessId;
    const quote = data.prices.find(p => (!needsDryQuote||p.unit==='liquidacion')&& p.active && p.kind === (spec.kind === 'purchase' ? 'compra' : 'venta') && p.stage === stage && (p.quality ?? null) === quality);
    setValues(previous => ({ ...previous, price: quote ? (quote.amountCents / 100).toFixed(2) : '', priceId: quote?.id || '', priceVersion: String(quote?.version || ''), quotedCents: String(quote?.amountCents || 0), priceUnit:quote?.unit||(needsDryQuote?'liquidacion':'kg'), priceReason: '' }));
  }, [values.stage, values.quality, values.lotId, spec.kind]);
  useEffect(() => {
    if (spec.kind !== 'purchase' || values.stage !== 'pergamino') return;
    const rule=moistureRule(values.moisture);
    setValues(previous => ({...previous, moistureDivisor:rule?.divisorText || '', moistureClass:rule?.moistureClass || (Math.trunc(Number(values.moisture))>40?'Húmedo':'')}));
  }, [values.moisture, values.stage, spec.kind]);
  if (spec.kind === 'detail') return <Detail spec={spec}/>;
  if (['dryingStart','dryingFinish','dryingCancel'].includes(spec.kind)) return <DryingEditor spec={spec}/>;
  const supplierOptions = data.contacts.filter(x => x.active && x.type !== 'cliente').map(x => ({ value: x.id, label: x.name }));
  const customerOptions = data.contacts.filter(x => x.active && x.type !== 'proveedor').map(x => ({ value: x.id, label: x.name }));
  const lots = data.lots.filter(x => availableGrams(x) > 0 && x.status === 'activo');
  const lotOptions = lots.map(l => ({ value: l.id, label: `${l.code} · ${stageName[l.stage]}${l.stage === 'pergamino' ? ' · Rendimiento ' + (l.quality ?? 'sin clasificar') : ''} · ${kg(availableGrams(l))} disponibles` }));
  let fields: Field[] = []; let title = ''; let type = ''; let button = 'Guardar registro'; let explanation = '';
  if (spec.kind === 'purchase') {
    title = 'Registrar compra de café'; type = 'purchase.create'; button = 'Registrar compra';
    fields = [{ key: 'contactId', label: 'Productor o proveedor', options: supplierOptions, required: true, wide: true }, { key: 'lotCode', label: 'Código único del lote', required: true }, dateField, { key: 'stage', label: 'Presentación del café', options: Object.entries(stageName).map(([value, label]) => ({ value, label })) }, { key: 'origin', label: 'Procedencia', hint: 'Si lo dejas vacío, se usará la ubicación del proveedor.' }, weightField('quantity', 'Peso neto en kg'), { key: 'moisture', label: 'Humedad medida en %', type: 'number', step: '0.01', min: '0', max: '100' }, { ...amountField('price', 'Precio por kg en S/'), readOnly: user.role !== 'administrador', hint: user.role === 'administrador' ? 'Tarifa vigente. Un precio especial requiere motivo.' : 'Precio autorizado por administración.' }, ...(isCash(user) ? [amountField('paid', 'Pago inicial en S/'), methodField] : []), noteField];
    explanation = 'La compra crea el lote. El café recibido ingresa al inventario; el pendiente ingresará al confirmar la recepción. Solo el importe pagado genera un egreso de caja.';
  } else if (spec.kind === 'sale') {
    title = 'Registrar venta de café'; type = 'sale.create'; button = 'Registrar venta';
    fields = [{ key: 'contactId', label: 'Cliente', options: customerOptions, required: true, wide: true }, { key: 'lotId', label: 'Lote disponible', options: lotOptions, required: true, wide: true }, dateField, weightField('quantity', 'Cantidad a entregar en kg'), { ...amountField('price', 'Precio por kg en S/'), readOnly: user.role !== 'administrador', hint: user.role === 'administrador' ? 'Tarifa vigente. Un precio especial requiere motivo.' : 'Precio autorizado por administración.' }, amountField('paid', 'Cobro inicial en S/'), methodField, noteField];
    explanation = 'La venta descuenta café del lote. Un cobro parcial deja un saldo pendiente, sin duplicar el ingreso de dinero.';
  } else if (spec.kind === 'process') {
    title = 'Registrar procesamiento'; type = 'process.create'; button = 'Confirmar procesamiento';
    fields = [{ key: 'lotId', label: 'Lote de origen', options: lotOptions.filter(x => nextStage[lots.find(l => l.id === x.value)!.stage]), required: true, wide: true }, { key: 'lotCode', label: 'Código del nuevo lote', required: true }, dateField, weightField('inputQuantity', 'Peso de entrada en kg'), weightField('outputQuantity', 'Peso de salida en kg'), noteField];
    explanation = 'Registra los pesos medidos. El sistema calcula la merma y mantiene el vínculo entre ambos lotes. El rendimiento no utiliza una equivalencia fija.';
  } else if (spec.kind === 'contact') {
    title = target ? 'Editar contacto' : 'Nuevo contacto'; type = 'contact.save';
    fields = [{ key: 'name', label: 'Nombre completo o razón social', required: true, wide: true }, { key: 'type', label: 'Tipo de contacto', options: [{ value: 'proveedor', label: 'Productor o proveedor' }, { value: 'cliente', label: 'Cliente' }, { value: 'ambos', label: 'Cliente y proveedor' }].filter(x => user.area === 'almacen' ? x.value === 'proveedor' : user.area === 'caja' ? x.value === 'cliente' : true) }, { key: 'document', label: 'Documento de identificación', hint: 'Opcional. No se realiza validación tributaria.' }, { key: 'phone', label: 'Teléfono', type: 'tel' }, { key: 'location', label: 'Ubicación' }, { key: 'active', label: 'Estado', options: [{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }] }];
    explanation = 'Desactivar un contacto conserva el historial y evita seleccionarlo en nuevas operaciones.';
  } else if (spec.kind === 'payment') {
    title = spec.sourceType === 'sale' ? 'Registrar cobro' : 'Registrar pago'; type = 'payment.create'; button = title;
    fields = [dateField, amountField('amount', 'Monto del abono en S/'), methodField];
    explanation = `${contactName(data, target.contactId)} · Saldo pendiente ${money(target.totalCents - target.paidCents)}. El saldo y la caja se actualizan juntos.`;
  } else if (spec.kind === 'cash') {
    title = 'Nuevo movimiento de caja'; type = 'cash.create'; button = 'Registrar movimiento';
    fields = [{ key: 'direction', label: 'Tipo de movimiento', options: [{ value: 'egreso', label: 'Egreso' }, { value: 'ingreso', label: 'Ingreso' }] }, dateField, { key: 'concept', label: 'Concepto', required: true, wide: true }, amountField('amount', 'Monto en S/'), methodField];
    explanation = 'Usa esta opción para aportes, gastos y otros movimientos. Los cobros de ventas y pagos de compras se registran desde la operación correspondiente.';
  } else if (spec.kind === 'void') {
    title = spec.sourceType === 'cash' ? 'Revertir movimiento' : 'Anular operación'; type = spec.sourceType === 'cash' ? 'cash.void' : 'operation.void'; button = 'Confirmar anulación';
    fields = [dateField, { key: 'reason', label: 'Motivo de la anulación', required: true, type: 'textarea', wide: true }];
    explanation = 'Se conservará el registro original y su motivo. Las existencias y los pagos se compensarán cuando corresponda. No se permite anular un lote con salidas pendientes de revertir.';
  } else if (spec.kind === 'price') {
    title = target ? 'Actualizar precio del café' : 'Nuevo precio del café'; type = 'price.save'; button = target?.active === false ? 'Reactivar precio' : 'Guardar precio';
    fields = [{ key: 'stage', label: 'Presentación', options: Object.entries(stageName).map(([value,label])=>({value,label})), required: true }, { key: 'kind', label: 'Operación', options: [{value:'compra',label:'Compra'},{value:'venta',label:'Venta'}], required: true }, amountField('amount','Precio por kilogramo en S/'), {key:'reason',label:'Motivo del cambio',type:'textarea',required:true,wide:true,hint:'Al menos 5 caracteres. Quedará registrado en auditoría.'}];
    explanation = target ? `Precio anterior: ${money(target.amountCents)} por kg. Los movimientos anteriores conservarán su precio.` : 'Define una tarifa de compra o venta. Solo puede existir una tarifa activa por presentación y operación.';
  } else if (spec.kind === 'priceArchive') {
    title = 'Desactivar precio'; type = 'price.archive'; button = 'Confirmar baja del precio';
    fields = [{key:'reason',label:'Motivo de la baja',type:'textarea',required:true,wide:true}];
    explanation = `Se dará de baja el precio de ${target.kind} de ${stageName[target.stage as Stage]}. Permanecerán el historial y los movimientos anteriores.`;
  } else if (spec.kind === 'user') {
    title = target ? 'Editar acceso' : 'Crear acceso de empleado'; type = 'user.save'; button = target ? 'Guardar acceso' : 'Crear acceso';
    fields = [{ key: 'name', label: 'Nombre completo', required: true, wide: true }, { key: 'email', label: 'Correo para ingresar', type: 'email', required: true, readOnly: !!target, wide: true }, ...(!target ? [{ key: 'password', label: 'Contraseña inicial', type: 'password', required: true, wide: true, hint: 'Usa al menos 10 caracteres. Esta cuenta se crea en Firebase Authentication.' }] : []), { key: 'role', label: 'Rol de acceso', options: Object.entries(roleName).map(([value, label]) => ({ value, label })) }, ...(values.role === 'trabajador' ? [{ key: 'area', label: 'Área del trabajador', options: [{value:'almacen',label:'Almacén y producción'},{value:'caja',label:'Ventas y caja'}], required:true }] : []), { key: 'active', label: 'Estado', options: [{ value: 'true', label: 'Activo' }, { value: 'false', label: 'Inactivo' }] }];
    explanation = 'Cada rol tiene permisos comprobados por el servidor. Un acceso inactivo no puede utilizar el software.';
  }
  if (spec.kind === 'purchase' || spec.kind === 'sale') fields.splice(2,0,{key:'deliveryStatus',label:spec.kind==='purchase'?'Estado de recepción':'Estado de entrega',required:true,options:spec.kind==='purchase'?[{value:'comprado',label:'Comprado · café recibido'},{value:'pendiente',label:'Pendiente de recibir'}]:[{value:'vendido',label:'Vendido · café entregado'},{value:'pendiente',label:'Pendiente de entregar'}]});
  if (spec.kind === 'fulfill') {
    title = spec.sourceType === 'purchase' ? 'Confirmar recepción del café' : 'Confirmar entrega del café';
    type = spec.sourceType === 'purchase' ? 'purchase.receive' : 'sale.deliver'; button = 'Confirmar'; fields = [dateField];
    explanation = spec.sourceType === 'purchase' ? 'El lote completo ingresará al inventario. Esta acción no genera un pago.' : 'Se entregará la cantidad completa reservada. Esta acción no genera un cobro.';
  }
  if (spec.kind === 'return') {
    title = 'Registrar devolución completa'; type = 'operation.return'; button = 'Confirmar devolución';
    explanation = 'Se devuelve toda la operación y se compensan stock y pagos registrados. Confirma solo cuando se haya devuelto el café y reintegrado el dinero correspondiente.';
    fields=[dateField,{key:'reason',label:'Motivo de devolución',required:true,type:'textarea',wide:true},...(target.paidCents>0?[{key:'refundConfirmed',label:'Reintegro del dinero registrado',required:true,wide:true,options:[{value:'yes',label:'Confirmo el reintegro completo de '+money(target.paidCents)}]}]:[])];
  }
  const qualityField: Field = { key:'quality', label:'Rendimiento del café pergamino', required:true, options:Array.from({length:41},(_,i)=>({value:String(80-i),label:'Rendimiento ' + (80-i)})) };
  if (['purchase','price'].includes(spec.kind) && values.stage === 'pergamino') fields.splice(2,0,qualityField);
  if (spec.kind === 'purchase' && values.stage === 'pergamino') {
    fields = fields.map(f => f.key === 'quantity' ? {...f,label:'Peso bruto en kg'} : f.key === 'moisture' ? {...f,required:true,min:'1',hint:'Se toma la parte entera sin redondear: 14.9 % se calcula como 14 %. Se conserva la lectura original.'} : f.key === 'price' ? {...f,label:'Precio del rendimiento en S/'} : f);
    fields.splice(fields.findIndex(f=>f.key==='moisture')+1,0,
      {key:'moistureDivisor',label:'Divisor de humedad',type:'number',step:'0.01',readOnly:Math.trunc(Number(values.moisture))<=40,min:Math.trunc(Number(values.moisture))>40?'75.5':undefined,required:true,hint:Math.trunc(Number(values.moisture))>40?'Manual para humedad superior a 40 %. No puede bajar de 75.5.':'Automático según la tabla de la empresa. Se conserva en la compra.'},
      {key:'moistureClass',label:'Clasificación de humedad',readOnly:true,hint:'Seco, Semi seco o Húmedo según la tabla confirmada.'});
    if(Math.trunc(Number(values.moisture))>40)fields.push({key:'moistureDivisorReason',label:'Especificación del divisor manual y del lote',required:true,type:'textarea',wide:true,hint:'Describe el criterio aplicado. El lote, el encargado y el divisor quedarán registrados.'});
    explanation = 'Peso bruto ÷ divisor: se toman solo dos decimales. Se multiplica por el precio del rendimiento y se pagan únicamente soles enteros.';
  }
  if(spec.kind==='price'&&values.stage==='pergamino'&&values.kind==='venta')fields.push({key:'unit',label:'Unidad del precio de venta',required:true,options:[{value:'kg',label:'Precio por kilo (operaciones existentes)'},{value:'liquidacion',label:'Precio del rendimiento (para lotes secados)'}],hint:'El lote que regresa del secado se vende con la fórmula de liquidación.'});
  if (spec.kind === 'price' && values.stage === 'pergamino' && (values.kind === 'compra'||values.unit==='liquidacion')) {
    fields = fields.map(f=>f.key==='amount'?{...f,label:'Precio del rendimiento en S/'}:f);
    explanation = 'Tarifa para liquidar compras según rendimiento analizado. No es un precio por kilo. Las operaciones anteriores conservan sus importes.';
  }
  if (spec.kind === 'lotQuality') {
    title = 'Clasificar lote de pergamino'; type = 'lot.classify'; button = 'Guardar rendimiento';
    explanation = 'La clasificación se aplica al lote para las siguientes ventas. Las operaciones históricas conservan sus importes.';
    fields = [qualityField, {key:'reason',label:'Motivo de la clasificación',type:'textarea',required:true,wide:true}];
  }
  if (['purchase','sale'].includes(spec.kind) && user.role === 'administrador') fields.push({key:'priceReason',label:'Motivo del precio especial',type:'textarea',wide:true,required: !values.priceId || Math.round(Number(values.price)*100) !== Number(values.quotedCents),hint:'Obligatorio cuando el importe difiere de la tarifa autorizada.'});
  const source = data.lots.find(l => l.id === values.lotId);
  if ((spec.kind === 'sale' || spec.kind === 'process') && source) {
    fields = fields.map(f => f.key === (spec.kind === 'sale' ? 'quantity' : 'inputQuantity')
      ? { ...f, max: (availableGrams(source) / 1000).toFixed(3), hint: 'No puede superar las existencias disponibles del lote.' } : f);
  }
  if (spec.kind === 'payment') fields = fields.map(f => f.key === 'amount'
    ? { ...f, min: '0.01', max: ((target.totalCents - target.paidCents) / 100).toFixed(2) } : f);
  if (spec.kind === 'cash') fields = fields.map(f => f.key === 'amount' ? { ...f, min: '0.01' } : f);
  const saleLot=spec.kind==='sale'?data.lots.find(l=>l.id===values.lotId):null;
  const liquidatedSale=spec.kind==='sale'&&saleLot?.stage==='pergamino'&&(!!saleLot.dryingProcessId||values.priceUnit==='liquidacion');
  if(liquidatedSale){fields=fields.map(f=>f.key==='price'?{...f,label:'Precio del rendimiento seco en S/',hint:'Peso ÷ divisor × precio del rendimiento. Requiere una tarifa por rendimiento autorizada.'}:f);explanation='El lote seco conserva su costo de compra y secado. La venta usa la fórmula del rendimiento, con dos decimales truncados y soles enteros.';}
  const selectedMoistureRule=spec.kind==='purchase' && values.stage==='pergamino' ? moistureRule(values.moisture,values.moistureDivisor) : liquidatedSale?moistureRule(saleLot?.moisture,saleLot?.moistureDivisor):null;
  const missingMoistureRule=((spec.kind==='purchase'&&values.stage==='pergamino')||liquidatedSale)&&!selectedMoistureRule;
  let settlement: ReturnType<typeof settlePergamino> | null = null;
  if (selectedMoistureRule) { try { settlement = settlePergamino(values.quantity, selectedMoistureRule.divisorText, values.price); } catch {} }
  const total = ((spec.kind === 'purchase' && values.stage === 'pergamino')||liquidatedSale) ? settlement?.totalCents || 0 : Math.round(Number(values.quantity || 0) * Number(values.price || 0) * 100);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    const payload: any = { ...values };
    if ((spec.kind === 'price' || spec.kind === 'priceArchive' || spec.kind === 'lotQuality' || spec.kind === 'fulfill') && target) payload.id = target.id;
    if (spec.kind === 'contact' || spec.kind === 'user') { payload.active = values.active === 'true'; if (target) payload.id = target.id; }
    if (spec.kind === 'process') payload.stage = source ? nextStage[source.stage] : undefined;
    if (spec.kind === 'payment' || spec.kind === 'void' || spec.kind === 'return') { payload.sourceType = spec.sourceType; payload.sourceId = target.id; if (spec.sourceType === 'cash') payload.id = target.id; }
    try {
      if (spec.kind === 'user' && target?.active && !payload.active && !window.confirm(`¿Desactivar el acceso de ${target.name}? Su historial se conservará.`)) { setBusy(false); return; }
      await command(type, payload, stableRequestId); close(); notify('Registro guardado. Los datos del sistema se actualizaron.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); setBusy(false); }
  }
  return <Dialog title={title} subtitle={explanation} onClose={close} busy={busy} wide><form onSubmit={submit}><div className="form-grid">{fields.map(f => <label key={f.key} className={`field ${f.wide ? 'full' : ''}`}><span>{f.label}{f.required && <b aria-hidden="true"> *</b>}</span>{f.options ? <select required={f.required} value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}><option value="" disabled>Seleccionar</option>{f.options.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select> : f.type === 'textarea' ? <textarea rows={3} maxLength={300} required={f.required} value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}/> : <input type={f.type || 'text'} required={f.required} step={f.step} min={f.min} max={f.max} readOnly={f.readOnly} maxLength={f.key === 'password' ? 100 : 180} value={values[f.key] || ''} onChange={e => setValues({ ...values, [f.key]: e.target.value })}/>} {f.hint && <small>{f.hint}</small>}</label>)}</div>{(spec.kind === 'purchase' || spec.kind === 'sale') && <div className="form-summary"><span>{settlement ? 'Pago en soles enteros' : 'Total de la operación'}</span>{selectedMoistureRule && <small>Lectura: {selectedMoistureRule.measuredMoisture} % · Humedad aplicada: {selectedMoistureRule.moisture} % · {selectedMoistureRule.moistureClass}</small>}{settlement && <small>{values.quantity} kg ÷ {selectedMoistureRule?.divisor} → {settlement.settlementUnits} × {money(Math.round(Number(values.price)*100))} = {money(settlement.calculatedCents)} · Sin redondear</small>}<strong>{money(Number.isFinite(total) ? total : 0)}</strong><small>Saldo pendiente: {money(Math.max(0, (Number.isFinite(total) ? total : 0) - Math.round(Number(values.paid || 0) * 100)))}</small></div>}{spec.kind === 'process' && source && <div className="form-summary"><span>{stageName[source.stage]} <ArrowRight size={14}/> {stageName[nextStage[source.stage] as Stage]}</span><strong>Merma {number(Math.max(0, Number(values.inputQuantity || 0) - Number(values.outputQuantity || 0)), 3)} kg</strong><small>Existencias del lote: {kg(source.stockGrams)}</small></div>}{missingMoistureRule && values.moisture && <div role="status" className="form-error">Registra una humedad válida. Hasta 40 % se aplica la tabla a la parte entera; por encima, el divisor manual debe ser al menos 75.5.</div>}{error && <div role="alert" className="form-error"><AlertTriangle size={18}/>{error}</div>}<div className="dialog-actions"><button type="button" className="button" disabled={busy} onClick={close}>Cancelar</button><button className={`button ${['void', 'priceArchive', 'return'].includes(spec.kind) ? 'danger' : 'primary'}`} type="submit" disabled={busy || missingMoistureRule}>{busy ? <LoaderCircle className="spin" size={17}/> : <Check size={17}/>} {busy ? 'Guardando…' : button}</button></div></form></Dialog>;
}

function Detail({ spec }: { spec: EditorSpec }) {
  const { data, user, close, open } = useApp(); const t = spec.target; const sourceType = spec.sourceType;
  let title = ''; let entries: [string, string][] = []; let amount = '';
  if (sourceType === 'lot') {
    title = t.code; amount = kg(t.stockGrams);
    entries = [['Presentación', stageName[t.stage as Stage]], ['Rendimiento del pergamino', t.stage === 'pergamino' ? (t.quality == null ? 'Sin clasificar' : String(t.quality)) : 'No aplica'], ['Ingreso', dateLabel(t.date)], ['Procedencia', t.origin], ['Productor', contactName(data, t.contactId)], ['Humedad aplicada', t.moisture === null ? 'No registrada' : `${t.moisture} %`], ['Lectura original',t.measuredMoisture == null ? 'No registrada por separado' : `${t.measuredMoisture} %`], ['Clasificación de humedad', t.moistureClass || 'No registrada'], ['Divisor de humedad',t.moistureDivisor == null ? 'No aplica / no registrado' : String(t.moistureDivisor)], ['Costo del inventario', money(t.valueCents)], ['Lote de origen', t.parentId ? lotCode(data, t.parentId) : 'Compra directa'], ['Peso inicial', kg(t.initialGrams)]];
  } else if (sourceType === 'process') {
    title = t.kind==='secado'?'Detalle del secado':'Detalle de procesamiento'; amount = t.status==='secando'?'En secado · '+kg(t.inputGrams):`${number(100 * t.outputGrams / t.inputGrams)} % de retorno físico`;
    entries = [['Fecha', dateLabel(t.date)], ['Lote de origen', lotCode(data, t.inputLotId)], ['Lote de salida', t.status==='secando'?'Pendiente de regreso':lotCode(data, t.outputLotId)], ['Peso de entrada', kg(t.inputGrams)], ['Peso de salida',t.status==='secando'?'Pendiente de pesaje':kg(t.outputGrams)], ['Merma registrada',t.status==='secando'?'Pendiente de pesaje':kg(t.wasteGrams)],...(t.kind==='secado'?[['Especificación del envío',t.specification],['Humedad de entrada',`${t.inputMoisture} %`],['Rendimiento analizado de entrada',String(t.inputQuality??'Sin clasificar')],['Rendimiento analizado al retorno',String(t.outputQuality??'Pendiente')],['Humedad final',t.outputMoisture==null?'Pendiente':`${t.outputMoisture} %`],['Pesaje final',t.completedDate?dateLabel(t.completedDate):'Pendiente'],['Costo técnico del secado',t.dryingCostCents==null?'Pendiente':money(t.dryingCostCents)],['Margen estimado antes del envío',t.estimate?money(t.estimate.marginCents):'Sin estimación'],['Valoración de referencia al retorno',t.referenceRevenueCents==null?'Pendiente':money(t.referenceRevenueCents)],['Margen de referencia al retorno',t.referenceMarginCents==null?'Pendiente':money(t.referenceMarginCents)],['Observación final',t.completionNote||'—']] as [string,string][]:[])];
  } else if (sourceType === 'cash') {
    title = 'Detalle de caja'; amount = money(t.signedCents);
    entries = [['Fecha', dateLabel(t.date)], ['Concepto', t.concept], ['Medio de pago', t.method], ['Origen', ({ purchase: 'Pago de compra', sale: 'Cobro de venta', manual: 'Movimiento manual', reversal: 'Reversión' } as any)[t.sourceType] || t.sourceType], ['Estado', t.status]];
  } else {
    title = sourceType === 'purchase' ? 'Detalle de compra' : 'Detalle de venta'; amount = money(t.totalCents);
    entries = [['Fecha', dateLabel(t.date)], [sourceType === 'purchase' ? 'Productor o proveedor' : 'Cliente', contactName(data, t.contactId)], ['Lote', lotCode(data, t.lotId)], ['Cantidad', kg(t.grams)], ['Rendimiento del pergamino', t.quality == null ? 'No registrada / no aplica' : String(t.quality)], [t.priceUnit === 'liquidacion' ? 'Precio del rendimiento' : 'Precio por kg', money(t.unitPriceCents)], ...(t.settlementRule ? [['Humedad aplicada',t.moisture == null ? 'No registrada' : String(t.moisture)+' %'],['Lectura original',t.measuredMoisture == null ? 'No registrada por separado' : String(t.measuredMoisture)+' %'],['Clasificación de humedad',t.moistureClass || 'No registrada'],['Tabla de humedad',t.moistureTableVersion || 'Histórica'],['Divisor de humedad',String(t.moistureDivisor)],['Origen del divisor',t.moistureDivisorSource||'Histórico'],['Especificación manual',t.moistureDivisorReason||'No aplica'],['Resultado truncado',String(t.settlementUnits)],['Importe antes de descartar céntimos',money(t.calculatedCents)]] as [string,string][] : []), ['Importe abonado', money(t.paidCents)], ['Saldo pendiente', money(!isOpenOperation(t) ? 0 : t.totalCents - t.paidCents)], ['Estado logístico', operationStatus(t,sourceType)], ['Recepción / entrega',t.fulfilledDate?dateLabel(t.fulfilledDate):'No registrada'], ['Motivo de devolución',t.returnReason||'No aplica']];
  }
  const payments = data.cash.filter(c => c.sourceId === t.id);
  return <Dialog title={title} subtitle="Consulta el registro y sus movimientos relacionados." onClose={close} wide><div className="detail-amount"><strong>{amount}</strong><Badge tone={t.status === 'anulado' ? 'red' : 'green'}>{t.status==='secando'?'En secado':t.status}</Badge></div><dl className="detail-grid">{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>{sourceType==='lot'&&data.processes.filter(p=>p.status==='secando'&&p.inputLotId===t.id).map(p=><p className="detail-note" role="status" key={p.id}>Enviado a secado el {dateLabel(p.date)}: {kg(p.inputGrams)}. Humedad inicial: {p.inputMoisture} %. {p.specification}. El peso enviado está bloqueado hasta registrar el retorno.</p>)}{sourceType==='process'&&t.kind==='secado'&&<p className="detail-note">Salió el {dateLabel(t.date)} con {kg(t.inputGrams)} y humedad {t.inputMoisture} %. Encargado: {t.createdByName||data.users.find(u=>u.id===t.createdBy)?.name||t.createdBy}. {t.status==='secando'?'Pendiente de regreso: este envío no admite cambios ni ventas.':'El pesaje final conserva el vínculo con la compra original.'}</p>}{t.note && <p className="detail-note">{t.note}</p>}{t.voidReason && <p className="detail-note">Motivo de anulación: {t.voidReason}</p>}{payments.length > 0 && <div className="related"><h3>Movimientos de caja relacionados</h3>{payments.map(p => <button key={p.id} onClick={() => open({ kind: 'detail', sourceType: 'cash', target: p })}><span>{dateLabel(p.date)}<small>{p.concept}</small></span><strong>{money(p.signedCents)}</strong></button>)}</div>}{sourceType === 'lot' && t.parentId && <button className="button" onClick={() => open({ kind: 'detail', sourceType: 'lot', target: data.lots.find(l => l.id === t.parentId) })}>Ver lote de origen <ArrowRight size={16}/></button>}<div className="dialog-actions">{sourceType==='process'&&t.status==='secando'&&isStock(user)&&<button className="button primary" onClick={()=>open({kind:'dryingFinish',target:t})}>Registrar pesaje final</button>}{sourceType==='process'&&t.status==='secando'&&isManager(user.role)&&<button className="button danger-quiet" onClick={()=>open({kind:'dryingCancel',target:t})}>Cancelar envío a secado</button>}{sourceType==='lot'&&t.status==='activo'&&t.stage==='pergamino'&&t.moisture>=16&&availableGrams(t)>0&&isStock(user)&&<button className="button primary" onClick={()=>open({kind:'dryingStart',target:t})}>Analizar y enviar a secado</button>}{user.role === 'administrador' && sourceType === 'lot' && t.stage === 'pergamino' && t.quality == null && <button className="button primary" onClick={() => open({kind:'lotQuality',target:t})}>Asignar rendimiento al lote</button>}{(sourceType==='purchase'||sourceType==='sale') && isOpenOperation(t) && t.deliveryStatus==='pendiente' && (sourceType==='purchase'?isStock(user):isCash(user)) && <button className="button primary" onClick={()=>open({kind:'fulfill',sourceType,target:t})}>{sourceType==='purchase'?'Confirmar recepción':'Confirmar entrega'}</button>}{isManager(user.role)&&(sourceType==='purchase'||sourceType==='sale')&&isOpenOperation(t)&&t.deliveryStatus!=='pendiente'&&<button className="button danger-quiet" onClick={()=>open({kind:'return',sourceType,target:t})}>Devolver operación completa</button>}{isManager(user.role) && sourceType !== 'lot' && ['registrado','devuelto'].includes(t.status) && (sourceType !== 'cash' || t.sourceType === 'manual') && <button className="button danger-quiet" onClick={() => open({ kind: 'void', sourceType, target: t })}>{sourceType === 'cash' ? 'Revertir movimiento' : 'Anular operación'}</button>}{isCash(user) && (sourceType === 'purchase' || sourceType === 'sale') && isOpenOperation(t) && t.totalCents > t.paidCents && <button className="button primary" onClick={() => open({ kind: 'payment', sourceType, target: t })}>{sourceType === 'purchase' ? 'Registrar pago' : 'Registrar cobro'}</button>}<button className="button" onClick={close}>Cerrar</button></div></Dialog>;
}
