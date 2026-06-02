"use client";

import { useEffect, useRef } from "react";

/**
 * Ping-pong video — bulletproof implementation.
 *
 * Browser seeks on `<video>` stall on non-keyframes, so reverse playback
 * via `currentTime -=` is inherently jittery. Instead:
 *
 *   1. Hide the video element off-screen, play it forward ONCE.
 *   2. As each frame renders (`requestVideoFrameCallback`), copy it into
 *      a visible canvas AND cache it as an `ImageBitmap`.
 *   3. Once captured, drive the visible canvas from cached frames at a
 *      steady 30 fps, walking the index forward then backward forever.
 *      No more seeks, no more stalls — perfectly seamless reverse loop.
 */
export function PingPongVideo({
  src,
  className,
  style,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const video: HTMLVideoElement = videoRef.current;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    type VFC = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    const v = video as VFC;

    const FPS = 30;
    const FRAME_INTERVAL = 1000 / FPS;
    const MAX_W = 1280;

    const frames: ImageBitmap[] = [];
    let cancelled = false;
    let captureDone = false;
    let rafId: number | null = null;

    function onMeta() {
      const aspect = video.videoHeight / video.videoWidth || 9 / 16;
      const w = Math.min(video.videoWidth || MAX_W, MAX_W);
      const h = Math.round(w * aspect);
      canvas.width = w;
      canvas.height = h;
      video.play().catch(() => {});
    }

    function captureNext() {
      if (cancelled || captureDone) return;
      // Wrap in try/catch: if the source is CORS-tainted, drawImage +
      // createImageBitmap throw a SecurityError. We must never let that
      // bubble (it would trip React's error boundary). Fall back to just
      // painting the live video to the canvas (no ping-pong cache).
      try {
        ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
        createImageBitmap(canvas)
          .then((bmp) => {
            if (cancelled) {
              bmp.close();
              return;
            }
            frames.push(bmp);
          })
          .catch(() => {
            /* tainted canvas — skip caching this frame */
          });
      } catch {
        /* tainted/decode error — ignore this frame */
      }
      if (v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(captureNext);
      } else {
        rafId = requestAnimationFrame(captureNext);
      }
    }

    function onEnded() {
      captureDone = true;
      startPingPong();
    }

    function startPingPong() {
      if (cancelled || frames.length === 0) return;
      let idx = frames.length - 1;
      let dir: 1 | -1 = -1;
      let last = performance.now();

      function tick(now: number) {
        if (cancelled) return;
        if (now - last >= FRAME_INTERVAL) {
          last = now;
          try {
            ctx!.drawImage(frames[idx], 0, 0);
          } catch {
            /* canvas detached mid-teardown — stop quietly */
            return;
          }
          idx += dir;
          if (idx >= frames.length - 1) {
            idx = frames.length - 1;
            dir = -1;
          } else if (idx <= 0) {
            idx = 0;
            dir = 1;
          }
        }
        rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
    }

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);
    if (v.requestVideoFrameCallback) {
      v.requestVideoFrameCallback(captureNext);
    }

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
      frames.forEach((b) => b.close());
    };
  }, [src]);

  return (
    <>
      <canvas ref={canvasRef} className={className} style={style} />
      <video
        ref={videoRef}
        muted
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <source src={src} type="video/mp4" />
      </video>
    </>
  );
}
