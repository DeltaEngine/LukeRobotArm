import html from './Shop.html?raw';
import { loadPage } from './loadPage';

export default function Shop() {
  return loadPage(html, 'page shop-page');
}
