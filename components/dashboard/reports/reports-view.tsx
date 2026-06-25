"use client";

import {
  FileBadge,
  FileClock,
  FileSpreadsheet,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEmployees } from "@/lib/store/employees";
import { TAX_YEAR } from "@/lib/payroll/constants";

/**
 * Year-end & employee documents (T4, T4 Summary, T4A, ROE). Rendered inside the
 * CRA tab beneath the remittance summary so filings and remittances live
 * together.
 */
export function ReportsView() {
  const employees = useEmployees((s) => s.employees);
  const empCount = employees.length;
  const empLabel = `${empCount} employee${empCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-5">
      {/* ─── Year-end slips ─── */}
      <Section title={`Year-end · ${TAX_YEAR}`}>
        <ul className="divide-y divide-border/40">
          <ReportRow
            icon={FileText}
            title={`T4 slips · ${TAX_YEAR}`}
            desc={`${empLabel} · download from the Employees tab`}
            action={
              <Link href="/dashboard/employees">
                <Button variant="outline" size="sm">
                  <Users className="h-3.5 w-3.5" />
                  Open Employees
                </Button>
              </Link>
            }
          />
          <ReportRow
            icon={FileSpreadsheet}
            title="T4 Summary (T4-SUM)"
            desc="Combined totals across all T4s for CRA."
            action={<ComingSoon />}
          />
          <ReportRow
            icon={FileBadge}
            title="T4A · contractors"
            desc="Fees, commissions, and other income for non-employees."
            action={<ComingSoon />}
          />
        </ul>
      </Section>

      {/* ─── Employment records ─── */}
      <Section title="Employment records">
        <ul className="divide-y divide-border/40">
          <ReportRow
            icon={FileClock}
            title="Records of Employment (ROE)"
            desc="Issued when someone leaves. End date & reason are captured on the employee."
            action={
              <Link href="/dashboard/employees">
                <Button variant="outline" size="sm">
                  <Users className="h-3.5 w-3.5" />
                  Open Employees
                </Button>
              </Link>
            }
          />
        </ul>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/70 shadow-soft backdrop-blur-xl">
      <div className="border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function ReportRow({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: typeof FileText;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted">
        <Icon className="h-4 w-4 text-foreground/80" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium tracking-tight">{title}</p>
        <p className="text-[11.5px] text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

function ComingSoon() {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
      Coming soon
    </span>
  );
}
