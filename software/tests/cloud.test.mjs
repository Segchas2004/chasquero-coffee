import test, { after } from 'node:test';
import assert from 'node:assert/strict';
process.env.CHASQUERO_ENV = 'production';
process.env.GCLOUD_PROJECT = 'demo-chasquero-coffee';
delete process.env.FIREBASE_WEB_API_KEY;
const { app } = await import('../server/index.mjs');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
after(() => new Promise(resolve => server.close(resolve)));
const base = `http://127.0.0.1:${server.address().port}`;
const post = headers => fetch(base + '/api/login', { method:'POST', headers:{'Content-Type':'application/json',...headers}, body:JSON.stringify({email:'test@example.com',password:'test-only'}) });
test('Cloud: la API identifica el modo nube y evita caché', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.status, 200); assert.equal((await r.json()).mode,'firebase-cloud');
  assert.equal(r.headers.get('cache-control'),'no-store');
});
test('Cloud: rechaza escrituras desde otro dominio', async () => {
  assert.equal((await post({Origin:'https://example.com','X-Chasquero-Client':'local-app'})).status,403);
});
test('Cloud: rechaza escrituras sin origen o sin cabecera del cliente', async () => {
  assert.equal((await post({'X-Chasquero-Client':'local-app'})).status,403);
  assert.equal((await post({Origin:'https://demo-chasquero-coffee.web.app'})).status,403);
});
test('Cloud: no usa Auth local cuando falta configuración cloud', async () => {
  const r = await post({Origin:'https://demo-chasquero-coffee.web.app','X-Chasquero-Client':'local-app'});
  assert.equal(r.status,503); assert.match((await r.json()).error,/configurado/);
});
test('Cloud: datos y reportes requieren sesión', async () => {
  for (const path of ['/api/state','/api/me','/api/reports/cash']) assert.equal((await fetch(base + path)).status,401);
});
test('Cloud: cerrar sesión elimina cookie compatible con Hosting y exige HTTPS', async () => {
  const r = await fetch(base + '/api/logout', {method:'POST',headers:{Origin:'https://demo-chasquero-coffee.web.app','X-Chasquero-Client':'local-app','Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,200); const cookie=r.headers.get('set-cookie');
  assert.match(cookie,/__session=/); assert.match(cookie,/Secure/); assert.match(cookie,/HttpOnly/); assert.match(cookie,/SameSite=Strict/);
});
