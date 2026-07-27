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

/** Wire [data-nav="pageName"] clicks to the matching sidebar button. */
export function bindNavLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.nav;
      if (page) document.getElementById(`${page}Btn`)?.click();
    });
  });
}
