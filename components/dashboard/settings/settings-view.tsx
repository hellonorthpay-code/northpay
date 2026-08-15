"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, CheckCircle2, ChevronRight, ExternalLink, Info, RotateCcw, Sparkles, User } from "lucide-react";
import Link from "next/link";
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
import { useSettings } from "@/lib/store/settings";
import { useProfile } from "@/lib/store/profile";
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type ProvinceCode,
} from "@/lib/payroll/types";
import { cn } from "@/lib/utils";
import { SubscriptionSettingsRow } from "@/components/dashboard/billing/subscription-modal";

const ease = [0.32, 0.72, 0, 1] as const;

export function SettingsView() {
  const { company, setCompany, theme, setTheme } = useSettings();

  // Company details now use a draft + Save/Cancel (instead of saving on every
  // keystroke), so the user can review changes before committing.
  const companySubset = (c: typeof company) => ({
    legalName: c.legalName ?? "",
    operatingName: c.operatingName ?? "",
    businessNumber: c.businessNumber ?? "",
    craPayrollAccount: c.craPayrollAccount ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    postalCode: c.postalCode ?? "",
  });

  const [draft, setDraft] = useState(() => companySubset(company));
  const [saving, setSaving] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<null | "saved" | "cancelled">(null);

  // Re-sync the draft when the stored company changes (e.g. after hydration or
  // a successful save). It never changes mid-edit, so this won't clobber typing.
  useEffect(() => {
    setDraft(companySubset(company));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const companyDirty =
    JSON.stringify(draft) !== JSON.stringify(companySubset(company));

  function flashStatus(next: "saved" | "cancelled") {
    setCompanyStatus(next);
    window.setTimeout(() => setCompanyStatus(null), 2600);
  }

  async function saveCompany() {
    setSaving(true);
    try {
      await setCompany(draft);
      flashStatus("saved");
    } finally {
      setSaving(false);
    }
  }

  function cancelCompany() {
    setDraft(companySubset(company));
    flashStatus("cancelled");
  }

  const setField = (key: keyof typeof draft) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  // Business number — exactly the 9-digit BN, digits only.
  const setBusinessNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
    setDraft((d) => ({ ...d, businessNumber: digits }));
  };

  // CRA payroll account — always "RP" + up to 4 alphanumeric (e.g. RP0001).
  // We store the full "RP…" value but only let the user edit the 4 chars.
  const craSuffix = (draft.craPayrollAccount || "")
    .replace(/^RP/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  const setCraSuffix = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    setDraft((d) => ({ ...d, craPayrollAccount: clean ? `RP${clean}` : "" }));
  };

  const companyFields = (
    <>
      <Field label="Legal name">
        <Input value={draft.legalName} onChange={setField("legalName")} />
      </Field>
      <Field label="Operating name">
        <Input value={draft.operatingName} onChange={setField("operatingName")} />
      </Field>
      <Field label="Business number">
        <Input
          value={draft.businessNumber}
          onChange={setBusinessNumber}
          inputMode="numeric"
          maxLength={9}
          placeholder="123456789"
        />
      </Field>
      <Field label="CRA payroll account">
        <div className="flex h-11 w-full items-center rounded-xl border border-border bg-background px-4 text-[15px] text-foreground transition-all duration-200 focus-within:border-foreground/30 focus-within:shadow-soft">
          <span className="select-none pr-1 font-medium text-muted-foreground">RP</span>
          <input
            value={craSuffix}
            onChange={setCraSuffix}
            inputMode="numeric"
            maxLength={4}
            placeholder="0001"
            className="w-full bg-transparent tracking-wide outline-none placeholder:text-muted-foreground"
          />
        </div>
      </Field>
      <Field label="Address">
        <Input value={draft.address} onChange={setField("address")} />
      </Field>
      <Field label="City">
        <Input value={draft.city} onChange={setField("city")} />
      </Field>
      <Field label="Postal code">
        <Input value={draft.postalCode} onChange={setField("postalCode")} />
      </Field>

      {/* Save / Cancel + feedback */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" onClick={saveCompany} disabled={!companyDirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={cancelCompany} disabled={!companyDirty || saving}>
          Cancel
        </Button>
        {companyStatus === "saved" && (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-success duration-300 animate-in fade-in slide-in-from-left-2">
            <CheckCircle2 className="h-4 w-4" />
            Details saved
          </span>
        )}
        {companyStatus === "cancelled" && (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground duration-300 animate-in fade-in slide-in-from-left-2">
            <RotateCcw className="h-4 w-4" />
            Details not saved
          </span>
        )}
      </div>
    </>
  );

  // One "System" group: the province new employees default to, plus theme.
  // Notification toggles were removed — they promised emails NorthPay does
  // not send, so they were UI with nothing behind them.
  const systemFields = (
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

      {/* Billing lives with the other account-level controls rather than as
          a separate banner above the grid. Renders nothing for non-pilot
          accounts, so the group simply ends at the tax-tables note. */}
      <SubscriptionSettingsRow />

      <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[12.5px]">
        <p className="font-medium tracking-tight">2026 tax tables</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          Federal · CPP · EI · 9 provinces loaded. Updated as CRA finalizes 2026 values.
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop: 3-col grid (unchanged) ── */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-2">
        <SettingsGroup icon={Building2} title="Company" subtitle="The legal identity used on paystubs and remittances.">
          {companyFields}
        </SettingsGroup>
        <SettingsGroup icon={Sparkles} title="System" subtitle="Defaults for new employees and how NorthPay looks.">
          {systemFields}
        </SettingsGroup>
      </div>

      {/* ── Mobile: collapsible accordion ── */}
      <div className="flex flex-col gap-3 lg:hidden">
        <ProfileLinkCard />
        <AccordionSection icon={Building2} title="Company Details" subtitle="Legal name, address, CRA account">
          <div className="space-y-3">{companyFields}</div>
        </AccordionSection>
        <AccordionSection icon={Sparkles} title="System" subtitle="Default province, theme, tax tables">
          <div className="space-y-3">{systemFields}</div>
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
