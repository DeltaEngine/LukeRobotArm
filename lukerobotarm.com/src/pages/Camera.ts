// @ts-ignore — js-aruco ships no types
import { AR } from 'js-aruco';
import html from './Camera.html?raw';
import { loadPage } from './loadPage';

type DetectMode = 'apriltag' | 'aruco';

type TagHit = {
  id: number;
  corners: Array<{ x: number; y: number }>;
  center: { x: number; y: number };
  distanceMm: number;
};

export default function Camera() {
  const container = loadPage(html, 'page camera-page');
  const session = createSession(container);
  (container as any)._cleanup = () => session.destroy();
  queueMicrotask(() => session.init());
  return container;
}

function createSession(root: HTMLElement) {
  let stream: MediaStream | null = null;
  let raf = 0;
  let worker: Worker | null = null;
  let workerReady = false;
  let detectBusy = false;
  let destroyed = false;
  let mode: DetectMode = 'apriltag';
  let arucoDetector: { detect: (data: ImageData) => any[] } | null = null;

  const video = () => root.querySelector('#cameraVideo') as HTMLVideoElement | null;
  const canvas = () => root.querySelector('#cameraCanvas') as HTMLCanvasElement | null;
  const familySelect = () => root.querySelector('#detectorFamily') as HTMLSelectElement | null;

  function setStatus(message: string, detected = false) {
    const el = root.querySelector('#tagStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('detected', detected);
  }

  function setDetails(htmlText: string) {
    const el = root.querySelector('#tagDetails');
    if (el) el.innerHTML = htmlText;
  }

  function initAruco() {
    try {
      if (AR?.Detector) {
        arucoDetector = new AR.Detector();
        return true;
      }
    } catch {
      /* ignore */
    }
    arucoDetector = null;
    return false;
  }

  function initAprilTagWorker() {
    worker?.terminate();
    workerReady = false;
    worker = new Worker('/apriltag/apriltag.js?postMessage=1');
    worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'ready') {
        workerReady = true;
        setStatus('AprilTag circle21h7 ready — point at the tag on the arm');
      }
    };
    worker.onerror = () => {
      setStatus('AprilTag worker failed — switch to ArUco or reload');
    };
  }

  function detectAprilTags(gray: Uint8Array, width: number, height: number): Promise<any[]> {
    const w = worker;
    if (!w || !workerReady) return Promise.resolve([]);
    return new Promise((resolve) => {
      const onMsg = (event: MessageEvent) => {
        if (event.data?.type !== 'detections') return;
        w.removeEventListener('message', onMsg);
        const detections = event.data.detections;
        resolve(Array.isArray(detections) ? detections : []);
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ type: 'detect', pixels: gray.buffer, width, height }, [gray.buffer]);
    });
  }

  async function startCamera() {
    const vid = video();
    if (!vid) return;
    stopTracks();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (destroyed) {
        stopTracks();
        return;
      }
      vid.srcObject = stream;
      await vid.play();
      const cvs = canvas();
      if (cvs) {
        cvs.width = vid.videoWidth || 640;
        cvs.height = vid.videoHeight || 480;
      }
      setStatus(mode === 'apriltag'
        ? 'Camera on — show AprilTag circle21h7 (ID 6)'
        : 'Camera on — show an ArUco marker');
      loop();
    } catch {
      setStatus('Camera access denied or unavailable');
    }
  }

  function stopTracks() {
    cancelAnimationFrame(raf);
    raf = 0;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    const vid = video();
    if (vid) vid.srcObject = null;
  }

  function stopCamera() {
    stopTracks();
    const cvs = canvas();
    cvs?.getContext('2d')?.clearRect(0, 0, cvs.width, cvs.height);
    setStatus('Camera stopped');
  }

  async function toggleFlash() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities = track.getCapabilities() as { torch?: boolean };
      if (!capabilities.torch) {
        setStatus('Flash not supported on this camera');
        return;
      }
      const torchOn = Boolean((track.getSettings() as { torch?: boolean }).torch);
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
    } catch {
      setStatus('Flash not supported on this camera');
    }
  }

  function toGray(imageData: ImageData): Uint8Array {
    const src = imageData.data;
    const gray = new Uint8Array(imageData.width * imageData.height);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    }
    return gray;
  }

  function tagSizePx(corners: Array<{ x: number; y: number }>): number {
    const edge1 = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const edge2 = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
    return (edge1 + edge2) / 2;
  }

  function estimateDistanceMm(pixelSize: number): number {
    const knownTagMm = 80;
    const focalPx = 500;
    return (knownTagMm * focalPx) / pixelSize;
  }

  function asHit(raw: any): TagHit | null {
    const corners = raw?.corners;
    if (!corners || corners.length < 4) return null;
    const pts = corners.map((c: any) => ({ x: c.x, y: c.y }));
    const center = raw.center ?? {
      x: (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4,
      y: (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4,
    };
    const poseZ = raw.pose?.t?.[2];
    const distanceMm = typeof poseZ === 'number' ? Math.abs(poseZ) * 1000 : estimateDistanceMm(tagSizePx(pts));
    return { id: raw.id ?? 0, corners: pts, center, distanceMm };
  }

  function drawHit(ctx: CanvasRenderingContext2D, hit: TagHit) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hit.corners[0].x, hit.corners[0].y);
    for (let i = 1; i < hit.corners.length; i++) ctx.lineTo(hit.corners[i].x, hit.corners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(hit.center.x, hit.center.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00ff00';
    ctx.font = '20px sans-serif';
    ctx.fillText(`ID: ${hit.id}`, hit.center.x + 10, hit.center.y - 10);
  }

  function showHit(hit: TagHit, cvs: HTMLCanvasElement) {
    const mm = Math.round(hit.distanceMm);
    const offsetX = Math.round(hit.center.x - cvs.width / 2);
    const offsetY = Math.round(cvs.height / 2 - hit.center.y);
    setStatus(`${mode === 'apriltag' ? 'AprilTag' : 'ArUco'} ID:${hit.id} detected`, true);
    setDetails(
      `Marker ID: ${hit.id}<br>` +
      `Distance: ${Math.round(mm / 10)} cm (${mm} mm)<br>` +
      `Pixel: (${Math.round(hit.center.x)}, ${Math.round(hit.center.y)})<br>` +
      `Offset: X ${offsetX > 0 ? '+' : ''}${offsetX}px, Y ${offsetY > 0 ? '+' : ''}${offsetY}px`,
    );
  }

  async function loop() {
    if (destroyed) return;
    const vid = video();
    const cvs = canvas();
    const ctx = cvs?.getContext('2d', { willReadFrequently: true });
    if (!vid || !cvs || !ctx || !stream) return;
    if (vid.videoWidth) {
      if (cvs.width !== vid.videoWidth) {
        cvs.width = vid.videoWidth;
        cvs.height = vid.videoHeight;
      }
      ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
      if (!detectBusy) {
        detectBusy = true;
        try {
          let hit: TagHit | null = null;
          if (mode === 'apriltag') {
            const gray = toGray(ctx.getImageData(0, 0, cvs.width, cvs.height));
            const detections = await detectAprilTags(gray, cvs.width, cvs.height);
            hit = detections.length ? asHit(detections[0]) : null;
          } else if (arucoDetector) {
            const markers = arucoDetector.detect(ctx.getImageData(0, 0, cvs.width, cvs.height));
            hit = markers?.length ? asHit(markers[0]) : null;
          }
          if (destroyed) return;
          ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
          if (hit) {
            drawHit(ctx, hit);
            showHit(hit, cvs);
          } else {
            setStatus(mode === 'apriltag'
              ? 'Looking for AprilTag circle21h7…'
              : 'Looking for ArUco markers…');
            setDetails('');
          }
        } catch {
          if (!destroyed) setStatus('Detection error');
        } finally {
          detectBusy = false;
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }

  function onVisibility() {
    if (destroyed) return;
    if (document.hidden) stopCamera();
    else startCamera();
  }

  function setMode(next: DetectMode) {
    mode = next;
    if (mode === 'aruco' && !arucoDetector) initAruco();
    setStatus(mode === 'apriltag'
      ? 'AprilTag circle21h7'
      : (arucoDetector ? 'ArUco detector ready' : 'ArUco library failed to load'));
  }

  return {
    init() {
      if (destroyed) return;
      initAprilTagWorker();
      initAruco();
      root.querySelector('#startCamera')?.addEventListener('click', () => startCamera());
      root.querySelector('#stopCamera')?.addEventListener('click', () => stopCamera());
      root.querySelector('#toggleFlash')?.addEventListener('click', () => toggleFlash());
      familySelect()?.addEventListener('change', () => {
        setMode((familySelect()?.value as DetectMode) || 'apriltag');
      });
      document.addEventListener('visibilitychange', onVisibility);
      startCamera();
    },
    destroy() {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopTracks();
      worker?.terminate();
      worker = null;
      workerReady = false;
    },
  };
}
