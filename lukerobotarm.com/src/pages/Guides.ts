import html from './Guides.html?raw';
import { loadPage } from './loadPage';

export default function Guides() {
  return loadPage(html, 'page guides-page');
}
