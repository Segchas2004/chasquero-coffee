export function launchState(lock, runtime, alive) {
  if (!lock || !Number.isInteger(lock.pid) || lock.pid < 1 || !alive) return { status: 'down' };
  const port = Number(runtime?.chasquero?.webPort);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) return { status: 'invalid', pid: lock.pid };
  if (runtime.chasquero.lan !== true) return { status: 'local', pid: lock.pid, port };
  if (!lock.ready) return { status: 'starting', pid: lock.pid, port };
  if (lock.lan !== true || Number(lock.webPort) !== port) return { status: 'invalid', pid: lock.pid };
  return { status: 'ready', pid: lock.pid, port };
}
