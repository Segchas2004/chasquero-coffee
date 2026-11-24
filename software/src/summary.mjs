import { isFulfilledOperation, outstandingCents } from './workflow.mjs';

/** Current inventory and debts are separate from dated financial movements. */
export function summarize(data, range) {
  const inRange = date => date >= range.from && date <= range.to;
  const cash = data.cash.filter(x => inRange(x.date));
  const income = cash.filter(x => x.signedCents > 0).reduce((n,x) => n+x.signedCents,0);
  const expense = cash.filter(x => x.signedCents < 0).reduce((n,x) => n-x.signedCents,0);
  const balance = data.cash.filter(x => x.date <= range.to).reduce((n,x) => n+x.signedCents,0);
  const opening = data.cash.filter(x => x.date < range.from).reduce((n,x) => n+x.signedCents,0);
  const sales = data.sales.filter(isFulfilledOperation).filter(x => inRange(x.fulfilledDate || x.date)).reduce((n,x) => n+x.totalCents,0);
  const toCollect = data.sales.reduce((n,x) => n+outstandingCents(x),0);
  const toPay = data.purchases.reduce((n,x) => n+outstandingCents(x),0);
  const stock = data.lots.filter(x => x.status === 'activo').reduce((n,x) => n+x.stockGrams,0);
  return { income, expense, balance, opening, sales, toCollect, toPay, stock };
}
