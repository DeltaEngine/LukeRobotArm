export type LukeIdentity = { type: 'luke-robot'; version: 1; id: string; host: string; ip: string; ready: boolean };

let discovered: LukeIdentity | null = null;
export const getDiscoveredRobot = () => discovered;
export const isLukeHostname = (host: string): boolean => /^Luke-[0-9a-f]{6}\.local$/i.test(host);

function isPrivateIP(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export async function discoverRobot(signal: AbortSignal, savedHost = ''): Promise<LukeIdentity | null> {
  // ponytail: bootstrap one powered Luke via mDNS, then use its unique hostname.
  // Multiple new robots need explicit pairing; browsers cannot enumerate mDNS services.
  const hosts = [...new Set([savedHost, 'luke.local'])].filter(host =>
    host === 'luke.local' || isLukeHostname(host) || isPrivateIP(host));
  for (const host of hosts) {
    if (signal.aborted) return null;
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 4000);
    try {
      const response = await fetch(`http://${host}/.well-known/luke`, {
        signal: request.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
      if (!response.ok) continue;
      const robot = await response.json();
      if (!robot || robot.type !== 'luke-robot' || robot.version !== 1 ||
          typeof robot.id !== 'string' || !/^Luke-[0-9a-f]{6}$/i.test(robot.id) ||
          typeof robot.host !== 'string' || robot.host.toLowerCase() !== `${robot.id}.local`.toLowerCase() ||
          typeof robot.ip !== 'string' || !isPrivateIP(robot.ip) || typeof robot.ready !== 'boolean') continue;
      if (signal.aborted || request.signal.aborted) return null;
      if (isLukeHostname(host) && host.toLowerCase() !== robot.host.toLowerCase()) continue;
      discovered = robot;
      return robot;
    } catch {
      // Offline, permission denied, mixed-content blocking or another device: keep setup open.
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
    }
  }
  return null;
}
