/**
 * Hold the screen on while Assembly is open (iOS auto-lock is often 30–60s).
 * Wake Lock needs a tap on iOS. Released when the page unmounts.
 */
export function keepScreenAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  let video: HTMLVideoElement | null = null;
  let draw = 0;
  let stopped = false;
  let asking = false;

  const request = async () => {
    if (stopped || asking || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      if (navigator.wakeLock) {
        try {
          if (lock && !lock.released) return;
          lock = await navigator.wakeLock.request('screen');
          lock.addEventListener('release', () => {
            if (!stopped && document.visibilityState === 'visible') void request();
          });
          return;
        } catch {
          return;
        }
      }
      startVideo();
    } finally {
      asking = false;
    }
  };

  const startVideo = () => {
    if (video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    if (!ctx || !canvas.captureStream) return;
    ctx.fillRect(0, 0, 2, 2);
    video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    video.srcObject = canvas.captureStream(1);
    document.body.appendChild(video);
    void video.play().catch(() => undefined);
    draw = window.setInterval(() => ctx.fillRect(0, 0, 2, 2), 15_000);
  };

  const onVis = () => {
    if (document.visibilityState === 'visible') void request();
  };
  document.addEventListener('visibilitychange', onVis);
  document.addEventListener('pointerdown', request, { passive: true });
  void request();

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('pointerdown', request);
    window.clearInterval(draw);
    void lock?.release();
    lock = null;
    video?.pause();
    video?.remove();
    video = null;
  };
}
