import html from './Modules.html?raw';
import { loadPage } from './loadPage';

export default function Modules() {
  return loadPage(html, 'page modules-page');
}
