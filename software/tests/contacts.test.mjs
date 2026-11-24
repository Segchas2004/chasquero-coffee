import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,emptyState} from '../server/domain.mjs';
const admin={id:'admin-review',name:'Administrador de prueba',role:'administrador',area:'general',active:true};
const warehouse={id:'warehouse-review',name:'Almacen de prueba',role:'trabajador',area:'almacen',active:true};
let seq=0;
const run=(s,type,payload,actor=admin)=>applyCommand(s,{type,payload,requestId:'review-contact-'+(++seq)},actor,'2026-10-27T15:00:00Z');
const fixture=()=>run(emptyState(),'contact.save',{name:'Proveedor de prueba',type:'proveedor',document:'DOC-PRUEBA',phone:'000000000',location:'Lugar de prueba'});
test('HU03-V1 Alta conserva nombre, documento, telefono, lugar y estado activo',()=>{
 const c=fixture().contacts[0];assert.equal(c.name,'Proveedor de prueba');assert.equal(c.document,'DOC-PRUEBA');assert.equal(c.phone,'000000000');assert.equal(c.location,'Lugar de prueba');assert.equal(c.active,true);
});
test('HU03-V2 Edicion mantiene identificador y no duplica el contacto',()=>{
 const s=fixture(),id=s.contacts[0].id;const next=run(s,'contact.save',{id,name:'Proveedor actualizado',type:'proveedor',document:'DOC-PRUEBA',active:true});assert.equal(next.contacts.length,1);assert.equal(next.contacts[0].id,id);assert.equal(next.contacts[0].name,'Proveedor actualizado');assert.equal(next.audit.length,s.audit.length+1);
});
test('HU03-V3 Desactivacion mantiene la compra y el contacto historicos',()=>{
 let s=fixture();const id=s.contacts[0].id;s=run(s,'purchase.create',{contactId:id,date:'2026-10-27',stage:'coco',quantity:'10',price:'10',paid:'0',lotCode:'REVISION-PRUEBA',priceReason:'Tarifa especial de prueba'});const purchases=structuredClone(s.purchases);const next=run(s,'contact.save',{id,name:'Proveedor de prueba',type:'proveedor',active:false});assert.deepEqual(next.purchases,purchases);assert.equal(next.contacts.length,1);assert.equal(next.contacts[0].active,false);
});
test('HU03-V4 Proveedor inactivo no permite una nueva compra',()=>{
 let s=fixture();const id=s.contacts[0].id;s=run(s,'contact.save',{id,name:'Proveedor de prueba',type:'proveedor',active:false});assert.throws(()=>run(s,'purchase.create',{contactId:id,date:'2026-10-27',stage:'coco',quantity:'10',price:'10',paid:'0',lotCode:'REVISION-BLOQUEADA',priceReason:'Tarifa especial de prueba'}),/proveedor activo/);assert.equal(s.purchases.length,0);
});
test('HU03-V5 Nombre obligatorio y tipos de contacto validos',()=>{
 assert.throws(()=>run(emptyState(),'contact.save',{name:'',type:'proveedor'}));assert.throws(()=>run(emptyState(),'contact.save',{name:'Prueba',type:'invalido'}));
});
test('HU03-V6 Almacen puede registrar proveedores pero no clientes',()=>{
 assert.equal(run(emptyState(),'contact.save',{name:'Proveedor',type:'proveedor'},warehouse).contacts.length,1);assert.throws(()=>run(emptyState(),'contact.save',{name:'Cliente',type:'cliente'},warehouse),/Almacén/);
});

