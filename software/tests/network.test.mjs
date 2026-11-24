import test from 'node:test';
import assert from 'node:assert/strict';
import {lanAddresses,networkLinks} from '../scripts/network.mjs';
const ip=(address,internal=false,family='IPv4')=>({address,internal,family});
test('LAN prioriza Wi-Fi y no publica interfaces virtuales ni de bucle local',()=>{
 const result=lanAddresses({Ethernet:[ip('10.1.0.2')],'vEthernet (WSL)':[ip('172.20.0.1')],'Wi-Fi':[ip('172.21.207.43')],Loopback:[ip('127.0.0.1',true)]});
 assert.deepEqual(result.map(x=>x.address),['172.21.207.43','10.1.0.2']);
});
test('LAN excluye direcciones externas, autoconfiguradas e IPv6',()=>assert.deepEqual(lanAddresses({'Wi-Fi':[ip('8.8.8.8'),ip('169.254.3.4'),ip('::1',false,'IPv6'),ip('172.32.0.1'),ip('999.1.1.1')]}),[]));
test('LAN elimina direcciones duplicadas y admite familia numerica',()=>assert.equal(lanAddresses({'Wi-Fi':[ip('192.168.1.2')],Ethernet:[ip('192.168.1.2',false,4)]}).length,1));
test('LAN comparte el puerto elegido, sin recuperar puertos de redes anteriores',()=>{
 const [link]=networkLinks(5181,{'Wi-Fi':[ip('192.168.10.25')]});
 assert.equal(link.url,'http://192.168.10.25:5181/acceso');assert.equal(link.health,'http://192.168.10.25:5181/api/health');
});
test('LAN actualiza el enlace cuando cambia la red y rechaza puertos invalidos',()=>{
 assert.equal(networkLinks(5173,{'Wi-Fi':[ip('10.17.5.5')]} )[0].url,'http://10.17.5.5:5173/acceso');
 for(const port of [0,65536,'abc',1.5])assert.throws(()=>networkLinks(port,{}),/Puerto/);
});
