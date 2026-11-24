import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRequestId} from '../src/request-id.mjs';
test('LAN HTTP sin randomUUID genera identificadores válidos y diferentes',()=>{
 const source={getRandomValues: bytes=>webcrypto.getRandomValues(bytes)};
 const ids=Array.from({length:1000},()=>createRequestId(source));
 assert.equal(new Set(ids).size,ids.length);
 ids.forEach(id=>assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
});
test('HTTPS conserva el generador nativo',()=>{
 assert.equal(createRequestId({randomUUID:()=> 'native-id'}),'native-id');
});
