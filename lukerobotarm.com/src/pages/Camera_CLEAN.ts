export default function Camera() {
  const container = document.createElement('div');
  
  // Load the HTML content
  fetch('/src/pages/Camera.html')
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      initializeCamera();
    })
    .catch(() => {
      container.innerHTML = '<h2>Camera</h2><p>Error loading camera page</p>';
    });

  return container;
}

let videoStream: MediaStream | null = null;
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

async function initializeCamera() {
  video = document.getElementById('cameraVideo') as HTMLVideoElement;
  canvas = document.getElementById('cameraCanvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  
  const startBtn = document.getElementById('startCamera');
  const stopBtn = document.getElementById('stopCamera');
  const flashBtn = document.getElementById('toggleFlash');

  if (!video || !canvas) return;

  updateStatus('Camera ready - Need proper AprilTag library for detection', false);

  // Set canvas size to match video
  video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  });

  startBtn?.addEventListener('click', startCamera);
  stopBtn?.addEventListener('click', stopCamera);
  flashBtn?.addEventListener('click', toggleFlash);

  // Auto-start camera
  startCamera();
}

async function startCamera() {
  try {
    const constraints = {
      video: {
        facingMode: 'environment', // Use back camera on mobile
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    };

    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;
    
    video.addEventListener('play', () => {
      // Just show the camera feed without any detection
      updateStatus('Camera active - AprilTag detection needs proper library', false);
      clearTagInfo();
    });

    updateStatus('Camera started - No AprilTag detection available', false);
  } catch (error) {
    console.error('Error accessing camera:', error);
    updateStatus('Camera access denied or unavailable', false);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  
  // Clear canvas
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  updateStatus('Camera stopped', false);
}

async function toggleFlash() {
  if (!videoStream) return;
  
  const track = videoStream.getVideoTracks()[0];
  if (!track) return;
  
  try {
    // Note: Flash/torch is not widely supported yet
    const capabilities = track.getCapabilities() as any;
    if (capabilities.torch) {
      const settings = track.getSettings() as any;
      await track.applyConstraints({
        advanced: [{ torch: !settings.torch } as any]
      });
    }
  } catch (error) {
    console.error('Flash not supported:', error);
  }
}

function clearTagInfo() {
  const tagDetails = document.getElementById('tagDetails');
  if (tagDetails) {
    tagDetails.innerHTML = `
      <strong>AprilTag Detection Not Available</strong><br>
      To detect AprilTags, you need to integrate a proper AprilTag library such as:<br>
      - OpenCV.js (browser version) with AprilTag support<br>
      - js-aruco library<br>
      - WebAssembly compiled AprilTag detector<br><br>
      The camera feed is working but no detection is currently implemented.
    `;
  }
}

function updateStatus(message: string, detected: boolean) {
  const tagStatus = document.getElementById('tagStatus');
  if (!tagStatus) return;
  
  tagStatus.textContent = message;
  if (detected) {
    tagStatus.classList.add('detected');
  } else {
    tagStatus.classList.remove('detected');
  }
}
