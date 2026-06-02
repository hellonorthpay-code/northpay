"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Briefcase, Globe2, LogOut, Mail, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PingPongVideo } from "@/components/ui/ping-pong-video";
import { LoginView } from "./login-view";

const TIMEZONES = [
  { value: "America/Toronto",    label: "Eastern Time — Toronto" },
  { value: "America/New_York",   label: "Eastern Time — New York" },
  { value: "America/Chicago",    label: "Central Time — Chicago" },
  { value: "America/Winnipeg",   label: "Central Time — Winnipeg" },
  { value: "America/Denver",     label: "Mountain Time — Denver" },
  { value: "America/Edmonton",   label: "Mountain Time — Edmonton" },
  { value: "America/Los_Angeles",label: "Pacific Time — Los Angeles" },
  { value: "America/Vancouver",  label: "Pacific Time — Vancouver" },
  { value: "America/Halifax",    label: "Atlantic Time — Halifax" },
  { value: "America/St_Johns",   label: "Newfoundland Time — St. John's" },
  { value: "UTC",                label: "UTC" },
];

export function ProfileView() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { user, hydrated, hydrate, logout, deleteAccount } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;
  if (!user) return <LoginWithVideo />;

  const initials =
    (profile.firstName[0] ?? "").toUpperCase() +
    (profile.lastName[0] ?? "").toUpperCase();
  const displayName =
    `${profile.firstName} ${profile.lastName}`.trim() || "Your name";

  return (
    <div className="space-y-5">
      {/* ── Identity hero card ── */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-5 shadow-soft backdrop-blur-xl md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-rose-200/30 blur-3xl dark:bg-rose-500/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-500/10" />

        <div className="relative flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-400 text-[20px] font-semibold text-white shadow-soft dark:from-rose-300 dark:to-amber-200 dark:text-black">
            {initials || <User className="h-7 w-7" />}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 truncate text-[22px] font-semibold leading-none tracking-tightest md:text-[26px]">
              {displayName}
            </p>
            <p className="mt-1.5 truncate text-[12.5px] text-muted-foreground">
              Joined {formatDate(profile.joinedAt)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Two-column on desktop, single on mobile ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileGroup icon={User} title="About you">
          <Field label="First name">
            <Input
              value={profile.firstName}
              onChange={(e) => setProfile({ firstName: e.target.value })}
            />
          </Field>
          <Field label="Last name">
            <Input
              value={profile.lastName}
              onChange={(e) => setProfile({ lastName: e.target.value })}
            />
          </Field>
        </ProfileGroup>

        <ProfileGroup icon={Mail} title="Contact">
          <Field label="Email">
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ email: e.target.value })}
              placeholder="you@northwindcoffee.ca"
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ phone: e.target.value })}
              placeholder="(416) 555-0100"
            />
          </Field>
        </ProfileGroup>

        <ProfileGroup icon={Globe2} title="Region">
          <Field label="Timezone">
            <Select
              value={TIMEZONES.some((t) => t.value === profile.timezone)
                ? profile.timezone
                : "America/Toronto"}
              onValueChange={(v) => setProfile({ timezone: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </ProfileGroup>

        <ProfileGroup icon={Briefcase} title="Account">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3 text-[12.5px]">
            <div className="min-w-0">
              <p className="text-muted-foreground">Signed in with</p>
              <p className="mt-0.5 truncate font-medium tracking-tight text-foreground">
                {user.provider === "google" ? "Google" : "Email"} · {user.email}
              </p>
            </div>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-success">
              Active
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => void logout()}
            className="w-full justify-center"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>

          {/* ── Danger zone ── */}
          <div className="mt-1 border-t border-border/50 pt-3">
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
                    className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
                  transition={{ duration: 0.22 }}
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
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
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
        </ProfileGroup>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Login page with blended looping video background
// ─────────────────────────────────────────────────────────────────────────
function LoginWithVideo() {
  return (
    <>
      {/* ── Full-viewport video layer (fixed, behind everything) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <PingPongVideo
          src="https://videos.pexels.com/video-files/37014189/15682104_2560_1440_30fps.mp4"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.22, mixBlendMode: "luminosity" }}
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/70 via-transparent to-background/70" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background" />

        {/* Colour tint orbs */}
        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-rose-400/10 blur-[100px]" />
        <div className="absolute -right-40 bottom-20 h-[500px] w-[500px] rounded-full bg-sky-400/10 blur-[100px]" />
      </div>

      {/* ── Login card — fixed, centred over the video ── */}
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto px-4 py-20">
        <LoginView />
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card primitive
// ─────────────────────────────────────────────────────────────────────────
function ProfileGroup({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl",
        className
      )}
    >
      <header className="border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-[17px] font-semibold tracking-tight">{title}</p>
        </div>
      </header>
      <div className="space-y-3 p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
