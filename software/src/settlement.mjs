import { moistureRule } from './moisture.mjs';
// Aritmética decimal exacta. Ambas divisiones descartan cifras, nunca redondean.
function scaled(value, digits, label) {
  const raw = String(value ?? '').trim();
  if (!new RegExp('^\\d+(?:\\.\\d{1,' + digits + '})?$').test(raw)) throw new Error(label + ': valor inválido.');
  const [whole, fraction = ''] = raw.split('.');
  const result = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0'));
  if (result <= 0n || result > 1000000000n) throw new Error(label + ': valor fuera de rango.');
  return result;
}
export function settlePergamino(weight, divisor, price) {
  const grams = scaled(weight, 3, 'Peso bruto');
  const divisorHundredths = scaled(divisor, 2, 'Divisor de humedad');
  const priceCents = scaled(price, 2, 'Precio del rendimiento');
  const unitsHundredths = grams * 10n / divisorHundredths;
  const calculatedCents = unitsHundredths * priceCents / 100n;
  const totalCents = unitsHundredths * priceCents / 10000n * 100n;
  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El pago excede el límite permitido.');
  return { unitsHundredths: Number(unitsHundredths), settlementUnits: (Number(unitsHundredths) / 100).toFixed(2), calculatedCents: Number(calculatedCents), totalCents: Number(totalCents), discardedCents: Number(calculatedCents - totalCents), moistureDivisor: Number(divisorHundredths) / 100, settlementRule: 'truncate-units-2dp-pay-whole-soles-v1' };
}
export function suggestedDivisor(moisture) {
  return moistureRule(moisture)?.divisorText || '';
}
