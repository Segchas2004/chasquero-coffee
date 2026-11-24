// Tabla entregada por el propietario el 24/11/2026. Usar parte entera sin redondear.
export const MOISTURE_TABLE_VERSION = 'company-2026-11-24';
const DIVISORS = Object.freeze({
  13:5550,14:5600,15:5650,16:5700,17:5750,18:5800,19:5900,
  20:6000,21:6060,22:6120,23:6180,24:6240,25:6300,26:6360,
  27:6420,28:6480,29:6540,30:6850,31:6920,32:6990,33:7060,
  34:7130,35:7200,36:7270,37:7340,38:7410,39:7480,40:7550,
});
export function moistureRule(value, manualDivisor) {
  const raw=String(value??'').trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;
  const measuredMoisture=Number(raw);
  if(measuredMoisture<1 || measuredMoisture>100)return null;
  const moisture=Math.trunc(measuredMoisture);
  const dry=moisture>=1&&moisture<=12;
  const manual=moisture>40;
  const manualText=String(manualDivisor??'').trim();
  if(manual && !/^\d+(?:\.\d{1,2})?$/.test(manualText))return null;
  const manualHundredths=Math.round(Number(manualText)*100);
  if(manual && (!Number.isSafeInteger(manualHundredths)||manualHundredths<7550||manualHundredths>1000000000))return null;
  const divisorHundredths=manual?manualHundredths:dry?5550:DIVISORS[moisture];
  if(divisorHundredths===undefined)return null;
  return {
    moisture, measuredMoisture, divisorHundredths, divisor:divisorHundredths/100,
    divisorText:String(divisorHundredths/100),
    moistureClass:dry?'Seco':moisture<=15?'Semi seco':'Húmedo',
    moistureTableVersion:MOISTURE_TABLE_VERSION, moistureDivisorSource:manual?'manual':'tabla',
  };
}
export const MOISTURE_TABLE = Object.freeze(Array.from({length:40},(_,i)=>Object.freeze(moistureRule(i+1))));
