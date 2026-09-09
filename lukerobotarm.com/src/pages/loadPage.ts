/**
 * Mount a page from a colocated .html file imported with Vite `?raw`.
 *
 * @example
 * import html from './Connect.html?raw';
 * const el = loadPage(html, 'page connect-page');
 */
export function loadPage(html: string, className = 'page'): HTMLElement {
  const container = document.createElement('div');
  container.className = className;
  container.innerHTML = html;
  return container;
}

const PAGE_BTN: Record<string, string> = {
  overview: 'overviewBtn',
  guides: 'guidesBtn',
  assembly: 'guidesBtn',
  connect: 'connectBtn',
  control: 'connectBtn',
  shop: 'shopBtn',
};

/** Wire in-page #hash / [data-nav] clicks to the matching sidebar button. */
export function bindNavLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"], [data-nav]').forEach((el) => {
    const href = el.getAttribute('href') ?? '';
    const hash = href.startsWith('#') ? href.slice(1).toLowerCase() : '';
    const page = (el.dataset.nav || hash).toLowerCase();
    const btnId = PAGE_BTN[page];
    if (!btnId) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(btnId)?.click();
    });
  });
}
