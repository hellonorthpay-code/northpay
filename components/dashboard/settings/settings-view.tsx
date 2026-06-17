"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Building2, ChevronRight, ExternalLink, Info, Moon, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/store/settings";
import { useProfile } from "@/lib/store/profile";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type PayFrequency,
  type ProvinceCode,
} from "@/lib/payroll/types";
import { cn } from "@/lib/utils";

const ease = [0.32, 0.72, 0, 1] as const;

export function SettingsView() {
  const { company, setCompany, theme, setTheme, notifications, toggleNotification } =
    useSettings();

  const companyFields = (
    <>
      <Field label="Legal name">
        <Input value={company.legalName} onChange={(e) => setCompany({ legalName: e.target.value })} />
      </Field>
      <Field label="Operating name">
        <Input value={company.operatingName} onChange={(e) => setCompany({ operatingName: e.target.value })} />
      </Field>
      <Field label="Business number">
        <Input value={company.businessNumber} onChange={(e) => setCompany({ businessNumber: e.target.value })} />
      </Field>
      <Field label="CRA payroll account">
        <Input value={company.craPayrollAccount ?? ""} onChange={(e) => setCompany({ craPayrollAccount: e.target.value })} placeholder="RP0001" />
      </Field>
      <Field label="Address">
        <Input value={company.address} onChange={(e) => setCompany({ address: e.target.value })} />
      </Field>
      <Field label="City">
        <Input value={company.city} onChange={(e) => setCompany({ city: e.target.value })} />
      </Field>
      <Field label="Postal code">
        <Input value={company.postalCode} onChange={(e) => setCompany({ postalCode: e.target.value })} />
      </Field>
    </>
  );

  const payrollFields = (
    <>
      <Field label="Default province">
        <Select value={company.defaultProvince} onValueChange={(v) => setCompany({ defaultProvince: v as ProvinceCode })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SUPPORTED_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>{PROVINCE_NAMES[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Default pay frequency">
        <Select value={company.defaultPayFrequency} onValueChange={(v) => setCompany({ defaultPayFrequency: v as PayFrequency })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Bi-weekly</SelectItem>
            <SelectItem value="semimonthly">Semi-monthly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="semiannually">Semi-Annually</SelectItem>
            <SelectItem value="annually">Annually</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[12.5px]">
        <p className="font-medium tracking-tight">2026 tax tables</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Federal · CPP · EI · 9 provinces loaded. Updated as CRA finalizes 2026 values.
        </p>
      </div>
    </>
  );

  const appearanceFields = (
    <Field label="Theme">
      <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="system">System</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  );

  const notificationFields = (
    <div className="space-y-1.5">
      <SwitchRow label="Payroll reminders" sub="Nudge me 2 days before each pay date." checked={notifications.payrollReminders} onChange={() => toggleNotification("payrollReminders")} />
      <SwitchRow label="Paystub ready" sub="Tell me when paystubs are generated." checked={notifications.paystubReady} onChange={() => toggleNotification("paystubReady")} />
      <SwitchRow label="Product updates" sub="Rare. Only meaningful releases." checked={notifications.productUpdates} onChange={() => toggleNotification("productUpdates")} />
    </div>
  );

  return (
    <>
      {/* ── Desktop: 3-col grid (unchanged) ── */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-3">
        <SettingsGroup icon={Building2} title="Company" subtitle="The legal identity used on paystubs and remittances.">
          {companyFields}
        </SettingsGroup>
        <SettingsGroup icon={Sparkles} title="Payroll defaults" subtitle="Pre-fills new employees so you can move fast.">
          {payrollFields}
        </SettingsGroup>
        <SettingsGroup icon={Moon} title="Appearance & notifications" subtitle="Make it feel like yours.">
          {appearanceFields}
          <div className="mt-3 space-y-1.5">{notificationFields}</div>
        </SettingsGroup>
      </div>

      {/* ── Mobile: collapsible accordion ── */}
      <div className="flex flex-col gap-3 lg:hidden">
        <ProfileLinkCard />
        <AccordionSection icon={Building2} title="Company Details" subtitle="Legal name, address, CRA account">
          <div className="space-y-3">{companyFields}</div>
        </AccordionSection>
        <AccordionSection icon={Sparkles} title="Payroll Defaults" subtitle="Province, pay frequency, tax tables">
          <div className="space-y-3">{payrollFields}</div>
        </AccordionSection>
        <AccordionSection icon={Moon} title="Appearance" subtitle="Theme and display preferences">
          <div className="space-y-3">{appearanceFields}</div>
        </AccordionSection>
        <AccordionSection icon={Bell} title="Notifications" subtitle="Reminders and alerts">
          {notificationFields}
        </AccordionSection>
        <AccordionSection icon={Info} title="About NorthPay" subtitle="Founders, legal, and privacy policy">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[13.5px] font-semibold tracking-tight">NorthPay</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Canadian payroll built for small businesses. 2026 CRA compliant — federal, CPP, EI, and 9 provinces.
              </p>
            </div>
            <Link
              href="/about"
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="text-[13.5px] font-medium tracking-tight">Our story & founders</p>
                <p className="text-[11.5px] text-muted-foreground">Meet the team behind NorthPay</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            <Link
              href="/about#legal"
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/40 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <div>
                <p className="text-[13.5px] font-medium tracking-tight">Legal & Privacy</p>
                <p className="text-[11.5px] text-muted-foreground">PIPEDA compliance and data policy</p>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </div>
        </AccordionSection>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile accordion section — tappable header, animated body
// ─────────────────────────────────────────────────────────────────────────
function AccordionSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl">
      {/* Tappable header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight">{title}</p>
          <p className="text-[12px] text-muted-foreground">{subtitle}</p>
        </div>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.22, ease }}
          className="shrink-0"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Animated body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-border/60 p-4 pt-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Desktop section card (unchanged)
// ─────────────────────────────────────────────────────────────────────────
function SettingsGroup({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-soft backdrop-blur-xl">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label, sub, checked, onChange,
}: {
  label: string; sub: string; checked: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium tracking-tight">{label}</p>
        <p className="text-[11.5px] text-muted-foreground">{sub}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Mobile: profile card that links to /dashboard/profile. Mirrors the
// AccordionSection chrome so it sits visually flush with the rest.
// ─────────────────────────────────────────────────────────────────────────
function ProfileLinkCard() {
  const profile = useProfile((s) => s.profile);
  const initials =
    (profile.firstName[0] ?? "").toUpperCase() +
    (profile.lastName[0] ?? "").toUpperCase();
  const displayName =
    `${profile.firstName} ${profile.lastName}`.trim() || "Set up your profile";
  const subtitle = profile.email || "Name, contact, and timezone";

  return (
    <Link
      href="/dashboard/profile"
      className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 shadow-soft backdrop-blur-xl transition-colors hover:bg-muted/30"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-400 text-[13px] font-semibold text-white shadow-soft dark:from-rose-300 dark:to-amber-200 dark:text-black">
        {initials || <User className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold tracking-tight">{displayName}</p>
        <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
