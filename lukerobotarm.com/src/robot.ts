/** Shared connection state for talking to a Luke robot over WebSocket. */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type StatusListener = (status: ConnectionStatus, detail?: string) => void;
export type MessageListener = (message: string) => void;

const DEFAULT_HOST = '192.168.4.1';
const WS_PATH = '/ws';
const STORAGE_KEY = 'luke-robot-host';

let socket: WebSocket | null = null;
let status: ConnectionStatus = 'disconnected';
let host = localStorage.getItem(STORAGE_KEY) || DEFAULT_HOST;
let virtual = false;

const statusListeners = new Set<StatusListener>();
const messageListeners = new Set<MessageListener>();
const logLines: string[] = [];

function setStatus(next: ConnectionStatus, detail?: string) {
  status = next;
  if (detail) log(detail);
  statusListeners.forEach((fn) => fn(status, detail));
}

export function log(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logLines.push(line);
  if (logLines.length > 200) logLines.shift();
  messageListeners.forEach((fn) => fn(line));
}

export function getLog(): string[] {
  return [...logLines];
}

export function getHost(): string {
  return host;
}

export function setHost(next: string) {
  host = next.trim();
  localStorage.setItem(STORAGE_KEY, host);
}

export function getStatus(): ConnectionStatus {
  return status;
}

export function isConnected(): boolean {
  return virtual || socket?.readyState === WebSocket.OPEN;
}

export function isVirtual(): boolean {
  return virtual;
}

/** Demo target when nothing is on the LAN. No WebSocket. Upgrade: mDNS / firmware announce. */
export function connectVirtual(): void {
  disconnect(false);
  virtual = true;
  setStatus('connected', 'Virtual Luke');
}

export function onStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

export function onMessage(listener: MessageListener): () => void {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function connect(customHost?: string): void {
  virtual = false;
  if (customHost) setHost(customHost);
  if (!host) {
    setStatus('error', '⚠️ No robot address');
    return;
  }

  disconnect(false);
  setStatus('connecting', `🔌 Connecting to ${host}…`);

  try {
    socket = new WebSocket(`ws://${host}${WS_PATH}`);
  } catch (err) {
    setStatus('error', `❌ Invalid address: ${host}`);
    return;
  }

  socket.onopen = () => {
    setStatus('connected', `✅ Connected to Luke at ${host}`);
    send({ command: 'get_status' });
  };

  socket.onmessage = (event) => {
    log(`📥 ${event.data}`);
  };

  socket.onerror = () => {
    setStatus('error', '❌ WebSocket error — is the robot on the same Wi‑Fi?');
  };

  socket.onclose = () => {
    socket = null;
    if (status !== 'error') {
      setStatus('disconnected', '🔌 Disconnected from robot');
    } else {
      status = 'disconnected';
      statusListeners.forEach((fn) => fn(status));
    }
  };
}

export function disconnect(logIt = true): void {
  virtual = false;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  if (logIt && status !== 'disconnected') {
    setStatus('disconnected', '🔌 Disconnected');
  } else {
    status = 'disconnected';
  }
}

export function send(payload: unknown): boolean {
  if (virtual) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    log(`📤 ${data}`);
    return true;
  }
  if (socket?.readyState !== WebSocket.OPEN) {
    log('⚠️ Not connected — pick a robot first');
    return false;
  }
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  socket.send(data);
  log(`📤 ${data}`);
  return true;
}

export function sendCommand(command: string, extra: Record<string, unknown> = {}): boolean {
  return send({ command, ...extra });
}

export function sendVoice(transcript: string): boolean {
  return send({ voice: transcript });
}

/** Attach a live log + status badge into a page container. */
export function mountConnectionPanel(container: HTMLElement, options?: { showHostInput?: boolean }) {
  const showHost = options?.showHostInput !== false;
  const panel = document.createElement('div');
  panel.className = 'connection-panel';
  panel.innerHTML = `
    ${showHost ? `
    <div class="connection-row">
      <label for="robotHost">Robot IP / host</label>
      <input id="robotHost" type="text" value="${host}" placeholder="e.g. 192.168.4.1 or Luke-xxxx" />
      <button type="button" id="robotConnectBtn" class="btn-primary">Connect</button>
      <button type="button" id="robotDisconnectBtn" class="btn-secondary">Disconnect</button>
    </div>` : ''}
    <div class="connection-status" id="connectionStatus">Status: ${status}</div>
    <pre class="robot-log" id="robotLog"></pre>
  `;
  container.appendChild(panel);

  const statusEl = panel.querySelector('#connectionStatus') as HTMLElement;
  const logEl = panel.querySelector('#robotLog') as HTMLPreElement;
  logEl.textContent = getLog().join('\n');

  const unsubStatus = onStatus((s, detail) => {
    const labels: Record<ConnectionStatus, string> = {
      disconnected: '🔴 Disconnected',
      connecting: '🟡 Connecting…',
      connected: '🟢 Connected',
      error: '🔴 Error',
    };
    statusEl.textContent = `Status: ${labels[s]}${detail ? ` — ${detail}` : ''}`;
    statusEl.dataset.status = s;
  });

  const unsubMsg = onMessage(() => {
    logEl.textContent = getLog().join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  });

  if (showHost) {
    panel.querySelector('#robotConnectBtn')?.addEventListener('click', () => {
      const input = panel.querySelector('#robotHost') as HTMLInputElement;
      connect(input.value);
    });
    panel.querySelector('#robotDisconnectBtn')?.addEventListener('click', () => disconnect());
  }

  return () => {
    unsubStatus();
    unsubMsg();
  };
}
