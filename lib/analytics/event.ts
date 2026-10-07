"use client";

/**
 * Record that a visitor did something, once per browser session.
 *
 * Fire-and-forget by design: a beacon that fails, is blocked by an extension
 * or is refused offline must never surface to a visitor or hold up the UI,
 * so every path here swallows its error.
 *
 * sessionStorage keeps a reload from counting twice. It is a best-effort
 * guard, not the real one — the server also folds events by the daily
 * visitor hash, so "how many people" stays right even where storage is
 * unavailable (private windows, blocked site data) and this returns early.
 */
export function trackEvent(name: string): void {
  if (typeof window === "undefined") return;
  const key = `np-ev-${name}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Storage unavailable — still send it. A duplicate is better than a
    // silent gap, and the server de-duplicates by visitor anyway.
  }
  try {
    // keepalive so the request survives the visitor navigating away.
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: name }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
