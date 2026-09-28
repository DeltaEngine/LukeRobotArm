import html from './Assembly.html?raw';
import { bindNavLinks, loadPage } from './loadPage';
import { keepScreenAwake } from '../assembly/keepAwake';
import { currentStepLabel, isGuidesAnchor, LukeLive, sectionId } from '../assembly/lukeChat';
import { getStepHint, getStepScript } from '../assembly/luke-assembly-prompt';

interface StepMeta {
  id: string;
  name: string;
  label: string;
  dataStep: string;
}

const STEPS: StepMeta[] = [
  { id: 'luke-overview', name: 'Overview', label: 'Overview: Parts', dataStep: 'overview: parts — base, column, arm, top, gripper' },
  { id: 'luke-step-1', name: 'Lead Screw', label: 'Step 1: Lead Screw', dataStep: 'step 1: insert lead screw into base and align coupler until flush' },
  { id: 'luke-step-2', name: 'Fasten Screws', label: 'Step 2: Fasten Screws', dataStep: 'step 2: fasten lead screw with four screws' },
  { id: 'luke-step-3', name: 'First Rod', label: 'Step 3: First Rod', dataStep: 'step 3: insert first carbon fiber rod into base' },
  { id: 'luke-step-4', name: 'Slide Arm', label: 'Step 4: Slide Arm', dataStep: 'step 4: slide arm onto lead screw and rod, rotate 10 times' },
  { id: 'luke-step-5', name: 'Cable Chain', label: 'Step 5: Cable Chain', dataStep: 'step 5: clip motor cable chain and connect 3-pin motor cable' },
  { id: 'luke-step-6', name: 'Carbon Rods', label: 'Step 6: Carbon Rods', dataStep: 'step 6: insert remaining three carbon rods into base' },
  { id: 'luke-step-7', name: 'Top Plate', label: 'Step 7: Top Plate', dataStep: 'step 7: fit top plate C3 with marking facing up and back' },
  { id: 'luke-step-8', name: 'Top Bearing', label: 'Step 8: Top Bearing', dataStep: 'step 8: press top bearing onto lead screw with yellow tool' },
  { id: 'luke-step-9', name: 'E-Ring', label: 'Step 9: E-Ring', dataStep: 'step 9: snap retaining E-ring on top of lead screw' },
  { id: 'luke-step-10', name: 'Top Cover', label: 'Step 10: Top Cover', dataStep: 'step 10: snap on top cover C4' },
  { id: 'luke-step-11', name: 'Gripper', label: 'Step 11: Gripper', dataStep: 'step 11: twist gripper 10 degrees, click onto arm and plug in cable' },
  { id: 'luke-step-12', name: 'Column Cover', label: 'Step 12: Column Cover', dataStep: 'step 12: slide column cover down until it clicks into base' },
  { id: 'luke-step-13', name: 'Power on', label: 'Step 13: Power on', dataStep: 'step 13: connect 24V power brick to base' },
  { id: 'luke-step-14', name: 'Wi-Fi Setup', label: 'Step 14: Wi-Fi Setup', dataStep: 'step 14: switch to Luke Wi-Fi network' },
];

function joinTranscript(prev: string, chunk: string): string {
  if (!chunk) return prev;
  if (!prev) return tidySpeech(chunk);
  if (chunk.startsWith(prev)) return tidySpeech(chunk);
  if (prev.endsWith(chunk.trim()) && chunk.trim().length < prev.length) return tidySpeech(prev);
  const first = chunk[0] ?? '';
  const last = prev.slice(-1);
  if (/[.,!?;:)'"]/.test(first)) return tidySpeech(prev.replace(/\s+$/, '') + chunk.replace(/^\s+/, ''));
  if (/\s/.test(last) || /\s/.test(first)) {
    return tidySpeech(prev.replace(/\s+$/, '') + ' ' + chunk.replace(/^\s+/, ''));
  }
  return tidySpeech(prev + ' ' + chunk.replace(/^\s+/, ''));
}

function tidySpeech(s: string): string {
  return s
    .replace(/java\s*\.\s*lang\s*\.\s*String@[0-9a-fA-F]+/gi, '')
    .replace(/\bString@[0-9a-fA-F]+\b/g, '')
    .replace(/([.,!?;:])(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g, '$1 ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function Assembly() {
  const container = loadPage(html, 'page assembly-page get-started-page');
  bindNavLinks(container);

  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const step13P = container.querySelector('#luke-step-13 .step-info-panel p');
  if (step13P) step13P.textContent = getStepHint(13, lang);
  const step14P = container.querySelector('#luke-step-14 .step-info-panel p');
  if (step14P) step14P.textContent = getStepHint(14, lang);

  const errorEl = container.querySelector('#askLukeError') as HTMLElement;
  const logEl = container.querySelector('#askLukeLog') as HTMLOListElement;
  const form = container.querySelector('#askLukeForm') as HTMLFormElement;
  const input = container.querySelector('#askLukeInput') as HTMLInputElement;
  const micBtn = container.querySelector('#askLukeMic') as HTMLButtonElement;

  const prevStepBtn = container.querySelector('#prevStepBtn') as HTMLButtonElement;
  const stepIndicator = container.querySelector('#stepIndicator') as HTMLElement;
  const nextStepBtn = container.querySelector('#nextStepBtn') as HTMLButtonElement;
  const stepCards = [...container.querySelectorAll<HTMLElement>('.step-card')];

  let currentStepIndex = 0;
  let lastRole: 'luke' | 'you' | '' = 'luke';
  let greetingDone = false;
  let greetingStarted = false;

  const live = new LukeLive({
    note: (text) => {
      errorEl.hidden = !text;
      errorEl.textContent = text;
    },
    endTurn: () => {
      greetingDone = true;
      lastRole = '';
    },
    log: (role, text, streaming) => {
      const t = tidySpeech(text);
      if (!t || (role === 'luke' && /^text$/i.test(t))) return;
      if (role === 'you') greetingDone = true;

      const el = logEl.lastElementChild as HTMLElement | null;
      const continueLine = streaming && lastRole === role && el && el.classList.contains(role);

      if (role === 'luke' && !greetingDone && logEl.firstElementChild && !greetingStarted) {
        logEl.firstElementChild.className = 'luke';
        logEl.firstElementChild.textContent = tidySpeech(t);
        greetingStarted = true;
      } else if (role === 'luke' && !greetingDone && logEl.firstElementChild) {
        logEl.firstElementChild.textContent = joinTranscript(logEl.firstElementChild.textContent || '', t);
      } else if (continueLine && el) {
        el.textContent = joinTranscript(el.textContent || '', t);
      } else {
        const li = document.createElement('li');
        li.className = role;
        li.textContent = tidySpeech(t);
        logEl.appendChild(li);
        while (logEl.children.length > 20) logEl.firstElementChild?.remove();
      }
      lastRole = role;
      logEl.scrollTop = logEl.scrollHeight;
    },
    getStep: () => currentStepLabel(container),
    onMic: (on) => {
      micBtn.textContent = on ? 'Stop' : 'Enable mic';
      micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    },
  });

  void live.start();

  function findStepIndex(target: number | string): number {
    if (typeof target === 'number') {
      return Math.max(0, Math.min(STEPS.length - 1, target));
    }
    const id = sectionId(target);
    const idx = STEPS.findIndex((s) => s.id === id);
    return idx >= 0 ? idx : 0;
  }

  function showStep(target: number | string, userNavigated = false) {
    const idx = findStepIndex(target);
    const changed = idx !== currentStepIndex;
    currentStepIndex = idx;
    const currentMeta = STEPS[idx];

    stepCards.forEach((card) => {
      const match = card.id === currentMeta.id;
      card.classList.toggle('active', match);
      const v = card.querySelector<HTMLVideoElement>('video');
      if (v) {
        if (match) {
          v.currentTime = 0;
          void v.play().catch(() => undefined);
        } else {
          v.pause();
          v.currentTime = 0;
        }
      }
    });

    if (prevStepBtn) {
      if (idx === 0) {
        prevStepBtn.style.visibility = 'hidden';
        prevStepBtn.disabled = true;
      } else if (idx === 1) {
        prevStepBtn.style.visibility = 'visible';
        prevStepBtn.disabled = false;
        prevStepBtn.textContent = '< Overview';
      } else {
        prevStepBtn.style.visibility = 'visible';
        prevStepBtn.disabled = false;
        prevStepBtn.textContent = `< Step ${idx - 1}`;
      }
    }

    if (stepIndicator) {
      stepIndicator.innerHTML = `<strong>${currentMeta.label}</strong>`;
    }

    if (nextStepBtn) {
      if (idx === 0) {
        nextStepBtn.textContent = 'Step 1 >';
      } else if (idx < 14) {
        nextStepBtn.textContent = `Step ${idx + 1} >`;
      } else {
        nextStepBtn.textContent = 'Go to Control >';
      }
    }

    if (location.hash !== `#${currentMeta.id}`) {
      history.replaceState(null, '', `#${currentMeta.id}`);
    }

    if (userNavigated && changed) {
      greetingDone = true;
      lastRole = '';
      const script = getStepScript(idx, lang);
      live.speakStep(idx, currentMeta, script);
    }
  }

  prevStepBtn?.addEventListener('click', () => {
    if (currentStepIndex > 0) showStep(currentStepIndex - 1, true);
  });

  nextStepBtn?.addEventListener('click', () => {
    if (currentStepIndex === 14) {
      location.hash = '#connect';
    } else {
      showStep(currentStepIndex + 1, true);
    }
  });

  const onShowStepEvent = (e: Event) => {
    const detail = (e as CustomEvent<{ id?: string }>).detail;
    if (detail?.id) showStep(detail.id, false);
  };
  window.addEventListener('luke-show-step', onShowStepEvent);

  const initialHash = location.hash.replace('#', '');
  if (isGuidesAnchor(initialHash)) {
    const idx = findStepIndex(initialHash);
    showStep(initialHash, false);
    if (idx > 0) {
      greetingDone = true;
      lastRole = '';
      const script = getStepScript(idx, lang);
      if (logEl.firstElementChild) {
        logEl.firstElementChild.textContent = script;
      }
    }
  } else {
    showStep(0, false);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    void live.sendText(text);
  });

  micBtn.addEventListener('click', () => {
    void live.toggleMic();
  });

  const releaseAwake = keepScreenAwake();
  (container as unknown as { _cleanup?: () => void })._cleanup = () => {
    window.removeEventListener('luke-show-step', onShowStepEvent);
    stepCards.forEach((c) => {
      const v = c.querySelector<HTMLVideoElement>('video');
      if (v) v.pause();
    });
    releaseAwake();
    live.stop();
  };

  return container;
}
