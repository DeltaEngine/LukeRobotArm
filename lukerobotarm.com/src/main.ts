import './style.css';
import Overview from './pages/Overview';
import Control from './pages/Control';
import Voice from './pages/Voice';
import Camera from './pages/Camera';
import Modules from './pages/Modules';
import Guides from './pages/Guides';
import Shop from './pages/Shop';

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

const menuButtons = [
  'overviewBtn',
  'guidesBtn',
  'controlBtn',
  'shopBtn',
  'voiceBtn',
  'cameraBtn',
  'modulesBtn',
];

function setActiveButton(page: string) {
  menuButtons.forEach((btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const isActive = btnId === `${page}Btn`;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function showPage(page: string) {
  if (!content) return;
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
  const pageFn = pageMap[page];
  if (!pageFn) {
    content.innerHTML = '<section class="content-section"><p>Not found</p></section>';
    return;
  }

  const el = pageFn();
  content.appendChild(el);
  activeCleanup = (el as any)._cleanup ?? null;
  setActiveButton(page);

  // Keep URL hash in sync for deep links / shareable pages
  if (location.hash.replace('#', '') !== page) {
    history.replaceState(null, '', `#${page}`);
  }
}

menuButtons.forEach((btnId) => {
  document.getElementById(btnId)?.addEventListener('click', () => {
    showPage(btnId.replace('Btn', '').toLowerCase());
  });
});

function initialPage(): string {
  const hash = location.hash.replace('#', '').toLowerCase();
  if (hash && pageMap[hash]) return hash;
  return 'overview';
}

window.addEventListener('DOMContentLoaded', () => {
  showPage(initialPage());
});

window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '').toLowerCase();
  if (page && pageMap[page]) showPage(page);
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
