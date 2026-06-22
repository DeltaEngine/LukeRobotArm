import './style.css'
import Overview from './pages/Overview';
import Connect from './pages/Connect';
import Controller from './pages/Controller';
import Voice from './pages/Voice';
import Camera from './pages/Camera';
import Modules from './pages/Modules';
import Guides from './pages/Guides';
import Shop from './pages/Shop';

let socket: WebSocket | null = null;

const output = (msg: string) => {
  const out = document.getElementById("output");
  if (out) {
    out.textContent += msg + "\n";
  } else {
    console.log(msg); // Fallback to console if output element doesn't exist
  }
};

// 🔊 Voice Recognition
const startVoiceRecognition = () => {
  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SpeechRecognition) return output("Speech recognition not supported.");

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;

  recognition.onresult = (event: Event) => {
    const resultEvent = event as any;
    const command = resultEvent.results[0][0].transcript.toLowerCase();
    output("Voice: " + command);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ voice: command }));
    }
  };

  recognition.onerror = (e: any) => output("Speech error: " + e.error);
  recognition.start();
};

// 🔌 WebSocket Connect
document.getElementById("connectBtn")!.addEventListener("click", () => {
  socket = new WebSocket("ws://192.168.4.1/ws"); // Update to your ESP32 IP and path

  socket.onopen = () => output("✅ Connected to robot");
  socket.onmessage = (event) => output("📥 " + event.data);
  socket.onerror = () => output("❌ WebSocket error");
  socket.onclose = () => output("🔌 Disconnected");
});

// 📡 Send Command
document.getElementById("sendBtn")!.addEventListener("click", () => {
  const cmd = (document.getElementById("commandInput") as HTMLInputElement).value;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ command: cmd }));
    output("📤 Sent: " + cmd);
  } else {
    output("⚠️ Not connected");
  }
});

// 📋 Request Status
document.getElementById("connectBtn")!.addEventListener("click", () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ command: "get_status" }));
  }
});

// 🎤 Start Voice
document.getElementById("voiceBtn")!.addEventListener("click", () => {
  startVoiceRecognition();
});

const outputElement = document.getElementById('output');
function log(msg: string) {
  if (outputElement) outputElement.textContent = msg;
}

const content = document.querySelector('.content');
const menuButtons = [
  'overviewBtn', 'connectBtn', 'controllerBtn', 'voiceBtn', 'cameraBtn', 'modulesBtn', 'guidesBtn', 'shopBtn'
];

const pageMap: Record<string, () => HTMLElement> = {
  overview: Overview,
  connect: Connect,
  controller: Controller,
  voice: Voice,
  camera: Camera,
  modules: Modules,
  guides: Guides,
  shop: Shop,
};

function showPage(page: string) {
  if (content) {
    content.innerHTML = '';
    const pageFn = pageMap[page];
    if (pageFn) {
      content.appendChild(pageFn());
    } else {
      content.innerHTML = '<h2>Not found</h2>';
    }
  }
}

menuButtons.forEach(btnId => {
  document.getElementById(btnId)?.addEventListener('click', () => {
    showPage(btnId.replace('Btn', '').toLowerCase());
  });
});

window.addEventListener('DOMContentLoaded', () => {
  showPage('overview');
});
