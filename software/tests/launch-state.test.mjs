import test from 'node:test';
import assert from 'node:assert/strict';
import {launchState} from '../scripts/launch-state.mjs';
const lock={pid:100,ready:true,lan:true,webPort:5173};
const runtime={chasquero:{lan:true,webPort:5173}};
test('El iniciador arranca cuando no hay proceso vivo, aunque quede un archivo antiguo',()=>{
 assert.equal(launchState(undefined,undefined,false).status,'down');assert.equal(launchState(lock,runtime,false).status,'down');
});
test('El iniciador reutiliza una sesion LAN lista y su puerto real',()=>assert.deepEqual(launchState({...lock,webPort:5180},{chasquero:{lan:true,webPort:5180}},true),{status:'ready',pid:100,port:5180}));
test('El iniciador espera una sesion que aun esta arrancando sin duplicarla',()=>assert.equal(launchState({pid:100},runtime,true).status,'starting'));
test('El iniciador detecta una sesion limitada a localhost y no la reinicia ni borra sus datos',()=>assert.equal(launchState(lock,{chasquero:{lan:false,webPort:5173}},true).status,'local'));
test('El iniciador no comparte un puerto desactualizado o una configuracion invalida',()=>{
 assert.equal(launchState(lock,{chasquero:{lan:true,webPort:5174}},true).status,'invalid');
 assert.equal(launchState(lock,{chasquero:{lan:true,webPort:0}},true).status,'invalid');
 assert.equal(launchState({...lock,lan:false},runtime,true).status,'invalid');
});
