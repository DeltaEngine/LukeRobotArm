interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPrompt | null = null;
let appInstalled = false;
const standalone = window.matchMedia('(display-mode: standalone)');
const installed = () => appInstalled || standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
});
window.addEventListener('appinstalled', () => { installPrompt = null; appInstalled = true; });

export function bindInstallButton(container: HTMLElement): () => void {
  const button = container.querySelector<HTMLButtonElement>('#installApp')!;
  const help = container.querySelector<HTMLElement>('#installHelp')!;
  const refresh = () => { button.hidden = installed() || !window.isSecureContext; };
  refresh();
  window.addEventListener('appinstalled', refresh);
  standalone.addEventListener('change', refresh);
  button.addEventListener('click', async () => {
    help.hidden = true;
    if (!installPrompt) {
      help.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        ? 'Open in Safari, tap Share, then Add to Home Screen.'
        : 'Open your browser menu and choose Install app or Add to Home Screen. If unavailable, use Chrome or Edge, or keep using this website.';
      help.hidden = false;
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      help.textContent = choice.outcome === 'accepted' ? 'Installation accepted.' : 'Installation cancelled. You can keep using this website.';
    } catch {
      help.textContent = 'Installation unavailable. Try your browser menu or keep using this website.';
    } finally {
      button.disabled = false;
      help.hidden = false;
      refresh();
    }
  });
  return () => {
    window.removeEventListener('appinstalled', refresh);
    standalone.removeEventListener('change', refresh);
  };
}
