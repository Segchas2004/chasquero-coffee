import { createHash } from 'node:crypto';
import { settlePergamino } from '../src/settlement.mjs';
import { moistureRule } from '../src/moisture.mjs';
import { dryingEstimate } from '../src/drying.mjs';
import { availableGrams, isOpenOperation } from '../src/workflow.mjs';

import { ROLES, AREAS, can, normalizeUser, isManagement } from './policy.mjs';
import { recordAudit } from './audit.mjs';
export { ROLES, can, normalizeUser } from './policy.mjs';
export const STAGES = ['coco', 'pergamino', 'verde', 'tostado', 'molido'];
export const COLLECTIONS = ['contacts', 'lots', 'purchases', 'sales', 'processes', 'cash', 'audit', 'users', 'prices'];
export class BusinessError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const requireThat = (condition, message, status = 400) => { if (!condition) throw new BusinessError(message, status); };
const text = (value, label, max = 160, required = true) => {
  const result = String(value ?? '').trim();
  requireThat((!required || result.length > 0) && result.length <= max, `${label}: completa el campo con un máximo de ${max} caracteres.`);
  return result;
};
export function decimal(value, digits, label, allowZero = false) {
  const str = String(value ?? '').trim();
  requireThat(new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`).test(str), `${label}: utiliza un número positivo con hasta ${digits} decimales.`);
  const result = Math.round(Number(str) * 10 ** digits);
  requireThat(Number.isSafeInteger(result) && result <= 1000000000 && (allowZero ? result >= 0 : result > 0), `${label}: el importe o peso está fuera del rango permitido.`);
  return result;
}
function day(value) {
  const v = text(value, 'Fecha', 10);
  requireThat(/^\d{4}-\d{2}-\d{2}$/.test(v), 'La fecha no es válida.');
  const date = new Date(v + 'T00:00:00Z');
  requireThat(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v, 'La fecha no existe en el calendario.');
  return v;
}
function record(state, collection, id) {
  const result = state[collection].find(x => x.id === id);
  requireThat(result, 'No se encontró el registro solicitado.', 404);
  return result;
}
function activeContact(state, id, type) {
  const c = record(state, 'contacts', id);
  requireThat(c.active && (c.type === type || c.type === 'ambos'), `Selecciona un ${type === 'proveedor' ? 'productor o proveedor' : 'cliente'} activo.`);
  return c;
}
function activeLot(state, id, grams) {
  const lot = record(state, 'lots', id);
  requireThat(lot.status !== 'anulado' && availableGrams(lot) >= grams, 'La cantidad supera las existencias disponibles del lote.');
  return lot;
}
function allocateCost(lot, grams) {
  return grams === lot.stockGrams ? lot.valueCents : Math.round(lot.valueCents * grams / lot.stockGrams);
}
function totalFor(grams, cents) {
  requireThat(Number.isSafeInteger(grams * cents), 'La combinación de cantidad y precio supera el máximo permitido.');
  const amount = Math.round(grams * cents / 1000);
  requireThat(amount > 0, 'El total debe ser de al menos S/ 0.01.');
  return amount;
}
export function coffeeQuality(stage, value) {
  if (stage !== 'pergamino') return null;
  requireThat(value !== undefined && value !== null && String(value).trim() !== '', 'Selecciona la calidad del café pergamino (80 a 40).');
  const quality = Number(value);
  requireThat(Number.isInteger(quality) && quality >= 40 && quality <= 80, 'La calidad del pergamino debe ser un entero entre 40 y 80.');
  return quality;
}
function quotedPrice(state, actor, payload, kind, stage, quality, expectedUnit) {
  let price = state.prices?.find(x => x.active && x.kind === kind && x.stage === stage && (x.quality ?? null) === quality);
  if(expectedUnit && price?.unit!==expectedUnit)price=undefined;
  if (stage === 'pergamino' && kind === 'compra' && price) requireThat(price.unit === 'liquidacion', 'Actualiza esta tarifa antigua como precio por rendimiento antes de registrar compras.');
  const cents = decimal(payload.price, 2, 'Precio autorizado');
  if (payload.priceId) {
    requireThat(price && price.id === payload.priceId && price.version === Number(payload.priceVersion), 'El precio cambió o fue desactivado. Actualiza los datos y vuelve a abrir la operación.', 409);
  }
  if (actor.role !== 'administrador') {
    requireThat(price && payload.priceId === price.id && cents === price.amountCents, 'Utiliza el precio vigente autorizado por administración.', 403);
  } else if (!price || cents !== price.amountCents) {
    requireThat(String(payload.priceReason || '').trim().length >= 5, 'Indica el motivo del precio especial autorizado por administración.');
  }
  return { quality, priceUnit: price?.unit || expectedUnit || (stage === 'pergamino' && kind === 'compra' ? 'liquidacion' : 'kg'), unitPriceCents: cents, priceId: price?.id || null, priceVersion: price?.version || null, priceReason: text(payload.priceReason, 'Motivo del precio', 240, false) };
}
export function emptyState() {
  return {
    ...Object.fromEntries(COLLECTIONS.map(k => [k, []])),
    settings: { id: 'company', name: 'Chasquero Coffee', location: 'C. P. Las Pirias, Chirinos, San Ignacio, Cajamarca', director: 'Norberto Chasquero Ocaña', mapsUrl: 'https://maps.app.goo.gl/9hhxUobbbBZBfEkX8', lowStockGrams: 50000, demo: true },
  };
}

/** All business writes pass through this deterministic reducer and one Firestore transaction. */
export function applyCommand(previous, command, actor, now = new Date().toISOString()) {
  actor = normalizeUser(actor);
  requireThat(actor?.active && ROLES.includes(actor.role), 'La cuenta está inactiva o no tiene un rol válido.', 403);
  const { type, payload: p = {}, requestId } = command;
  requireThat(can(actor, type), 'Tu rol no tiene permiso para realizar esta acción.', 403);
  requireThat(typeof requestId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestId), 'Identificador de operación no válido.');
  const fingerprint = createHash('sha256').update(JSON.stringify({ type, payload: p })).digest('hex');
  const existing = previous.audit.find(a => a.id === requestId);
  if (existing) {
    requireThat(existing.fingerprint === fingerprint && existing.actorId === actor.id, 'El identificador ya se utilizó para otra operación.', 409);
    return previous;
  }
  const state = structuredClone(previous);
  const id = requestId;
  const stamp = { createdAt: now, createdBy: actor.id };
  let description = '';
  let entityId = id;
  function addCash(signedCents, date, concept, method, sourceType, sourceId, suffix = 'cash') {
    const paymentMethod = text(method || 'efectivo', 'Medio de pago', 30);
    requireThat(['efectivo', 'transferencia', 'yape', 'plin'].includes(paymentMethod), 'Medio de pago no válido.');
    state.cash.push({ id: `${id}-${suffix}`, date, signedCents, concept, method: paymentMethod, sourceType, sourceId, status: 'registrado', ...stamp });
  }

  if (type === 'contact.save') {
    const contactType = p.type;
    requireThat(['proveedor', 'cliente', 'ambos'].includes(contactType), 'Tipo de contacto no válido.');
    requireThat(actor.area !== 'almacen' || contactType === 'proveedor', 'Almacén solo puede gestionar productores y proveedores.', 403);
    requireThat(actor.area !== 'caja' || contactType === 'cliente', 'Caja solo puede gestionar clientes.', 403);
    const item = {
      id: p.id || id, name: text(p.name, 'Nombre', 120), type: contactType,
      document: text(p.document, 'Documento', 20, false), phone: text(p.phone, 'Teléfono', 25, false),
      location: text(p.location, 'Ubicación', 160, false), active: p.active !== false,
    };
    const old = p.id ? record(state, 'contacts', p.id) : null;
    if (old) {
      requireThat(isManagement(actor) || old.type === contactType, 'No puedes cambiar el tipo de este contacto.', 403);
      Object.assign(old, item, { updatedAt: now });
    } else state.contacts.push({ ...item, ...stamp });
    entityId = item.id; description = `${old ? 'Actualizó' : 'Registró'} contacto ${item.name}`;
  }

  if (type === 'purchase.create') {
    const supplier = activeContact(state, p.contactId, 'proveedor');
    requireThat(!p.deliveryStatus || ['pendiente','comprado'].includes(p.deliveryStatus), 'Estado de compra no válido.');
    const pending = p.deliveryStatus === 'pendiente';
    const date = day(p.date);
    const grams = decimal(p.quantity, 3, 'Peso bruto en kg');
    const quality = coffeeQuality(p.stage, p.quality);
    const quote = quotedPrice(state, actor, p, 'compra', p.stage, quality);
    const { unitPriceCents } = quote;
    let settlement = {};
    if (p.stage === 'pergamino') {
      requireThat(p.moisture !== '' && p.moisture != null, 'Registra la humedad medida del café pergamino.');
      const rule=moistureRule(p.moisture,p.moistureDivisor);
      requireThat(rule, 'Esta humedad no tiene un divisor confirmado. Por encima de 40 %, registra un divisor manual igual o mayor a 75.5.');
      const divisorReason=rule.moistureDivisorSource==='manual'?text(p.moistureDivisorReason,'Especificación del divisor manual y del lote',240):'';
      if(p.moistureDivisor!==undefined && p.moistureDivisor!=='') {
        requireThat(decimal(p.moistureDivisor,2,'Divisor de humedad')===rule.divisorHundredths,
          'El divisor no coincide con la tabla de humedad vigente. Actualiza los datos y vuelve a abrir la compra.',409);
      }
      try { settlement = {...settlePergamino(p.quantity, rule.divisorText, p.price), moisture:rule.moisture, measuredMoisture:rule.measuredMoisture, moistureClass:rule.moistureClass, moistureTableVersion:rule.moistureTableVersion, moistureDivisorSource:rule.moistureDivisorSource, moistureDivisorReason:divisorReason}; } catch (error) { throw new BusinessError(error.message); }
      requireThat(settlement.totalCents > 0, 'La liquidación no genera soles enteros a pagar.');
    }
    const totalCents = p.stage === 'pergamino' ? settlement.totalCents : totalFor(grams, unitPriceCents);
    const paidCents = decimal(p.paid || '0', 2, 'Pago inicial', true);
    requireThat(paidCents <= totalCents, 'El pago inicial no puede superar el total de la compra.');
    requireThat(actor.area !== 'almacen' || paidCents === 0, 'Los pagos deben ser registrados por caja o administración.', 403);
    requireThat(STAGES.includes(p.stage), 'Selecciona una presentación de café válida.');
    const code = text(p.lotCode, 'Código de lote', 30).toUpperCase();
    requireThat(!state.lots.some(l => l.code === code), 'Ese código de lote ya existe. Utiliza otro código.');
    const moisture = p.stage === 'pergamino' ? settlement.moisture : p.moisture === '' || p.moisture == null ? null : decimal(p.moisture, 2, 'Humedad', true) / 100;
    requireThat(moisture === null || moisture <= 100, 'La humedad debe estar entre 0 y 100 %.');
    const lotId = `${id}-lot`;
    state.lots.push({ id: lotId, code, stage: p.stage, quality, ...(p.stage === 'pergamino' ? {measuredMoisture:settlement.measuredMoisture,moistureDivisor:settlement.moistureDivisor,moistureClass:settlement.moistureClass,moistureTableVersion:settlement.moistureTableVersion} : {}), stockGrams: pending ? 0 : grams, reservedGrams: 0, initialGrams: grams, valueCents: pending ? 0 : totalCents, initialCostCents: totalCents, contactId: supplier.id, origin: text(p.origin || supplier.location || 'Las Pirias', 'Procedencia', 120), moisture, date, parentId: null, status: pending ? 'pendiente' : 'activo', ...stamp });
    state.purchases.push({ id, date, contactId: supplier.id, lotId, grams, ...quote, ...settlement, ...(p.stage === 'pergamino' ? {moisture} : {}), totalCents, paidCents, deliveryStatus: pending ? 'pendiente' : 'comprado', status: 'registrado', note: text(p.note, 'Observación', 300, false), ...stamp });
    if (paidCents) addCash(-paidCents, date, `Pago de compra ${code}`, p.method, 'purchase', id);
    description = `Registró compra del lote ${code}`;
  }

  if (type === 'sale.create') {
    const customer = activeContact(state, p.contactId, 'cliente');
    requireThat(!p.deliveryStatus || ['pendiente','vendido'].includes(p.deliveryStatus), 'Estado de venta no válido.');
    const pending = p.deliveryStatus === 'pendiente';
    const grams = decimal(p.quantity, 3, 'Cantidad en kg');
    const lot = activeLot(state, p.lotId, grams);
    const date = day(p.date);
    requireThat(date >= lot.date, 'La venta no puede ser anterior al ingreso del lote.');
    const quality = coffeeQuality(lot.stage, lot.quality);
    requireThat(p.quality === undefined || coffeeQuality(lot.stage, p.quality) === quality, 'La calidad de venta debe coincidir con el lote.');
    const quote = quotedPrice(state, actor, p, 'venta', lot.stage, quality,lot.dryingProcessId?'liquidacion':undefined);
    const { unitPriceCents } = quote;
    let settlement={};
    if(lot.stage==='pergamino'&&quote.priceUnit==='liquidacion'){
      const rule=moistureRule(lot.moisture,lot.moistureDivisor);requireThat(rule,'El lote no tiene una humedad y divisor válidos para liquidar la venta.');
      try{settlement={...settlePergamino(p.quantity,rule.divisorText,p.price),moisture:rule.moisture,measuredMoisture:lot.measuredMoisture??lot.moisture,moistureClass:rule.moistureClass,moistureTableVersion:rule.moistureTableVersion};}catch(error){throw new BusinessError(error.message);}
      requireThat(settlement.totalCents>0,'La liquidación no genera soles enteros para la venta.');
    }
    const totalCents = quote.priceUnit==='liquidacion'?settlement.totalCents:totalFor(grams, unitPriceCents);
    const paidCents = decimal(p.paid || '0', 2, 'Cobro inicial', true);
    requireThat(paidCents <= totalCents, 'El cobro inicial no puede superar el total de la venta.');
    const costCents = pending ? 0 : allocateCost(lot, grams);
    if (pending) lot.reservedGrams = (lot.reservedGrams || 0) + grams;
    else { lot.stockGrams -= grams; lot.valueCents -= costCents; }
    state.sales.push({ id, date, contactId: customer.id, lotId: lot.id, grams, ...quote, ...settlement, totalCents, paidCents, costCents, deliveryStatus: pending ? 'pendiente' : 'vendido', status: 'registrado', note: text(p.note, 'Observación', 300, false), ...stamp });
    if (paidCents) addCash(paidCents, date, `Cobro de venta ${lot.code}`, p.method, 'sale', id);
    description = `Registró venta del lote ${lot.code}`;
  }

  if(type==='drying.start'){
    const source=record(state,'lots',p.lotId);
    let estimate;try{estimate=dryingEstimate(source,p);}catch(error){throw new BusinessError(error.message);}
    const date=day(p.date);requireThat(date>=source.date,'El envío a secado no puede ser anterior al ingreso del lote.');
    const specification=text(p.specification,'Especificación del secado',300);
    source.stockGrams-=estimate.inputGrams;source.valueCents-=estimate.costCents;
    state.processes.push({id,date,kind:'secado',inputLotId:source.id,outputLotId:null,inputGrams:estimate.inputGrams,outputGrams:0,wasteGrams:0,costCents:estimate.costCents,inputMoisture:source.moisture,inputMeasuredMoisture:source.measuredMoisture??source.moisture,inputQuality:source.quality??null,estimate,specification,createdByName:actor.name||actor.id,status:'secando',note:text(p.note,'Observación',300,false),...stamp});
    description=`Envió a secado ${estimate.inputGrams/1000} kg del lote ${source.code}`;
  }
  if(type==='drying.finish'){
    const process=record(state,'processes',p.id);
    requireThat(process.kind==='secado'&&process.status==='secando','Este secado no está pendiente de finalizar.');
    const date=day(p.date);requireThat(date>=process.date,'El pesaje final no puede ser anterior al envío.');
    const outputGrams=decimal(p.outputQuantity,3,'Peso final');
    requireThat(outputGrams<=process.inputGrams,'El peso final no puede superar el peso enviado a secar.');
    const rule=moistureRule(p.moisture);
    requireThat(rule&&rule.moisture<=15&&rule.moisture<process.inputMoisture,'Registra la humedad final seca o semi seca (1 a 15 %). Si sigue húmedo, mantén el lote en secado.');
    const quality=coffeeQuality('pergamino',p.quality),dryingCostCents=decimal(p.dryingCost,2,'Costo técnico del secado',true);
    const referencePriceCents=decimal(p.referencePrice,2,'Precio de referencia del rendimiento seco');
    let valuation;try{valuation=settlePergamino(p.outputQuantity,rule.divisorText,p.referencePrice);}catch(error){throw new BusinessError(error.message);}
    const code=text(p.lotCode,'Código del lote seco',30).toUpperCase();requireThat(!state.lots.some(l=>l.code===code),'El código del lote seco ya existe.');
    const source=record(state,'lots',process.inputLotId),outputLotId=`${id}-lot`,outputCostCents=process.costCents+dryingCostCents;
    state.lots.push({id:outputLotId,code,stage:'pergamino',quality,stockGrams:outputGrams,reservedGrams:0,initialGrams:outputGrams,valueCents:outputCostCents,initialCostCents:outputCostCents,contactId:source.contactId,origin:source.origin,moisture:rule.moisture,measuredMoisture:rule.measuredMoisture,moistureClass:rule.moistureClass,moistureDivisor:rule.divisor,moistureTableVersion:rule.moistureTableVersion,date,parentId:source.id,dryingProcessId:process.id,status:'activo',...stamp});
    Object.assign(process,{outputLotId,outputGrams,wasteGrams:process.inputGrams-outputGrams,outputMoisture:rule.moisture,outputMeasuredMoisture:rule.measuredMoisture,outputQuality:quality,dryingCostCents,outputCostCents,referencePriceCents,referenceRevenueCents:valuation.totalCents,referenceMarginCents:valuation.totalCents-outputCostCents,completedDate:date,completedBy:actor.id,completionNote:text(p.note,'Observación final',300,false),status:'registrado'});
    entityId=process.id;description=`Finalizó secado de ${source.code}: lote ${code}, merma ${process.wasteGrams/1000} kg`;
  }
  if(type==='drying.cancel'){
    const process=record(state,'processes',p.id);requireThat(process.kind==='secado'&&process.status==='secando','Solo se cancela un envío a secado pendiente.');
    const date=day(p.date);requireThat(date>=process.date,'La cancelación no puede ser anterior al envío.');
    requireThat(p.restoredConfirmed==='yes','Confirma que regresó íntegramente el peso enviado sin procesarlo.');
    const reason=text(p.reason,'Motivo de cancelación',240),source=record(state,'lots',process.inputLotId);
    source.stockGrams+=process.inputGrams;source.valueCents+=process.costCents;
    Object.assign(process,{status:'anulado',voidDate:date,voidReason:reason});entityId=process.id;description=`Canceló envío a secado del lote ${source.code}: ${reason}`;
  }
  if (type === 'process.create') {
    const inputGrams = decimal(p.inputQuantity, 3, 'Peso de entrada');
    const outputGrams = decimal(p.outputQuantity, 3, 'Peso de salida');
    const source = activeLot(state, p.lotId, inputGrams);
    requireThat(source.stage!=='pergamino'||source.moisture==null||source.moisture<16,'Este pergamino está húmedo. Registra y finaliza su secado antes de trillarlo.');
    requireThat(outputGrams <= inputGrams, 'El peso de salida no puede superar el peso de entrada.');
    const transitions = { coco: 'verde', pergamino: 'verde', verde: 'tostado', tostado: 'molido' };
    requireThat(transitions[source.stage] === p.stage, 'La etapa de destino no corresponde al proceso de este lote.');
    const date = day(p.date);
    requireThat(date >= source.date, 'El proceso no puede ser anterior al ingreso del lote.');
    const code = text(p.lotCode, 'Código del lote de salida', 30).toUpperCase();
    requireThat(!state.lots.some(l => l.code === code), 'El código del lote de salida ya existe.');
    const costCents = allocateCost(source, inputGrams);
    source.stockGrams -= inputGrams; source.valueCents -= costCents;
    const outputLotId = `${id}-lot`;
    state.lots.push({ id: outputLotId, code, stage: p.stage, stockGrams: outputGrams, initialGrams: outputGrams, valueCents: costCents, initialCostCents: costCents, contactId: source.contactId, origin: source.origin, moisture: null, date, parentId: source.id, status: 'activo', ...stamp });
    state.processes.push({ id, date, inputLotId: source.id, outputLotId, inputGrams, outputGrams, wasteGrams: inputGrams - outputGrams, costCents, status: 'registrado', note: text(p.note, 'Observación', 300, false), ...stamp });
    description = `Procesó ${source.code} y generó ${code}`;
  }

  if (type === 'payment.create') {
    requireThat(['purchase', 'sale'].includes(p.sourceType), 'Selecciona una compra o venta.');
    const op = record(state, p.sourceType === 'sale' ? 'sales' : 'purchases', p.sourceId);
    requireThat(isOpenOperation(op), 'No puedes registrar abonos sobre una operación anulada o devuelta.');
    const amount = decimal(p.amount, 2, 'Monto del abono');
    requireThat(amount <= op.totalCents - op.paidCents, 'El abono supera el saldo pendiente de la operación.');
    const date = day(p.date);
    requireThat(date >= op.date, 'El abono no puede ser anterior a la operación.');
    op.paidCents += amount;
    addCash(p.sourceType === 'sale' ? amount : -amount, date, p.sourceType === 'sale' ? 'Abono de cliente' : 'Pago a proveedor', p.method, p.sourceType, op.id);
    entityId = op.id; description = p.sourceType === 'sale' ? 'Registró abono de cliente' : 'Registró pago a proveedor';
  }

  if (type === 'purchase.receive' || type === 'sale.deliver') {
    const purchase = type === 'purchase.receive';
    const op = record(state, purchase ? 'purchases' : 'sales', p.id);
    requireThat(isOpenOperation(op) && op.deliveryStatus === 'pendiente', 'La operación no está pendiente de recibir o entregar.');
    const date = day(p.date);
    requireThat(date >= op.date, 'La recepción o entrega no puede ser anterior a la operación.');
    const lot = record(state, 'lots', op.lotId);
    if (purchase) {
      requireThat(lot.status === 'pendiente' && lot.stockGrams === 0, 'El lote no está pendiente de recepción.');
      lot.stockGrams = op.grams; lot.valueCents = op.totalCents; lot.status = 'activo'; lot.date = date;
    } else {
      requireThat((lot.reservedGrams || 0) >= op.grams && lot.stockGrams >= op.grams, 'No se conserva la reserva de esta venta.');
      op.costCents = allocateCost(lot, op.grams);
      lot.reservedGrams -= op.grams; lot.stockGrams -= op.grams; lot.valueCents -= op.costCents;
    }
    op.deliveryStatus = purchase ? 'comprado' : 'vendido'; op.fulfilledDate = date;
    entityId = op.id; description = purchase ? 'Confirmó recepción del café comprado' : 'Confirmó entrega del café vendido';
  }

  if (type === 'cash.create') {
    requireThat(['ingreso', 'egreso'].includes(p.direction), 'Selecciona ingreso o egreso.');
    const amount = decimal(p.amount, 2, 'Monto');
    const concept = text(p.concept, 'Concepto', 160);
    addCash(p.direction === 'ingreso' ? amount : -amount, day(p.date), concept, p.method, 'manual', id);
    description = `Registró ${p.direction} manual ${concept}`;
  }

  if (type === 'operation.void' || type === 'operation.return') {
    const map = { purchase: 'purchases', sale: 'sales', process: 'processes' };
    requireThat(map[p.sourceType], 'Tipo de operación no válido.');
    const op = record(state, map[p.sourceType], p.sourceId);
    requireThat(p.sourceType!=='process'||op.status!=='secando','Para revertir un envío a secado pendiente utiliza cancelar secado.');
    requireThat(op.status !== 'anulado', 'La operación ya fue anulada.');
    const returning = type === 'operation.return';
    requireThat(!returning || ['purchase','sale'].includes(p.sourceType), 'Solo se devuelve una compra o venta.');
    requireThat(!returning || (op.status !== 'devuelto' && op.deliveryStatus !== 'pendiente'), 'Solo se devuelve café recibido o entregado; para una operación pendiente utiliza anular.');
    const alreadyReturned = op.status === 'devuelto';
    requireThat(!returning || p.quantity == null || decimal(p.quantity,3,'Cantidad devuelta') === op.grams, 'Solo se permite devolver la cantidad completa de la operación.');
    requireThat(!returning || !op.paidCents || p.refundConfirmed === 'yes', 'Confirma el reintegro completo del dinero antes de registrar la devolución.');
    const reason = text(p.reason, 'Motivo de anulación', 240);
    const date = day(p.date);
    const lastPayment = state.cash.filter(x => x.sourceId === op.id).reduce((d, x) => x.date > d ? x.date : d, op.returnDate || op.fulfilledDate || op.date);
    requireThat(date >= lastPayment, 'La anulación no puede ser anterior a la operación ni a sus abonos.');
    if (!alreadyReturned && (p.sourceType === 'purchase' || p.sourceType === 'process')) {
      const lot = record(state, 'lots', p.sourceType === 'purchase' ? op.lotId : op.outputLotId);
      requireThat((op.deliveryStatus === 'pendiente' || (lot.stockGrams === lot.initialGrams && lot.valueCents === lot.initialCostCents)) && !(lot.reservedGrams > 0), 'No se puede anular: el lote ya tuvo salidas. Anula primero sus movimientos posteriores.');
      lot.stockGrams = 0; lot.valueCents = 0; lot.status = returning ? 'devuelto' : 'anulado';
      if (p.sourceType === 'process') {
        const source = record(state, 'lots', op.inputLotId);
        source.stockGrams += op.inputGrams; source.valueCents += op.costCents;
      }
    } else if (!alreadyReturned) {
      const lot = record(state, 'lots', op.lotId);
      if (op.deliveryStatus === 'pendiente') lot.reservedGrams = Math.max(0, (lot.reservedGrams || 0) - op.grams);
      else { lot.stockGrams += op.grams; lot.valueCents += op.costCents; }
    }
    if (!alreadyReturned && op.paidCents) {
      const payments = state.cash.filter(x => x.sourceId === op.id && x.sourceType === p.sourceType && x.status === 'registrado');
      for (const [i, entry] of payments.entries()) {
        entry.status = 'revertido';
        addCash(-entry.signedCents, date, `${returning ? 'Reintegro por devolución' : 'Reversión por anulación'}: ${reason}`, entry.method, 'reversal', op.id, `reversal-${i}`);
      }
    }
    op.status = returning ? 'devuelto' : 'anulado';
    if (returning) { op.returnReason = reason; op.returnDate = date; }
    else { op.voidReason = reason; op.voidDate = date; }
    entityId = op.id; description = `${returning ? 'Registró devolución completa de' : 'Anuló'} ${p.sourceType === 'purchase' ? 'compra' : p.sourceType === 'sale' ? 'venta' : 'proceso'}: ${reason}`;
  }

  if (type === 'cash.void') {
    const entry = record(state, 'cash', p.id);
    requireThat(entry.sourceType === 'manual' && entry.status === 'registrado', 'Solo se pueden revertir movimientos manuales vigentes.');
    const date = day(p.date);
    requireThat(date >= entry.date, 'La reversión no puede ser anterior al movimiento.');
    const reason = text(p.reason, 'Motivo', 240);
    entry.status = 'revertido';
    addCash(-entry.signedCents, date, `Reversión: ${reason}`, entry.method, 'reversal', entry.id);
    entityId = entry.id; description = `Revirtió movimiento manual: ${reason}`;
  }

  if (type === 'settings.update') {
    state.settings.location = text(p.location, 'Dirección', 180);
    state.settings.lowStockGrams = decimal(p.lowStock, 3, 'Umbral de inventario', true);
    description = 'Actualizó dirección y umbral de inventario'; entityId = 'company';
  }

  if (type === 'user.save') {
    requireThat(ROLES.includes(p.role), 'Rol no válido.');
    const old = state.users.find(x => x.id === p.id);
    const area = p.role === 'trabajador' ? p.area : 'general';
    requireThat(p.role !== 'trabajador' || AREAS.includes(area), 'Selecciona almacén o caja para el trabajador.');
    requireThat(!(p.id === actor.id && (p.role !== actor.role || p.active === false)), 'No puedes desactivar ni cambiar tu propio rol de acceso.');
    const email = text(p.email, 'Correo', 160).toLowerCase();
    requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'El correo no es válido.');
    requireThat(!state.users.some(x => x.id !== p.id && x.email.toLowerCase() === email), 'Ya existe una cuenta con ese correo.');
    if (old) requireThat(old.email.toLowerCase() === email, 'El correo de un acceso existente no se puede cambiar.');
    const user = { id: text(p.id, 'Usuario', 128), name: text(p.name, 'Nombre', 120), email, role: p.role, area, active: p.active !== false, updatedAt: now, updatedBy: actor.id };
    if (old) {
      const oldRole = normalizeUser(old).role;
      if (['administrador', 'gerente'].includes(oldRole) && old.active && (p.role !== oldRole || !user.active))
        requireThat(state.users.some(x => x.id !== old.id && x.active && normalizeUser(x).role === oldRole), `Debe conservarse al menos un ${oldRole} activo.`);
      Object.assign(old, user);
    } else state.users.push({ ...user, ...stamp });
    description = `${old ? (!user.active ? 'Desactivó' : 'Actualizó') : 'Creó'} acceso de ${user.name}`; entityId = user.id;
  }
  if (type === 'lot.classify') {
    const lot = record(state, 'lots', p.id);
    requireThat(lot.stage === 'pergamino' && lot.quality == null, 'Solo se pueden clasificar lotes antiguos de pergamino sin calidad.');
    lot.quality = coffeeQuality(lot.stage, p.quality);
    const reason = text(p.reason, 'Motivo de clasificación', 240);
    requireThat(reason.length >= 5, 'Explica el motivo de la clasificación.');
    entityId = lot.id; description = 'Clasificó el lote ' + lot.code + ' como calidad ' + lot.quality + ': ' + reason;
  }
  if (type === 'price.save') {
    const quality = coffeeQuality(p.stage, p.quality);
    requireThat(STAGES.includes(p.stage), 'Selecciona una presentación válida.');
    requireThat(['compra', 'venta'].includes(p.kind), 'Selecciona compra o venta.');
    const old = p.id ? record(state, 'prices', p.id) : null;
    if (old) requireThat(Number(p.version) === old.version, 'Otro usuario actualizó este precio. Actualiza y vuelve a editar.', 409);
    const reason = text(p.reason, 'Motivo del cambio', 240);
    requireThat(reason.length >= 5, 'Explica el motivo del cambio con al menos 5 caracteres.');
    requireThat(!state.prices.some(x => x.id !== old?.id && x.active && x.stage === p.stage && x.kind === p.kind && (x.quality ?? null) === quality), 'Ya existe un precio activo para esta presentación, calidad y operación. Edita el precio existente.');
    requireThat(p.unit==null||['kg','liquidacion'].includes(p.unit),'Selecciona una unidad de tarifa válida.');
    const item = { id: old?.id || id, stage: p.stage, quality, kind: p.kind, amountCents: decimal(p.amount, 2, 'Precio del café'), currency: 'PEN', unit: p.stage === 'pergamino' && (p.kind === 'compra'||p.unit==='liquidacion') ? 'liquidacion' : 'kg', active: true, version: (old?.version || 0) + 1, reason, updatedAt: now, updatedBy: actor.id };
    if (old) Object.assign(old, item); else state.prices.push({ ...item, ...stamp });
    entityId = item.id; description = `${old ? 'Actualizó' : 'Registró'} precio de ${p.kind} de café ${p.stage}${quality === null ? '' : ' calidad ' + quality}`;
  }
  if (type === 'price.archive') {
    const item = record(state, 'prices', p.id);
    requireThat(item.active, 'El precio ya está desactivado.');
    requireThat(Number(p.version) === item.version, 'El precio cambió. Actualiza antes de desactivarlo.', 409);
    const reason = text(p.reason, 'Motivo de la baja', 240);
    requireThat(reason.length >= 5, 'Explica el motivo de la baja con al menos 5 caracteres.');
    Object.assign(item, { active: false, version: item.version + 1, reason, updatedAt: now, updatedBy: actor.id });
    entityId = item.id; description = `Desactivó precio de ${item.kind} de café ${item.stage}`;
  }
  if (type === 'auth.login' || type === 'auth.logout') {
    entityId = actor.id; description = type === 'auth.login' ? 'Inició sesión' : 'Cerró sesión';
  }
  requireThat(description, 'La operación no está implementada.');
  recordAudit(previous, state, { id, type, entityId, actorId: actor.id, actorName: actor.name, actorRole: actor.role, actorEmail: actor.email || '', description, at: now, fingerprint });
  return state;
}

export function visibleState(state, actor) {
  actor = normalizeUser(actor);
  const copy = structuredClone(state);
  copy.audit = can(actor, 'audit.read') ? copy.audit.map(({ fingerprint, ...x }) => x) : [];
  copy.users = can(actor, 'user.save') ? copy.users.map(normalizeUser) : [];
  if (!can(actor, 'cash.read')) { copy.sales = []; copy.cash = []; }
  // Purchase totals are available to warehouse; cash entries and payments remain restricted.
  if (actor.role === 'trabajador') copy.prices = copy.prices.filter(x => x.active && x.kind === (actor.area === 'caja' ? 'venta' : 'compra'));
  return copy;
}

export function csv(headers, rows) {
  const escape = v => '"' + String(v ?? '').replace(/^(\s*[=+@\-]|[\t\r\n])/, "'$&").replaceAll('"', '""') + '"';
  return '\ufeff' + [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
}
