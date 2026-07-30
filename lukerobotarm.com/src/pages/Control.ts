import html from './Control.html?raw';
import {
  connect,
  disconnect,
  getHost,
  mountConnectionPanel,
  send,
  sendCommand,
} from '../robot';
import { loadPage } from './loadPage';

interface JointDef {
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
}

const JOINTS: JointDef[] = [
  { id: 'j1', label: 'Base (θ1)', min: -180, max: 180, value: 0 },
  { id: 'j2', label: 'Shoulder (θ2)', min: -90, max: 90, value: 0 },
  { id: 'j3', label: 'Z height', min: 0, max: 100, value: 50 },
  { id: 'j4', label: 'Wrist', min: -180, max: 180, value: 0 },
  { id: 'j5', label: 'Gripper', min: 0, max: 100, value: 50 },
];

export default function Connect() {
  const container = loadPage(html, 'page connect-page');

  const cleanup = mountConnectionPanel(container.querySelector('#connectPanel') as HTMLElement);

  const playerHost = container.querySelector('#playerHost') as HTMLInputElement | null;
  if (playerHost) playerHost.value = getHost();

  container.querySelector('#statusBtn')?.addEventListener('click', () => {
    sendCommand('get_status');
  });

  container.querySelector('#reconnectBtn')?.addEventListener('click', () => {
    disconnect(false);
    connect(getHost());
  });

  const jointTable = container.querySelector('#jointTable') as HTMLElement;
  const jointState: Record<string, number> = {};

  JOINTS.forEach((j) => {
    jointState[j.id] = j.value;
    const row = document.createElement('div');
    row.className = 'joint-row';
    row.innerHTML = `
      <span class="joint-label">${j.label}</span>
      <input type="range" class="slider" id="slider-${j.id}"
        min="${j.min}" max="${j.max}" value="${j.value}" />
      <span class="joint-value" id="val-${j.id}">${j.value}</span>
    `;
    jointTable.appendChild(row);
    const slider = row.querySelector(`#slider-${j.id}`) as HTMLInputElement;
    const val = row.querySelector(`#val-${j.id}`) as HTMLElement;
    slider.addEventListener('input', () => {
      jointState[j.id] = Number(slider.value);
      val.textContent = slider.value;
    });
  });

  container.querySelector('#sendJointsBtn')?.addEventListener('click', () => {
    send({ command: 'set_joints', joints: { ...jointState } });
  });

  container.querySelector('#homeBtn')?.addEventListener('click', () => {
    sendCommand('home');
  });

  container.querySelector('#openGripBtn')?.addEventListener('click', () => {
    sendCommand('gripper', { open: true });
  });

  container.querySelector('#closeGripBtn')?.addEventListener('click', () => {
    sendCommand('gripper', { open: false });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sendCommand('move', { direction: btn.dataset.move });
    });
  });

  container.querySelector('#sendBtn')?.addEventListener('click', () => {
    const input = container.querySelector('#commandInput') as HTMLInputElement;
    const cmd = input.value.trim();
    if (!cmd) return;
    if (cmd.startsWith('{')) {
      try {
        send(JSON.parse(cmd));
      } catch {
        sendCommand(cmd);
      }
    } else {
      sendCommand(cmd);
    }
  });

  container.querySelector('#playerConnectBtn')?.addEventListener('click', () => {
    const host = (container.querySelector('#playerHost') as HTMLInputElement).value;
    connect(host);
  });

  container.querySelector('#playerResetBtn')?.addEventListener('click', () => {
    sendCommand('reset');
  });

  let loadedSequence: unknown = null;

  container.querySelector('#moveFile')?.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    const preview = container.querySelector('#movePreview') as HTMLPreElement;
    if (!file) return;
    const text = await file.text();
    try {
      loadedSequence = JSON.parse(text);
      preview.textContent = JSON.stringify(loadedSequence, null, 2).slice(0, 4000);
    } catch {
      loadedSequence = { raw: text };
      preview.textContent = text.slice(0, 4000);
    }
  });

  container.querySelector('#playMoveBtn')?.addEventListener('click', () => {
    if (!loadedSequence) {
      sendCommand('play');
      return;
    }
    send({ command: 'play', sequence: loadedSequence });
  });

  container.querySelector('#stopMoveBtn')?.addEventListener('click', () => {
    sendCommand('stop');
  });

  (container as any)._cleanup = cleanup;
  return container;
}
