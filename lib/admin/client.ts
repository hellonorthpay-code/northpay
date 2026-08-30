"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/store/auth";
import type { AdminStats, AdminStripeSummary } from "@/lib/admin/types";

export type {
  AdminStats,
  AdminUserRow,
  AdminAnalytics,
  AdminDayPoint,
  AdminStripeSummary,
  AdminStripeTx,
} from "@/lib/admin/types";

/** fetch() with the current Supabase access token attached as a bearer. */
async function authedFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

// Cache the admin check per access token so the sidebar, mobile nav, and the
// admin view don't each fire their own request.
let cache: { token: string; value: boolean } | null = null;

export async function fetchIsAdmin(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return false;
  if (cache && cache.token === token) return cache.value;
  try {
    const res = await authedFetch("/api/admin/me");
    const json = (await res.json()) as { isAdmin?: boolean };
    cache = { token, value: !!json.isAdmin };
    return cache.value;
  } catch {
    return false;
  }
}

/** Hook: is the signed-in user an admin? Re-checks when the user changes. */
export function useIsAdmin(): boolean {
  const user = useAuth((s) => s.user);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    fetchIsAdmin().then((v) => {
      if (alive) setIsAdmin(v);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return isAdmin;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const res = await authedFetch("/api/admin/stats");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as AdminStats;
}

/** Every Stripe transaction on the platform, plus volume and MRR. */
export async function fetchAdminStripe(): Promise<AdminStripeSummary> {
  const res = await authedFetch("/api/admin/stripe");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return (await res.json()) as AdminStripeSummary;
}

export async function adminSetSuspended(id: string, suspend: boolean) {
  const res = await authedFetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: suspend ? "suspend" : "unsuspend" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Could not update user.");
  }
}

export async function adminDeleteUser(id: string) {
  const res = await authedFetch(`/api/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Could not delete user.");
  }
}
