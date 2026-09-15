import html from './Guides.html?raw';
import { bindNavLinks, loadPage } from './loadPage';
import { keepScreenAwake } from '../assembly/keepAwake';
import { currentStepLabel, LukeLive, scrollLukeSection } from '../assembly/lukeChat';

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

export default function Guides() {
  const container = loadPage(html, 'page guides-page get-started-page');
  bindNavLinks(container);

  const errorEl = container.querySelector('#askLukeError') as HTMLElement;
  const logEl = container.querySelector('#askLukeLog') as HTMLOListElement;
  const form = container.querySelector('#askLukeForm') as HTMLFormElement;
  const input = container.querySelector('#askLukeInput') as HTMLInputElement;
  const micBtn = container.querySelector('#askLukeMic') as HTMLButtonElement;

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
        while (logEl.children.length > 16) logEl.firstElementChild?.remove();
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

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    input.value = '';
    void live.sendText(text);
  });

  micBtn.addEventListener('click', () => {
    void live.toggleMic();
  });

  container.querySelectorAll<HTMLAnchorElement>('a[href="#poweron"], a[href^="#luke-"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      scrollLukeSection(a.getAttribute('href') || '');
    });
  });

  queueMicrotask(() => {
    const parent = container.parentElement;
    const chat = container.querySelector('#askLuke');
    if (parent && chat) parent.insertBefore(chat, container);
  });

  const clips = [...container.querySelectorAll<HTMLVideoElement>('video.assembly-clip')];
  const clipIo = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      }
    },
    { threshold: 0.4 },
  );
  for (const v of clips) {
    v.muted = true;
    clipIo.observe(v);
  }

  const releaseAwake = keepScreenAwake();
  (container as unknown as { _cleanup?: () => void })._cleanup = () => {
    clipIo.disconnect();
    for (const v of clips) v.pause();
    releaseAwake();
    live.stop();
  };
  return container;
}
