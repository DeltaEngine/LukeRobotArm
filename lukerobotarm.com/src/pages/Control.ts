import html from './Control.html?raw';
import {
  connect,
  connectVirtual,
  disconnect,
  getHost,
  isConnected,
  isVirtual,
  onStatus,
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

type RobotChoice = { id: string; label: string; virtual?: boolean };

const VIRTUAL_ROBOT: RobotChoice = { id: 'virtual', label: 'Virtual Luke', virtual: true };
const SEARCH_MS = 2500; // last host / AP only; upgrade: mDNS

export default function Connect() {
  const container = loadPage(html, 'page connect-page');
  const statusEl = container.querySelector('#robotSearchStatus') as HTMLElement;
  const listEl = container.querySelector('#robotList') as HTMLElement;
  let selectedId = '';
  let searchTimer = 0;

  function renderRobots(robots: RobotChoice[]) {
    listEl.innerHTML = '';
    robots.forEach((r) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'robot-card' + (r.id === selectedId ? ' active' : '');
      btn.textContent = r.label;
      btn.addEventListener('click', () => {
        selectedId = r.id;
        if (r.virtual) {
          connectVirtual();
          statusEl.textContent = 'Using a virtual Luke.';
        } else {
          connect(getHost());
        }
        renderRobots(robots);
      });
      listEl.appendChild(btn);
    });
  }

  function showFound() {
    window.clearTimeout(searchTimer);
    selectedId = 'luke';
    statusEl.textContent = 'Found a Luke robot on your local Wi-Fi.';
    renderRobots([{ id: 'luke', label: 'Luke' }]);
  }

  function showVirtual() {
    selectedId = '';
    statusEl.textContent = 'No Luke found on your local Wi-Fi.';
    renderRobots([VIRTUAL_ROBOT]);
  }

  const unsubStatus = onStatus((s) => {
    if (s === 'connected' && !isVirtual()) showFound();
  });

  if (isVirtual()) {
    selectedId = 'virtual';
    statusEl.textContent = 'No Luke found on your local Wi-Fi.';
    renderRobots([VIRTUAL_ROBOT]);
  } else if (isConnected()) {
    showFound();
  } else {
    statusEl.textContent = 'Searching for Luke on your local Wi-Fi…';
    connect(getHost());
    searchTimer = window.setTimeout(() => {
      if (!isConnected()) {
        disconnect(false);
        showVirtual();
      }
    }, SEARCH_MS);
  }

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

  (container as any)._cleanup = () => {
    window.clearTimeout(searchTimer);
    unsubStatus();
  };
  return container;
}
