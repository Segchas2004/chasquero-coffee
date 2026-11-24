/** @param {{stockGrams:number}} lot @param {number} lowStockGrams */
export function stockStatus(lot, lowStockGrams) {
  if (lot.stockGrams === 0) return 'Agotado';
  return lot.stockGrams < lowStockGrams ? 'Bajo umbral' : 'Disponible';
}

/**
 * @template {{status:string,stage:string,code:string,origin:string,stockGrams:number}} T
 * @param {T[]} lots
 * @param {{stage?:string,query?:string,availability?:string,lowStockGrams?:number}} options
 * @returns {T[]}
 */
export function filterInventory(lots, {stage = 'all', query = '', availability = 'all', lowStockGrams = 0} = {}) {
  const search = String(query).toLocaleLowerCase('es-PE');
  return lots.filter(lot => lot.status === 'activo')
    .filter(lot => stage === 'all' || lot.stage === stage)
    .filter(lot => `${lot.code} ${lot.stage} ${lot.origin}`.toLocaleLowerCase('es-PE').includes(search))
    .filter(lot => availability === 'all' || (availability === 'low' ? lot.stockGrams < lowStockGrams : lot.stockGrams > 0));
}
