import html from './Guides.html?raw';
import { bindNavLinks, loadPage } from './loadPage';

export default function Guides() {
  const container = loadPage(html, 'page guides-page get-started-page');
  bindNavLinks(container);
  return container;
}
