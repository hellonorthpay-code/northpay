"use client";

import { useEffect, useState } from "react";
import { PingPongVideo } from "@/components/ui/ping-pong-video";
import { LoginView } from "./login-view";

/**
 * The logged-out login screen: the login card over a gradient backdrop.
 *
 * Kept separate from the (heavy) logged-in ProfileView so a first-time
 * visitor only downloads this light path. The background video is desktop-only
 * — on mobile it was a multi-MB download for a barely-visible effect that
 * stalled the first navigation, so phones get just the gradient + orbs.
 */
export function LoginScreen() {
  const [showVideo, setShowVideo] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setShowVideo(true);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {showVideo && (
          <PingPongVideo
            src="https://videos.pexels.com/video-files/37014189/15682104_2560_1440_30fps.mp4"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.22, mixBlendMode: "luminosity" }}
          />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-transparent to-background/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background" />

        {/* Colour tint orbs */}
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-rose-400/10 blur-[100px]" />
        <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-sky-400/10 blur-[100px]" />
      </div>

      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto px-4 py-20">
        <LoginView />
      </div>
    </>
  );
}
