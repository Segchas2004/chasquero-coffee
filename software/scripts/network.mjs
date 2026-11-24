import { networkInterfaces } from 'node:os';

export function lanAddresses(interfaces = networkInterfaces()) {
  const found = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (/vEthernet|VMware|VirtualBox|vbox|WSL|Docker|Loopback|Tunnel/i.test(name)) continue;
    for (const item of addresses || []) {
      if (!['IPv4', 4].includes(item.family) || item.internal) continue;
      const numbers = String(item.address).split('.').map(Number);
      if (numbers.length !== 4 || numbers.some(n => !Number.isInteger(n) || n < 0 || n > 255)) continue;
      const [a, b] = numbers;
      if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168))) continue;
      found.push({ name, address: item.address, priority: /wi-?fi|wlan|wireless/i.test(name) ? 0 : 1 });
    }
  }
  return found.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
    .filter((item, index, all) => all.findIndex(x => x.address === item.address) === index);
}

export function networkLinks(port, interfaces = networkInterfaces()) {
  if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('Puerto web no válido.');
  return lanAddresses(interfaces).map(({ name, address }) => ({
    name, address, url: `http://${address}:${Number(port)}/acceso`,
    health: `http://${address}:${Number(port)}/api/health`,
  }));
}
