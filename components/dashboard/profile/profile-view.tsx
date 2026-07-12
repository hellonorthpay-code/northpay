"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  LogOut,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/store/profile";
import { useAuth } from "@/lib/store/auth";
import { cn, formatDate } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const TIMEZONES = [
  { value: "America/Toronto",    label: "Eastern — Toronto" },
  { value: "America/New_York",   label: "Eastern — New York" },
  { value: "America/Chicago",    label: "Central — Chicago" },
  { value: "America/Winnipeg",   label: "Central — Winnipeg" },
  { value: "America/Denver",     label: "Mountain — Denver" },
  { value: "America/Edmonton",   label: "Mountain — Edmonton" },
  { value: "America/Los_Angeles",label: "Pacific — Los Angeles" },
  { value: "America/Vancouver",  label: "Pacific — Vancouver" },
  { value: "America/Halifax",    label: "Atlantic — Halifax" },
  { value: "America/St_Johns",   label: "Newfoundland — St. John's" },
  { value: "UTC",                label: "UTC" },
];

// ─────────────────────────────────────────────────────────────────────────
// Profile — rebuilt as a single centered column in the Apple-Settings idiom:
// grouped cards of compact rows (label left · value right) instead of
// full-width inputs. Changes auto-save; a "Saved" tick pulses in the card
// header as feedback. Cards that contain text inputs animate with OPACITY
// ONLY — a transformed ancestor mispositions the caret on mobile.
// ─────────────────────────────────────────────────────────────────────────
export function ProfileView() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { user, hydrated, hydrate, logout, deleteAccount } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // "Saved" pulse — shows briefly after any edit (changes persist as typed).
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function touch(patch: Parameters<typeof setProfile>[0]) {
    void setProfile(patch);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Logged-out is handled upstream by the route (LoginScreen); ProfileView is
  // only mounted once authenticated. These guards are a safety net.
  if (!hydrated) return null;
  if (!user) return null;

  const initials =
    (profile.firstName[0] ?? "").toUpperCase() +
    (profile.lastName[0] ?? "").toUpperCase();
  const displayName =
    `${profile.firstName} ${profile.lastName}`.trim() || "Your name";

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      {/* ── Back button (mobile only) ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground active:scale-95 md:hidden"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-[14px] font-medium">Back</span>
      </button>

      {/* ── Identity hero — centered, calm ── */}
      <motion.section
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease }}
        className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 px-6 py-9 text-center shadow-soft backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 320, damping: 22 }}
          className="relative mx-auto grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-to-br from-slate-700 to-slate-400 text-[24px] font-semibold text-white shadow-soft dark:from-rose-300 dark:to-amber-200 dark:text-black"
        >
          {initials || <User className="h-8 w-8" />}
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.4, ease }}
          className="relative mt-4 truncate text-[24px] font-semibold leading-none tracking-tightest"
        >
          {displayName}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26, duration: 0.4, ease }}
          className="relative mt-2 text-[12.5px] text-muted-foreground"
        >
          {user.email} · joined {formatDate(profile.joinedAt)}
        </motion.p>
      </motion.section>

      {/* ── Your details — one grouped card, iOS-settings rows ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12, duration: 0.5 }}
        className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl"
      >
        <header className="flex items-center justify-between px-5 pb-1 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Your details
          </p>
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-success"
              >
                <Check className="h-3 w-3" strokeWidth={3} />
                Saved
              </motion.span>
            )}
          </AnimatePresence>
        </header>

        <div className="pb-2">
          <Row label="First name">
            <RowInput
              value={profile.firstName}
              onChange={(v) => touch({ firstName: v })}
              placeholder="First name"
            />
          </Row>
          <Row label="Last name">
            <RowInput
              value={profile.lastName}
              onChange={(v) => touch({ lastName: v })}
              placeholder="Last name"
            />
          </Row>
          <Row label="Email">
            <RowInput
              type="email"
              value={profile.email}
              onChange={(v) => touch({ email: v })}
              placeholder="you@company.ca"
            />
          </Row>
          <Row label="Phone">
            <RowInput
              type="tel"
              value={profile.phone}
              onChange={(v) => touch({ phone: v })}
              placeholder="(416) 555-0100"
            />
          </Row>
          <Row label="Timezone" last asDiv>
            <Select
              value={
                TIMEZONES.some((t) => t.value === profile.timezone)
                  ? profile.timezone
                  : "America/Toronto"
              }
              onValueChange={(v) => touch({ timezone: v })}
            >
              <SelectTrigger className="h-auto w-auto justify-end gap-1.5 border-0 bg-transparent p-0 text-[14px] font-medium shadow-none focus:border-0 focus:bg-transparent focus:shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </div>
      </motion.section>

      {/* ── About NorthPay ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <Link
          href="/about"
          className="group flex items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/80 px-5 py-4 shadow-soft backdrop-blur-xl transition-colors duration-200 hover:bg-muted/30"
        >
          <div className="min-w-0">
            <p className="text-[14px] font-semibold tracking-tight">
              About NorthPay
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Our story, the team, and what we&rsquo;re building.
            </p>
          </div>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </motion.div>

      {/* ── Account ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28, duration: 0.5 }}
        className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl"
      >
        <header className="px-5 pb-1 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Account
          </p>
        </header>

        <div className="p-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[12px] text-muted-foreground">Signed in with</p>
              <p className="mt-0.5 truncate text-[13.5px] font-medium tracking-tight">
                {user.provider === "google" ? "Google" : "Email"} · {user.email}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              Active
            </span>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[13.5px] font-medium text-foreground transition-all duration-200 hover:bg-muted/50 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>

          {/* ── Danger zone ── */}
          <div className="mt-1 border-t border-border/50 pt-2">
            <AnimatePresence mode="wait" initial={false}>
              {!confirmDelete ? (
                <motion.div
                  key="delete-trigger"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(true);
                      setDeleteError(null);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-[0.98]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete account
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="delete-confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.26, ease }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                    <p className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Delete your account?
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      This permanently removes your account and{" "}
                      <strong>all employees, payroll runs, and settings</strong>.
                      This cannot be undone.
                    </p>

                    {deleteError && (
                      <p className="mt-2 text-[11.5px] font-medium text-destructive">
                        {deleteError}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                        className="flex-1 justify-center"
                      >
                        Cancel
                      </Button>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={async () => {
                          setDeleting(true);
                          setDeleteError(null);
                          const result = await deleteAccount();
                          if (result.ok) {
                            router.replace("/dashboard/profile");
                          } else {
                            setDeleteError(result.error);
                            setDeleting(false);
                          }
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground transition-all duration-200 hover:bg-destructive/90 active:scale-[0.97] disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleting ? "Deleting…" : "Delete forever"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Row primitives — iOS-settings style: label left, value right
// ─────────────────────────────────────────────────────────────────────────
function Row({
  label,
  children,
  last,
  asDiv,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
  /** Selects manage their own focus — don't wrap them in a <label>. */
  asDiv?: boolean;
}) {
  const Tag: "label" | "div" = asDiv ? "div" : "label";
  return (
    <Tag
      className={cn(
        "flex cursor-text items-center justify-between gap-6 px-5 py-3.5 transition-colors duration-200",
        "hover:bg-muted/20 focus-within:bg-muted/30",
        !last && "border-b border-border/40",
        asDiv && "cursor-default"
      )}
    >
      <span className="w-24 shrink-0 text-[13.5px] text-muted-foreground">
        {label}
      </span>
      {children}
    </Tag>
  );
}

function RowInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 bg-transparent text-right text-[14px] font-medium tracking-tight text-foreground outline-none transition-colors duration-200 placeholder:text-muted-foreground/50"
    />
  );
}
