"use client";

import { Briefcase, Globe2, Mail, Phone, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/lib/store/profile";
import { cn, formatDate } from "@/lib/utils";

export function ProfileView() {
  const { profile, setProfile } = useProfile();
  const initials =
    (profile.firstName[0] ?? "").toUpperCase() +
    (profile.lastName[0] ?? "").toUpperCase();
  const displayName =
    `${profile.firstName} ${profile.lastName}`.trim() || "Your name";

  return (
    <div className="space-y-5">
      {/* ── Identity card ── */}
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
              {profile.jobTitle || "Owner"} · joined{" "}
              {formatDate(profile.joinedAt)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Two-column on desktop, single on mobile ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileGroup icon={User} title="About you" subtitle="The name shown across the app.">
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
          <Field label="Job title">
            <Input
              value={profile.jobTitle}
              onChange={(e) => setProfile({ jobTitle: e.target.value })}
              placeholder="Owner"
            />
          </Field>
        </ProfileGroup>

        <ProfileGroup icon={Mail} title="Contact" subtitle="How NorthPay reaches you.">
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

        <ProfileGroup icon={Globe2} title="Region" subtitle="Used for reminders and date formats.">
          <Field label="Timezone">
            <Input
              value={profile.timezone}
              onChange={(e) => setProfile({ timezone: e.target.value })}
              placeholder="America/Toronto"
            />
          </Field>
        </ProfileGroup>

        <ProfileGroup
          icon={Briefcase}
          title="Account"
          subtitle="More options will land here once auth is enabled."
        >
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-[12.5px] text-muted-foreground">
            Single-user mode. Sign-in, password, and team invites will appear
            here when multi-user accounts launch.
          </div>
        </ProfileGroup>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card primitive — mirrors the desktop card vocabulary used in Settings.
// ─────────────────────────────────────────────────────────────────────────
function ProfileGroup({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
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
      <header className="border-b border-border/60 p-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-muted">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold tracking-tight">{title}</p>
            <p className="text-[12px] text-muted-foreground">{subtitle}</p>
          </div>
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
