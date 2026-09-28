import { affordableBand, catalog } from '../catalog';
import html from './Overview.html?raw';
import { bindNavLinks, loadPage } from './loadPage';

export default function Overview() {
  const container = loadPage(html, 'page overview-page');
  const band = container.querySelector('#priceBand');
  if (band) band.textContent = affordableBand(catalog());
  bindNavLinks(container);
  return container;
}
