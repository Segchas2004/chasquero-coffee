import { useRef, useState } from 'react';
import { useApp } from './context';
import { Dialog } from './ui';
import { dryingEstimate } from './drying.mjs';
import { moistureRule } from './moisture.mjs';
import { settlePergamino } from './settlement.mjs';
import { createRequestId } from './request-id.mjs';
import { availableGrams } from './workflow.mjs';
import { money, kg, today, lotCode } from './lib';
import type { EditorSpec } from './types';

export default function DryingEditor({spec}:{spec:EditorSpec}){
  const {data,command,close,notify}=useApp();
  const start=spec.kind==='dryingStart',cancel=spec.kind==='dryingCancel',process=spec.target;
  const [v,setV]=useState<Record<string,string>>({date:today(),lotId:start?(process?.id||''):'',inputQuantity:'',expectedQuantity:'',expectedMoisture:'',expectedPrice:'',expectedPriceUnit:'liquidacion',expectedCost:'0',specification:'',note:'',outputQuantity:'',moisture:'',quality:String(process?.inputQuality??''),referencePrice:String((process?.estimate?.priceCents||0)/100),dryingCost:String((process?.estimate?.dryingCostCents||0)/100),lotCode:'',reason:'',restoredConfirmed:''});
  const request=useRef(createRequestId()),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(key:string,value:string)=>setV(old=>({...old,[key]:value}));
  const lots=data.lots.filter(l=>l.status==='activo'&&l.stage==='pergamino'&&l.moisture!=null&&l.moisture>=16&&availableGrams(l)>0),lot=lots.find(l=>l.id===v.lotId);
  let estimate:ReturnType<typeof dryingEstimate>|null=null,estimateError='';
  if(start&&lot){try{estimate=dryingEstimate(lot,v);}catch(e){estimateError=(e as Error).message;}}
  const finalRule=moistureRule(v.moisture);
  let finalValuation:ReturnType<typeof settlePergamino>|null=null;
  if(finalRule){try{finalValuation=settlePergamino(v.outputQuantity,finalRule.divisorText,v.referencePrice);}catch{}}
  function input(key:string,label:string,type='text',step?:string,min?:string,max?:string){return <label className="field" key={key}><span>{label} <b aria-hidden="true">*</b></span><input required type={type} step={step} min={min} max={max} value={v[key]} onChange={e=>set(key,e.target.value)}/></label>;}
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setBusy(true);
    try{await command(start?'drying.start':cancel?'drying.cancel':'drying.finish',{...v,...(!start?{id:process.id}:{})},request.current);notify(start?'Lote enviado a secado. El peso queda separado del disponible.':cancel?'Envío cancelado y peso restituido.':'Secado finalizado: nuevo lote y merma registrados.');close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <Dialog title={start?'Analizar y enviar lote a secado':cancel?'Cancelar envío a secado':'Registrar pesaje final del secado'} subtitle={start?'La estimación no registra una venta ni cambia las tarifas. Al confirmar, el peso enviado deja de estar disponible.':`Lote de origen: ${lotCode(data,process.inputLotId)} · Enviado: ${kg(process.inputGrams)}`} onClose={close} busy={busy} wide>
    <form onSubmit={submit}><div className="form-grid">
      {start&&<label className="field full"><span>Lote húmedo que se enviará <b aria-hidden="true">*</b></span><select required value={v.lotId} onChange={e=>set('lotId',e.target.value)}><option value="" disabled>Seleccionar lote</option>{lots.map(l=><option key={l.id} value={l.id}>{l.code} · {l.moisture} % · {kg(availableGrams(l))} disponibles</option>)}</select></label>}
      {input('date',start?'Fecha de envío':cancel?'Fecha de cancelación':'Fecha del pesaje final','date')}
      {start&&<>{input('inputQuantity','Peso enviado en kg','number','0.001','0.001',lot?String(availableGrams(lot)/1000):undefined)}{input('expectedQuantity','Peso seco esperado en kg','number','0.001','0.001',v.inputQuantity||undefined)}{input('expectedMoisture','Humedad final esperada en %','number','0.01','1','15.99')}
        <p className="subtle-note">Valoración estimada: peso esperado ÷ divisor de humedad, truncado a dos decimales, × precio del rendimiento. Se descartan los céntimos finales.</p>
        {input('expectedPrice','Precio estimado del rendimiento seco en S/','number','0.01','0.01')}{input('expectedCost','Costo estimado del secado en S/','number','0.01','0')}
        <label className="field full"><span>Especificación del envío <b aria-hidden="true">*</b></span><textarea required maxLength={300} value={v.specification} onChange={e=>set('specification',e.target.value)} placeholder="Destino o responsable del secado, identificación del lote e indicaciones"/></label></>}
      {!start&&!cancel&&<>{input('lotCode','Código del nuevo lote seco')}{input('outputQuantity','Peso final medido en kg','number','0.001','0.001',String(process.inputGrams/1000))}{input('moisture','Humedad final medida en %','number','0.01','1','15.99')}
        <label className="field"><span>Rendimiento analizado del lote seco <b aria-hidden="true">*</b></span><select required value={v.quality} onChange={e=>set('quality',e.target.value)}><option value="" disabled>Seleccionar rendimiento</option>{Array.from({length:41},(_,i)=><option key={80-i} value={80-i}>{80-i}</option>)}</select></label>
        {input('referencePrice','Precio de referencia del rendimiento seco en S/','number','0.01','0.01')}{input('dryingCost','Costo técnico real del secado en S/','number','0.01','0')}
        <p className="subtle-note">El costo se incorpora al lote seco. Esta acción no paga dinero: Caja debe registrar el gasto cuando corresponda. El precio de venta se confirma al vender.</p>
      </>}
      {cancel&&<><label className="field full"><span>Motivo de cancelación <b aria-hidden="true">*</b></span><textarea required maxLength={240} value={v.reason} onChange={e=>set('reason',e.target.value)}/></label><label className="field full"><span>Confirmación del retorno íntegro <b aria-hidden="true">*</b></span><select required value={v.restoredConfirmed} onChange={e=>set('restoredConfirmed',e.target.value)}><option value="" disabled>Seleccionar</option><option value="yes">Regresó todo el peso enviado y el café no fue procesado</option></select></label></>}
      {!cancel&&<label className="field full"><span>Observación</span><textarea maxLength={300} value={v.note} onChange={e=>set('note',e.target.value)}/></label>}
    </div>
    {start&&estimate&&<div className="form-summary" role="status"><span>Análisis previo · estimación</span><strong>{estimate.marginCents>=0?'Margen estimado':'Pérdida estimada'}: {money(estimate.marginCents)}</strong><small>Peso esperado: {kg(estimate.outputGrams)} · Merma esperada: {kg(estimate.wasteGrams)} · Humedad aplicada: {estimate.moisture} %</small><small>Venta estimada {money(estimate.revenueCents)} − costo del café {money(estimate.costCents)} − secado {money(estimate.dryingCostCents)}</small><small>Para cubrir café y secado: {money(estimate.breakEvenCentsPerKg)} por kg. No incluye otros gastos ni garantiza la venta.</small></div>}
    {start&&lot&&estimateError&&<p className="subtle-note" role="status">{estimateError}</p>}
    {!start&&!cancel&&<div className="form-summary"><span>Control del secado</span><strong>Merma: {kg(Math.max(0,process.inputGrams-Math.round(Number(v.outputQuantity||0)*1000)))}</strong><small>Humedad de entrada: {process.inputMoisture} % · Final aplicada: {finalRule?.moisture??'—'} % · {finalRule?.moistureClass||'Pendiente de medir'}</small>{finalValuation&&<small>Valoración al retorno: {money(finalValuation.totalCents)} · Margen estimado: {money(finalValuation.totalCents-process.costCents-Math.round(Number(v.dryingCost||0)*100))}. Fórmula: {v.outputQuantity} ÷ {finalRule?.divisor} → {finalValuation.settlementUnits} × {v.referencePrice}.</small>}{process.estimate&&<small>Estimación previa: {kg(process.estimate.outputGrams)} y margen {money(process.estimate.marginCents)}. La ganancia real se conoce al registrar la venta.</small>}</div>}
    {error&&<div role="alert" className="form-error">{error}</div>}<div className="dialog-actions"><button type="button" className="button" disabled={busy} onClick={close}>Cerrar</button><button className={`button ${cancel?'danger':'primary'}`} disabled={busy||(start&&!estimate)}>{busy?'Guardando…':start?'Confirmar envío a secado':cancel?'Cancelar envío y restituir peso':'Confirmar pesaje y crear lote seco'}</button></div></form>
  </Dialog>;
}
