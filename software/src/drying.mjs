import { moistureRule } from './moisture.mjs';
import { settlePergamino } from './settlement.mjs';
import { availableGrams } from './workflow.mjs';

function amount(value,digits,label,zero=false){
  const raw=String(value??'').trim();
  if(!new RegExp('^\\d+(?:\\.\\d{1,'+digits+'})?$').test(raw))throw new Error(label+': valor inválido.');
  const n=Math.round(Number(raw)*10**digits);
  if(!Number.isSafeInteger(n)||n>1000000000||(zero?n<0:n<=0))throw new Error(label+': valor fuera de rango.');
  return n;
}
export function dryingEstimate(lot,values){
  const inputGrams=amount(values.inputQuantity,3,'Peso enviado');
  const outputGrams=amount(values.expectedQuantity,3,'Peso esperado');
  if(!lot || lot.status!=='activo'||lot.stage!=='pergamino'||lot.moisture==null||lot.moisture<16)throw new Error('Selecciona un lote de pergamino húmedo con medición registrada.');
  if(inputGrams>availableGrams(lot))throw new Error('El peso enviado supera las existencias disponibles.');
  if(outputGrams>inputGrams)throw new Error('El peso esperado no puede superar el peso enviado.');
  const rule=moistureRule(values.expectedMoisture);
  if(!rule||rule.moisture>15||rule.moisture>=lot.moisture)throw new Error('La humedad esperada debe corresponder a café seco o semi seco (1 a 15 %).');
  const priceCents=amount(values.expectedPrice,2,'Precio de venta estimado');
  const dryingCostCents=amount(values.expectedCost,2,'Costo estimado de secado',true);
  if(values.expectedPriceUnit!=='liquidacion')throw new Error('El análisis del secado utiliza el precio del rendimiento y la fórmula de liquidación.');
  const costCents=inputGrams===lot.stockGrams?lot.valueCents:Math.round(lot.valueCents*inputGrams/lot.stockGrams);
  if(!Number.isSafeInteger(outputGrams*priceCents))throw new Error('La estimación supera el límite permitido.');
  const revenueCents=values.expectedPriceUnit==='kg'?Math.round(outputGrams*priceCents/1000):settlePergamino(values.expectedQuantity,rule.divisorText,values.expectedPrice).totalCents;
  return {inputGrams,outputGrams,wasteGrams:inputGrams-outputGrams,costCents,dryingCostCents,revenueCents,marginCents:revenueCents-costCents-dryingCostCents,breakEvenCentsPerKg:Math.ceil((costCents+dryingCostCents)*1000/outputGrams),priceCents,priceUnit:values.expectedPriceUnit,moisture:rule.moisture,measuredMoisture:rule.measuredMoisture,divisor:rule.divisor};
}
