'use client';

import { useEffect, useRef, useState } from 'react';

/** Camera scan. jsQR is loaded only after the person opens the camera. */
export function CodeScanner({ onCode, onClose }: { onCode: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const start = async () => {
      try {
        const { default: jsQR } = await import('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = videoRef.current;
        if (stop || !video || !ctx) return;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (stop || !videoRef.current || !ctx) return;
          const frame = videoRef.current;
          if (frame.readyState >= 2 && frame.videoWidth > 0) {
            canvas.width = frame.videoWidth;
            canvas.height = frame.videoHeight;
            ctx.drawImage(frame, 0, 0);
            const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(image.data, image.width, image.height);
            if (found?.data) {
              onCodeRef.current(found.data);
              return;
            }
          }
          timer = window.setTimeout(tick, 280);
        };
        tick();
      } catch {
        if (!stop) setError('Camera access is unavailable. Type the student number instead.');
      }
    };
    void start();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1A3C34]/15 bg-[#102820] text-white">
      <video ref={videoRef} className="aspect-video w-full bg-black object-cover" muted playsInline />
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-xs text-white/70">{error || 'Point the camera at the student QR code.'}</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Close</button>
      </div>
    </div>
  );
}
