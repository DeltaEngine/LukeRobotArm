import './style.css';
import Overview from './pages/Overview';
import Connect from './pages/Connect';
import Controller from './pages/Controller';
import Voice from './pages/Voice';
import Camera from './pages/Camera';
import Modules from './pages/Modules';
import Guides from './pages/Guides';
import Shop from './pages/Shop';

const content = document.querySelector('.content');
let activeCleanup: (() => void) | null = null;

const pageMap: Record<string, () => HTMLElement> = {
  overview: Overview,
  connect: Connect,
  controller: Controller,
  voice: Voice,
  camera: Camera,
  modules: Modules,
  guides: Guides,
  shop: Shop,
};

const menuButtons = [
  'overviewBtn',
  'connectBtn',
  'controllerBtn',
  'voiceBtn',
  'cameraBtn',
  'modulesBtn',
  'guidesBtn',
  'shopBtn',
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
    content.innerHTML = '<h2>Not found</h2>';
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
