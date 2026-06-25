"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminDeleteUser,
  adminSetSuspended,
  fetchAdminStats,
  type AdminStats,
  type AdminUserRow,
} from "@/lib/admin/client";
import { cn, formatDate } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Loading admin data…</p>;
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-[14px] font-semibold tracking-tight">
            {error === "Not authorized."
              ? "You don't have admin access."
              : "Couldn't load admin data"}
          </p>
          {error !== "Not authorized." && (
            <p className="mt-1 text-[12.5px] opacity-80">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease }}
        className="flex items-center gap-3 rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl"
      >
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-foreground text-background">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[14px] font-semibold tracking-tight">Admin panel</p>
          <p className="text-[12.5px] text-muted-foreground">
            Platform-wide overview and user management.
          </p>
        </div>
      </motion.div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Active (30 days)" value={stats.activeUsers} />
        <StatCard label="New (7 days)" value={stats.newUsers7} />
        <StatCard label="New (30 days)" value={stats.newUsers30} />
        <StatCard label="Employees (all)" value={stats.totalEmployees} />
        <StatCard label="Payroll runs (all)" value={stats.totalPayrollRuns} />
      </div>

      {/* ─── Users table ─── */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Users · {stats.users.length}
        </div>
        <ul className="divide-y divide-border/40">
          {stats.users.map((u) => (
            <UserRow key={u.id} user={u} onChanged={load} />
          ))}
          {stats.users.length === 0 && (
            <li className="px-5 py-6 text-center text-[12.5px] text-muted-foreground">
              No users yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tightest tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function UserRow({
  user,
  onChanged,
}: {
  user: AdminUserRow;
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setRowError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const initials =
    user.name !== "—"
      ? user.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : user.email[0]?.toUpperCase() ?? "?";

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Clicking the identity area expands the per-user usage detail. */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-semibold text-foreground">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[13.5px] font-medium tracking-tight">
              {user.name}
              {user.suspended && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                  Suspended
                </span>
              )}
            </p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {user.email} · joined{" "}
              {user.createdAt ? formatDate(user.createdAt) : "—"} ·{" "}
              {user.lastSignInAt
                ? `active ${formatDate(user.lastSignInAt)}`
                : "never signed in"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => adminSetSuspended(user.id, !user.suspended))}
          >
            {user.suspended ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                Unsuspend
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" />
                Suspend
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              confirmDelete
                ? run(() => adminDeleteUser(user.id))
                : setConfirmDelete(true)
            }
            className={cn(
              confirmDelete
                ? "bg-destructive/15 text-destructive"
                : "text-destructive"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? "Confirm delete" : "Delete"}
          </Button>
        </div>
      </div>

      {/* Usage detail — hidden until the row is clicked. */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease }}
            style={{ overflow: "hidden" }}
          >
            <div className="mt-3 grid grid-cols-3 gap-2 pl-0 sm:pl-12">
              <MiniStat label="Employees" value={String(user.employeeCount)} />
              <MiniStat
                label="Payroll runs"
                value={String(user.payrollRunCount)}
              />
              <MiniStat
                label="Last run"
                value={user.lastRunAt ? formatDate(user.lastRunAt) : "—"}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rowError && <p className="mt-2 text-[11px] text-destructive">{rowError}</p>}
    </li>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 px-3.5 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
