"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Ban,
  ArrowUpRight,
  ChevronDown,
  Chrome,
  CreditCard,
  ExternalLink,
  FileText,
  Globe,
  LineChart,
  MapPin,
  Smartphone,
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
  fetchAdminStripe,
  fetchAdminTraffic,
  type AdminStats,
  type AdminStripeSummary,
  type AdminTraffic,
  type AdminUserRow,
  type TrafficBreakdown,
  type TrafficDayPoint,
} from "@/lib/admin/client";
import { cn, formatDate } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

/** Critically damped — settles without overshoot, and stays interruptible. */
const indicatorSpring = { type: "spring", bounce: 0, duration: 0.35 } as const;

type AdminTab = "users" | "analytics" | "stripe";

const TABS: Array<{ id: AdminTab; label: string; icon: typeof Users }> = [
  { id: "users", label: "Users", icon: Users },
  { id: "analytics", label: "Analytics", icon: LineChart },
  { id: "stripe", label: "Stripe", icon: CreditCard },
];

export function AdminView() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("users");

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

      <AdminTabs value={tab} onChange={setTab} />

      {/* Panels cross-fade in place. No horizontal travel: the tab bar already
          carries the spatial story, and a sliding panel would fight it. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease }}
        >
          {tab === "users" && <UsersPanel stats={stats} onChanged={load} />}
          {tab === "analytics" && <AnalyticsPanel />}
          {tab === "stripe" && <StripePanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Segmented control.
 *
 * The active pill is a single shared element moved between tabs with a
 * layout animation, so switching reads as one object travelling rather than
 * two crossfading. The spring is critically damped (no overshoot) and
 * interruptible — tapping a third tab mid-flight redirects from wherever the
 * pill currently is instead of jumping.
 */
function AdminTabs({
  value,
  onChange,
}: {
  value: AdminTab;
  onChange: (t: AdminTab) => void;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Admin sections"
      className="flex gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1 backdrop-blur-xl"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              // Feedback lives on the press, not the release.
              "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium tracking-tight transition-colors duration-150 active:scale-[0.98]",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="admin-tab-pill"
                transition={reduced ? { duration: 0 } : indicatorSpring}
                className="absolute inset-0 rounded-xl bg-card shadow-soft"
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UsersPanel({
  stats,
  onChanged,
}: {
  stats: AdminStats;
  onChanged: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Active (30 days)" value={stats.activeUsers} />
        <StatCard label="New (7 days)" value={stats.newUsers7} />
        <StatCard label="New (30 days)" value={stats.newUsers30} />
        <StatCard label="Employees (all)" value={stats.totalEmployees} />
        <StatCard label="Payroll runs (all)" value={stats.totalPayrollRuns} />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          Users · {stats.users.length}
        </div>
        <ul className="divide-y divide-border/40">
          {stats.users.map((u) => (
            <UserRow key={u.id} user={u} onChanged={onChanged} />
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

const RANGES = [7, 30, 90] as const;

/**
 * Website audience.
 *
 * Reads real first-party traffic. Where a dimension has no data yet, the card
 * says so plainly rather than rendering an empty frame — "nothing here yet"
 * and "something broke" must never look alike.
 */
function AnalyticsPanel() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AdminTraffic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchAdminTraffic(days)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[13px] font-medium">{error}</p>
      </div>
    );
  }

  // The table exists only after the migration is run. Say exactly that.
  if (data && !data.ready) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-soft backdrop-blur-xl">
        <Globe className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-semibold tracking-tight">
          Traffic collection isn&apos;t set up yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
          Run the <code className="rounded bg-muted px-1.5 py-0.5">0004_page_views</code>{" "}
          migration in Supabase, and visits will start appearing here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Range control — same pill language as the tab bar above it, so the
          two read as the same kind of control at different scopes. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Website audience
        </p>
        <div className="flex gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
          {RANGES.map((d) => {
            const active = d === days;
            return (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-[12px] font-medium tabular-nums tracking-tight transition-colors active:scale-[0.97]",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="admin-range-pill"
                    transition={reduced ? { duration: 0 } : indicatorSpring}
                    className="absolute inset-0 rounded-full bg-card shadow-soft"
                  />
                )}
                <span className="relative">{d}d</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && !data ? (
        <p className="text-[13px] text-muted-foreground">Loading traffic…</p>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Visitors" value={data.visitors} hint="unique, cookieless" />
            <StatCard label="Pageviews" value={data.pageviews} />
            <StatCard label="Views / visitor" value={data.viewsPerVisitor} />
            <StatCard
              label="Top country"
              text={data.countries[0]?.label ?? "—"}
              hint={data.countries[0] ? `${data.countries[0].share}% of visits` : undefined}
            />
          </div>

          <TrafficChart points={data.series} days={data.days} />

          <div className="grid gap-3 lg:grid-cols-2">
            <BreakdownCard
              title="Countries"
              icon={Globe}
              rows={data.countries}
              empty="No visits recorded yet."
            />
            <BreakdownCard
              title="Where they came from"
              icon={ArrowUpRight}
              rows={data.referrers}
              empty="Everyone arrived directly — no referring sites yet."
            />
            <BreakdownCard
              title="Top pages"
              icon={FileText}
              rows={data.pages}
              empty="No pages viewed yet."
            />
            <BreakdownCard
              title="Cities"
              icon={MapPin}
              rows={data.cities}
              empty="No city data yet."
            />
            <BreakdownCard
              title="Devices"
              icon={Smartphone}
              rows={data.devices}
              empty="No device data yet."
            />
            <BreakdownCard
              title="Browsers"
              icon={Chrome}
              rows={data.browsers}
              empty="No browser data yet."
            />
          </div>

          <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Collected first-party — no cookies, no third-party scripts, and no IP
            addresses stored. Visitors are counted with a hash that changes every
            day, so nobody can be followed across days. Requests sending Do Not
            Track are skipped.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Visitors and pageviews over the window.
 *
 * Two series in one frame: solid bars are visitors, the lighter column behind
 * is pageviews. Stacking them separately would make the reader do the
 * comparison in their head.
 */
function TrafficChart({ points, days }: { points: TrafficDayPoint[]; days: number }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const totalVisitors = points.reduce((s, p) => s + p.visitors, 0);
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });

  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold tracking-tight">Visitors</p>
          <p className="text-[12px] text-muted-foreground">Last {days} days</p>
        </div>
        <p className="text-[22px] font-semibold leading-none tracking-tightest tabular-nums">
          {totalVisitors.toLocaleString()}
        </p>
      </div>

      <div className="mt-5 flex h-28 items-end gap-[2px]">
        {points.map((p) => (
          <div
            key={p.date}
            title={`${fmt(p.date)} · ${p.visitors} visitors · ${p.value} views`}
            className="relative flex-1"
            style={{ height: "100%" }}
          >
            {/* Pageviews sit behind at low contrast; visitors read as the
                primary figure in front. */}
            <div
              className="absolute bottom-0 w-full rounded-t-[3px] bg-foreground/15"
              style={{ height: p.value ? `${Math.max(4, (p.value / max) * 100)}%` : "2px" }}
            />
            <div
              className="absolute bottom-0 w-full rounded-t-[3px] bg-foreground/70 transition-colors hover:bg-foreground"
              style={{
                height: p.visitors ? `${Math.max(4, (p.visitors / max) * 100)}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10.5px] tabular-nums text-muted-foreground">
        <span>{points.length ? fmt(points[0].date) : ""}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-foreground/70" /> Visitors
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-foreground/15" /> Views
          </span>
        </span>
        <span>{points.length ? fmt(points[points.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}

/**
 * A ranked list with the share drawn *behind* the row rather than beside it.
 * Proximity and mapping: the bar occupies the row it describes, so the shape
 * of the list is readable before any number is.
 */
function BreakdownCard({
  title,
  icon: Icon,
  rows,
  empty,
  renderLabel,
}: {
  title: string;
  icon: typeof Globe;
  rows: TrafficBreakdown[];
  empty: string;
  renderLabel?: (r: TrafficBreakdown) => string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-7 text-center text-[12.5px] text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-border/40">
          {rows.map((r) => (
            <li key={r.label} className="relative">
              <div
                className="absolute inset-y-0 left-0 bg-foreground/[0.06]"
                style={{ width: `${Math.max(2, r.share)}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-4 px-5 py-2.5">
                <span className="min-w-0 truncate text-[13px] tracking-tight">
                  {renderLabel ? renderLabel(r) : r.label}
                </span>
                <span className="flex shrink-0 items-baseline gap-2.5">
                  <span className="text-[13px] font-semibold tabular-nums tracking-tight">
                    {r.value.toLocaleString()}
                  </span>
                  <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
                    {r.share}%
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StripePanel() {
  const [data, setData] = useState<AdminStripeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Loaded only when this tab is opened — the admin page shouldn't pay for a
  // Stripe round-trip on every visit.
  useEffect(() => {
    let alive = true;
    fetchAdminStripe()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Failed."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-[13px] text-muted-foreground">Loading transactions…</p>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/10 p-5 text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-[13px] font-medium">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (!data.configured) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-soft backdrop-blur-xl">
        <CreditCard className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-3 text-[14px] font-semibold tracking-tight">
          Stripe isn&apos;t connected
        </p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Transactions appear here once billing is configured.
        </p>
      </div>
    );
  }

  const money = (n: number) =>
    `$${n.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Net volume" value={data.netVolume} money hint="after refunds" />
        <StatCard label="MRR" value={data.mrr} money hint="recurring" />
        <StatCard label="Active subs" value={data.activeSubscriptions} />
        <StatCard label="Refunded" value={data.refundedTotal} money />
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          Transactions · {data.transactions.length}
        </div>
        <ul className="divide-y divide-border/40">
          {data.transactions.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium tracking-tight">
                  {t.email ?? "—"}
                </p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {formatDate(t.date)}
                  {t.description ? ` · ${t.description}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p
                    className={cn(
                      "text-[13.5px] font-semibold tabular-nums tracking-tight",
                      t.refunded && "text-muted-foreground line-through"
                    )}
                  >
                    {money(t.amount)}
                  </p>
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t.refunded
                      ? "Refunded"
                      : t.status === "succeeded"
                        ? "Paid"
                        : t.status}
                  </p>
                </div>
                {t.receiptUrl && (
                  <a
                    href={t.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open receipt"
                    className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </li>
          ))}
          {data.transactions.length === 0 && (
            <li className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
              No transactions yet.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  text,
  hint,
  money,
}: {
  label: string;
  /** Numeric figure. Omit when passing `text` instead. */
  value?: number;
  /** Non-numeric headline (e.g. a country) — rendered at the same weight. */
  text?: string;
  hint?: string;
  money?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/70 p-5 shadow-soft backdrop-blur-xl">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tightest tabular-nums">
        {text !== undefined
          ? text
          : money
            ? `$${(value ?? 0).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : (value ?? 0).toLocaleString()}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
      )}
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
