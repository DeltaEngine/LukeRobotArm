import './style.css';
import Overview from './pages/Overview';
import Control from './pages/Control';
import Voice from './pages/Voice';
import Camera from './pages/Camera';
import Modules from './pages/Modules';
import Guides from './pages/Guides';
import Shop from './pages/Shop';
import { isGuidesAnchor, scrollLukeSection } from './assembly/lukeChat';

const content = document.querySelector('.content');
let activeCleanup: (() => void) | null = null;
let currentPage = 'overview';

const pageMap: Record<string, () => HTMLElement> = {
  overview: Overview,
  guides: Guides,
  connect: Control,
  shop: Shop,
  voice: Voice,
  camera: Camera,
  modules: Modules,
};

const hashAliases: Record<string, string> = { control: 'connect', assembly: 'guides' };

const menuButtons = [
  'overviewBtn',
  'guidesBtn',
  'connectBtn',
  'shopBtn',
];

function resolvePage(raw: string): string {
  const key = hashAliases[raw] ?? raw;
  if (pageMap[key]) return key;
  return isGuidesAnchor(raw) ? 'guides' : '';
}

function setActiveButton(page: string) {
  menuButtons.forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isActive = btnId === `${page}Btn`;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function showPage(raw: string) {
  if (!content) return;
  const page = resolvePage(raw);
  if (!page) return;
  currentPage = page;
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch {
      /* ignore */
    }
    activeCleanup = null;
  }
  content.innerHTML = '';
  const el = pageMap[page]();
  content.appendChild(el);
  activeCleanup = (el as any)._cleanup ?? null;
  setActiveButton(page);
  content.scrollTop = 0;
  window.scrollTo(0, 0);

  const fragment = location.hash.replace('#', '').toLowerCase();
  if (!isGuidesAnchor(fragment) && fragment !== page) {
    history.replaceState(null, '', `#${page}`);
  }
  if (page === 'guides' && isGuidesAnchor(fragment)) {
    requestAnimationFrame(() => scrollLukeSection(fragment));
  }
}

menuButtons.forEach((btnId) => {
  document.getElementById(btnId)?.addEventListener('click', () => {
    showPage(btnId.replace('Btn', '').toLowerCase());
  });
});

function initialPage(): string {
  const hash = location.hash.replace('#', '').toLowerCase();
  return resolvePage(hash) || 'overview';
}

window.addEventListener('DOMContentLoaded', () => {
  showPage(initialPage());
});

window.addEventListener('hashchange', () => {
  const raw = location.hash.replace('#', '').toLowerCase();
  const page = resolvePage(raw);
  if (!page) return;
  if (page === currentPage) {
    if (isGuidesAnchor(raw)) scrollLukeSection(raw);
    return;
  }
  showPage(raw);
});

// Live-reload page HTML/TS while on `npm run dev` (not `vite preview`, which only serves dist/)
if (import.meta.hot) {
  const hmrPages = [
    { path: './pages/Overview', key: 'overview' },
    { path: './pages/Guides', key: 'guides' },
    { path: './pages/Control', key: 'connect' },
    { path: './pages/Shop', key: 'shop' },
    { path: './pages/Voice', key: 'voice' },
    { path: './pages/Camera', key: 'camera' },
    { path: './pages/Modules', key: 'modules' },
  ] as const;

  import.meta.hot.accept(
    hmrPages.map((p) => p.path),
    (mods) => {
      mods?.forEach((mod, i) => {
        if (mod?.default) pageMap[hmrPages[i].key] = mod.default;
      });
      showPage(currentPage);
    },
  );
}
