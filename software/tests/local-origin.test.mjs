import test from 'node:test';
import assert from 'node:assert/strict';
import {isLocalWebOrigin} from '../server/local-origin.mjs';
const home={'Wi-Fi':[{family:'IPv4',internal:false,address:'192.168.100.9'}]};
const university={'Wi-Fi':[{family:'IPv4',internal:false,address:'10.17.5.8'}]};
test('La red local acepta la IP actual de la laptop y el puerto web',()=>{
 assert.equal(isLocalWebOrigin('http://192.168.100.9:5173',5173,home),true);
 assert.equal(isLocalWebOrigin('http://10.17.5.8:5173',5173,university),true);
 assert.equal(isLocalWebOrigin('http://192.168.100.9:5173',5173,university),false);
});
test('Rechaza otro equipo, puerto, protocolo u origen con ruta',()=>{
 for(const origin of ['http://10.17.5.9:5173','http://10.17.5.8:5174','https://10.17.5.8:5173','http://10.17.5.8:5173/path','null','http://localhost.ejemplo.com:5173']) assert.equal(isLocalWebOrigin(origin,5173,university),false,origin);
 assert.equal(isLocalWebOrigin('http://127.0.0.1:5173',5173,university),true);
});
