import html from './Connect.html?raw';
import { connect, disconnect, getHost, mountConnectionPanel, sendCommand } from '../robot';
import { loadPage } from './loadPage';

export default function Connect() {
  const container = loadPage(html, 'page connect-page');

  const cleanup = mountConnectionPanel(container.querySelector('#connectPanel') as HTMLElement);

  container.querySelector('#statusBtn')?.addEventListener('click', () => {
    sendCommand('get_status');
  });

  container.querySelector('#reconnectBtn')?.addEventListener('click', () => {
    disconnect(false);
    connect(getHost());
  });

  (container as any)._cleanup = cleanup;
  return container;
}
