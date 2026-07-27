import html from './Overview.html?raw';
import { bindNavLinks, loadPage } from './loadPage';

export default function Overview() {
  const container = loadPage(html, 'page overview-page');
  bindNavLinks(container);
  return container;
}
