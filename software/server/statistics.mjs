import { isOpenOperation, isFulfilledOperation, availableGrams, outstandingCents, pendingOperations } from '../src/workflow.mjs';
export function statisticsReport(kind,s,{from,to,q='',financial=true}){
  const inRange=x=>(x.fulfilledDate||x.date)>=from&&(x.fulfilledDate||x.date)<=to;
  const purchases=s.purchases.filter(isFulfilledOperation).filter(inRange),sales=s.sales.filter(isFulfilledOperation).filter(inRange);
  const sum=(a,k)=>a.reduce((n,x)=>n+(x[k]||0),0),money=n=>Number((n/100).toFixed(2));
  let headers,rows;
  if(kind==='statistics'){
    const revenue=sum(sales,'totalCents'),cost=sum(sales,'costCents');
    headers=['Indicador','Valor','Unidad','Decisión que apoya'];
    rows=[['Compras recibidas',money(sum(purchases,'totalCents')),'PEN','Planificar abastecimiento'],['Café recibido',sum(purchases,'grams')/1000,'kg','Contrastar ingresos de almacén'],['Stock físico',sum(s.lots,'stockGrams')/1000,'kg','Controlar existencias'],['Stock reservado',sum(s.lots,'reservedGrams')/1000,'kg','Planificar entregas pendientes'],['Compras por recibir',s.purchases.filter(x=>isOpenOperation(x)&&x.deliveryStatus==='pendiente').length,'operaciones','Coordinar recepciones'],['Lotes bajo umbral',s.lots.filter(x=>x.status==='activo'&&availableGrams(x)<s.settings.lowStockGrams).length,'lotes','Priorizar reposición']];
    rows.push(['Café en secado',sum(s.processes.filter(x=>x.status==='secando'),'inputGrams')/1000,'kg','Controlar peso separado del disponible hasta el pesaje final']);
    if(financial)rows.push(['Ventas entregadas',money(revenue),'PEN','Evaluar actividad comercial'],['Margen bruto estimado',money(revenue-cost),'PEN','Comparar ventas y costo asignado; no es utilidad neta'],['Margen sobre ventas',revenue?Number(((revenue-cost)/revenue*100).toFixed(2)):0,'%','Revisar rentabilidad antes de otros gastos'],['Por cobrar',money(s.sales.reduce((total,op)=>total+outstandingCents(op),0)),'PEN','Priorizar cobranza'],['Por pagar',money(s.purchases.reduce((total,op)=>total+outstandingCents(op),0)),'PEN','Planificar obligaciones']);
  }else if(kind==='monthly'){
    headers=['Mes','Compras recibidas PEN','Peso recibido kg','Ventas entregadas PEN','Margen bruto PEN'];const grouped=new Map();
    for(const [list,isSale] of [[purchases,false],[sales,true]])for(const x of list){const key=(x.fulfilledDate||x.date).slice(0,7);if(!grouped.has(key))grouped.set(key,[key,0,0,0,0]);const r=grouped.get(key);if(isSale){r[3]+=x.totalCents;r[4]+=x.totalCents-(x.costCents||0);}else{r[1]+=x.totalCents;r[2]+=x.grams;}}
    rows=[...grouped.values()].sort((a,b)=>a[0].localeCompare(b[0])).map(r=>[r[0],money(r[1]),r[2]/1000,money(r[3]),money(r[4])]);
  }else if(kind==='partners'){
    headers=['Tipo','Contacto','Operaciones recibidas / entregadas','Peso kg','Total PEN'];const grouped=new Map();
    for(const [list,type] of [[purchases,'Productor / proveedor'],[sales,'Cliente']])for(const op of list){const key=type+op.contactId;if(!grouped.has(key))grouped.set(key,[type,s.contacts.find(c=>c.id===op.contactId)?.name||op.contactId,0,0,0]);const r=grouped.get(key);r[2]++;r[3]+=op.grams;r[4]+=op.totalCents;}
    rows=[...grouped.values()].sort((a,b)=>b[4]-a[4]).map(r=>[r[0],r[1],r[2],r[3]/1000,money(r[4])]);
  }else if(kind==='quality'){
    headers=['Rendimiento pergamino','Compras recibidas','Peso bruto kg','Humedad promedio ponderada %','Unidades liquidadas','Total compra PEN'];const grouped=new Map();
    for(const op of purchases){const lot=s.lots.find(l=>l.id===op.lotId);if(lot?.stage!=='pergamino')continue;const key=op.quality??'Sin clasificar';if(!grouped.has(key))grouped.set(key,{count:0,grams:0,humidity:0,measured:0,units:0,total:0});const r=grouped.get(key);r.count++;r.grams+=op.grams;const moisture=op.moisture??lot.moisture;if(moisture!=null){r.humidity+=moisture*op.grams;r.measured+=op.grams;}r.units+=Number(op.settlementUnits||0);r.total+=op.totalCents;}
    rows=[...grouped].sort((a,b)=>Number(b[0])-Number(a[0])).map(([key,r])=>[key,r.count,r.grams/1000,r.measured?Number((r.humidity/r.measured).toFixed(2)):'Sin medición',Number(r.units.toFixed(2)),money(r.total)]);
  }else if(kind==='balances'){
    headers=['Tipo','Contacto','Lote','Fecha','Días desde operación','Saldo PEN','Estado logístico'];rows=[];
    for(const [list,type] of [[s.purchases,'Por pagar'],[s.sales,'Por cobrar']])for(const op of pendingOperations(list)){const balance=outstandingCents(op);if(balance<=0||op.date>to)continue;rows.push([type,s.contacts.find(c=>c.id===op.contactId)?.name||op.contactId,s.lots.find(l=>l.id===op.lotId)?.code||op.lotId,op.date,Math.max(0,Math.floor((new Date(to+'T00:00:00Z')-new Date(op.date+'T00:00:00Z'))/86400000)),money(balance),op.deliveryStatus||'Completado']);}
  }else if(kind==='returns'){
    headers=['Tipo','Lote','Contacto','Fecha devolución','Peso kg','Importe original PEN','Estado','Motivo'];rows=[];
    for(const [list,type] of [[s.purchases,'Compra'],[s.sales,'Venta']])for(const op of list.filter(x=>x.returnDate&&x.returnDate>=from&&x.returnDate<=to))rows.push([type,s.lots.find(l=>l.id===op.lotId)?.code||op.lotId,s.contacts.find(c=>c.id===op.contactId)?.name||op.contactId,op.returnDate,op.grams/1000,money(op.totalCents),op.status,op.returnReason]);
  }else if(kind==='stock-alerts'){
    headers=['Lote','Presentación','Rendimiento','Stock físico kg','Reservado kg','Disponible kg','Umbral kg','Alerta'];rows=s.lots.filter(l=>l.status==='activo').map(l=>[l.code,l.stage,l.quality??'',l.stockGrams/1000,(l.reservedGrams||0)/1000,availableGrams(l)/1000,s.settings.lowStockGrams/1000,availableGrams(l)<s.settings.lowStockGrams?'Bajo umbral':'Disponible']);
  }else return null;
  return {headers,rows:rows.filter(r=>!q||r.join(' ').toLowerCase().includes(q))};
}
