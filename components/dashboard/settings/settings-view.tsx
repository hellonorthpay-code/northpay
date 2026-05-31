"use client";

import { Building2, Moon, Sparkles } from "lucide-react";
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
import {
  PROVINCE_NAMES,
  SUPPORTED_PROVINCES,
  type PayFrequency,
  type ProvinceCode,
} from "@/lib/payroll/types";

export function SettingsView() {
  const { company, setCompany, theme, setTheme, notifications, toggleNotification } =
    useSettings();

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <SettingsGroup
        icon={Building2}
        title="Company"
        subtitle="The legal identity used on paystubs and remittances."
      >
        <Field label="Legal name">
          <Input
            value={company.legalName}
            onChange={(e) => setCompany({ legalName: e.target.value })}
          />
        </Field>
        <Field label="Operating name">
          <Input
            value={company.operatingName}
            onChange={(e) => setCompany({ operatingName: e.target.value })}
          />
        </Field>
        <Field label="Business number">
          <Input
            value={company.businessNumber}
            onChange={(e) => setCompany({ businessNumber: e.target.value })}
          />
        </Field>
        <Field label="CRA payroll account">
          <Input
            value={company.craPayrollAccount ?? ""}
            onChange={(e) => setCompany({ craPayrollAccount: e.target.value })}
            placeholder="RP0001"
          />
        </Field>
        <Field label="Address">
          <Input
            value={company.address}
            onChange={(e) => setCompany({ address: e.target.value })}
          />
        </Field>
        <Field label="City">
          <Input
            value={company.city}
            onChange={(e) => setCompany({ city: e.target.value })}
          />
        </Field>
        <Field label="Postal code">
          <Input
            value={company.postalCode}
            onChange={(e) => setCompany({ postalCode: e.target.value })}
          />
        </Field>
      </SettingsGroup>

      <SettingsGroup
        icon={Sparkles}
        title="Payroll defaults"
        subtitle="Pre-fills new employees so you can move fast."
      >
        <Field label="Default province">
          <Select
            value={company.defaultProvince}
            onValueChange={(v) =>
              setCompany({ defaultProvince: v as ProvinceCode })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVINCE_NAMES[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Default pay frequency">
          <Select
            value={company.defaultPayFrequency}
            onValueChange={(v) =>
              setCompany({ defaultPayFrequency: v as PayFrequency })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Bi-weekly</SelectItem>
              <SelectItem value="semimonthly">Semi-monthly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="mt-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-[12.5px]">
          <p className="font-medium tracking-tight">2026 tax tables</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Federal · CPP · EI · 9 provinces loaded. Updated as CRA finalizes
            2026 values.
          </p>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={Moon}
        title="Appearance & notifications"
        subtitle="Make it feel like yours."
      >
        <Field label="Theme">
          <Select
            value={theme}
            onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="mt-3 space-y-1.5">
          <SwitchRow
            label="Payroll reminders"
            sub="Nudge me 2 days before each pay date."
            checked={notifications.payrollReminders}
            onChange={() => toggleNotification("payrollReminders")}
          />
          <SwitchRow
            label="Paystub ready"
            sub="Tell me when paystubs are generated."
            checked={notifications.paystubReady}
            onChange={() => toggleNotification("paystubReady")}
          />
          <SwitchRow
            label="Product updates"
            sub="Rare. Only meaningful releases."
            checked={notifications.productUpdates}
            onChange={() => toggleNotification("productUpdates")}
          />
        </div>
      </SettingsGroup>
    </div>
  );
}

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

function SwitchRow({
  label,
  sub,
  checked,
  onChange,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: () => void;
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
