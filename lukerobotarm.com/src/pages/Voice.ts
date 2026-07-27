import html from './Voice.html?raw';
import { isConnected, mountConnectionPanel, sendVoice, log } from '../robot';
import { loadPage } from './loadPage';

export default function Voice() {
  const container = loadPage(html, 'page voice-page');

  const cleanup = mountConnectionPanel(container.querySelector('#voiceConnect') as HTMLElement);
  const statusEl = container.querySelector('#voiceStatus') as HTMLElement;
  const transcriptEl = container.querySelector('#voiceTranscript') as HTMLElement;

  const SpeechRecognition =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

  let recognition: any = null;
  let listening = false;

  function setVoiceStatus(text: string, active = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('active', active);
  }

  function startListening() {
    if (!SpeechRecognition) {
      setVoiceStatus('Speech recognition is not supported in this browser.');
      log('Speech recognition not supported.');
      return;
    }
    if (!isConnected()) {
      setVoiceStatus('Not connected — connect to Luke first (commands still show locally).');
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      listening = true;
      setVoiceStatus('Listening…', true);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) transcriptEl.textContent = interim;
      if (finalText) {
        const command = finalText.trim().toLowerCase();
        transcriptEl.textContent = command;
        log('Voice: ' + command);
        sendVoice(command);
      }
    };

    recognition.onerror = (e: any) => {
      setVoiceStatus('Speech error: ' + (e.error || 'unknown'));
      log('Speech error: ' + e.error);
      listening = false;
    };

    recognition.onend = () => {
      if (listening) {
        try {
          recognition.start();
        } catch {
          listening = false;
          setVoiceStatus('Stopped');
        }
      } else {
        setVoiceStatus('Stopped');
      }
    };

    try {
      recognition.start();
    } catch (err) {
      setVoiceStatus('Could not start microphone');
      log(String(err));
    }
  }

  function stopListening() {
    listening = false;
    try {
      recognition?.stop();
    } catch {
      /* ignore */
    }
    setVoiceStatus('Stopped');
  }

  container.querySelector('#startVoiceBtn')?.addEventListener('click', startListening);
  container.querySelector('#stopVoiceBtn')?.addEventListener('click', stopListening);

  (container as any)._cleanup = () => {
    stopListening();
    cleanup();
  };

  return container;
}
