import test from 'node:test';
import assert from 'node:assert/strict';
import {filterInventory,stockStatus} from '../src/inventory.mjs';
const lots=[
 {id:'a',code:'PER-S3',stage:'pergamino',origin:'Las Pirias',status:'activo',stockGrams:50000},
 {id:'b',code:'VER-S3',stage:'verde',origin:'Las Pirias',status:'activo',stockGrams:16000},
 {id:'c',code:'VER-OTRO',stage:'verde',origin:'Chirinos',status:'activo',stockGrams:70000},
 {id:'d',code:'AGOTADO',stage:'coco',origin:'Las Pirias',status:'activo',stockGrams:0},
 {id:'e',code:'PENDIENTE',stage:'pergamino',origin:'Las Pirias',status:'pendiente',stockGrams:0},
 {id:'f',code:'ANULADO',stage:'verde',origin:'Las Pirias',status:'anulado',stockGrams:5000},
 {id:'g',code:'DEVUELTO',stage:'verde',origin:'Las Pirias',status:'devuelto',stockGrams:0},
];
const ids=items=>items.map(x=>x.id);
test('HU05-F1 Inventario incluye lotes activos y excluye pendientes, devueltos y anulados',()=>assert.deepEqual(ids(filterInventory(lots)),['a','b','c','d']));
test('HU05-F2 El filtro por presentación muestra únicamente café verde',()=>assert.deepEqual(ids(filterInventory(lots,{stage:'verde'})),['b','c']));
test('HU05-F3 La búsqueda por procedencia admite diferencias de mayúsculas',()=>assert.deepEqual(ids(filterInventory(lots,{query:'LAS PIRIAS'})),['a','b','d']));
test('HU05-F4 Presentación, procedencia y alerta se combinan sin incluir otros lotes',()=>assert.deepEqual(ids(filterInventory(lots,{stage:'verde',query:'Las Pirias',availability:'low',lowStockGrams:50000})),['b']));
test('HU05-F5 El umbral es estricto: 50 kg no alerta; 16 kg alerta y cero aparece agotado',()=>{
 assert.deepEqual(ids(filterInventory(lots,{availability:'low',lowStockGrams:50000})),['b','d']);
 assert.equal(stockStatus(lots[0],50000),'Disponible');assert.equal(stockStatus(lots[1],50000),'Bajo umbral');assert.equal(stockStatus(lots[3],50000),'Agotado');
});
test('HU05-F6 Con existencias excluye lotes agotados y una búsqueda inexistente queda vacía',()=>{
 assert.deepEqual(ids(filterInventory(lots,{availability:'available'})),['a','b','c']);assert.deepEqual(filterInventory(lots,{query:'no-existe'}),[]);
});
test('HU05-F7 La consulta conserva sin cambios los registros originales',()=>{
 const previous=structuredClone(lots);filterInventory(lots,{query:'S3',availability:'low',lowStockGrams:50000});assert.deepEqual(lots,previous);
});
