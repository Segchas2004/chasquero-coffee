import {networkInterfaces} from 'node:os';

// A laptop can change its LAN address between home and the demonstration site.
// Accept only this machine's current interfaces and the configured web port.
export function isLocalWebOrigin(origin, webPort, interfaces = networkInterfaces()) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.origin !== origin || Number(url.port || 80) !== Number(webPort)) return false;
    const hosts = new Set(['localhost', '127.0.0.1', 'terminal.local']);
    for (const addresses of Object.values(interfaces)) for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) hosts.add(address.address);
    }
    return hosts.has(url.hostname);
  } catch { return false; }
}
