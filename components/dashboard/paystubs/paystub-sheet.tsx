"use client";

import { motion } from "framer-motion";
import { Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCAD, formatDate } from "@/lib/utils";
import { PROVINCE_NAMES, type PayrollLineResult } from "@/lib/payroll/types";
import { useSettings } from "@/lib/store/settings";
import { usePayrollRuns } from "@/lib/store/payroll";
import { generatePaystubPDF } from "@/lib/pdf/paystub";

const ease = [0.22, 1, 0.36, 1] as const;

export function PaystubSheet({
  line,
  onClose,
}: {
  line: PayrollLineResult;
  onClose: () => void;
}) {
  const company = useSettings((s) => s.company);
  const runs = usePayrollRuns((s) => s.runs);

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    generatePaystubPDF(line, company, runs);
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ duration: 0.5, ease }}
        className="fixed inset-x-3 bottom-3 z-50 max-h-[92vh] overflow-hidden rounded-[28px] border border-border bg-background shadow-pop sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:w-[640px] sm:-translate-x-1/2"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur-xl print:hidden">
          <p className="text-[12.5px] font-medium tracking-tight text-muted-foreground">
            Paystub · {formatDate(line.periodStart)} —{" "}
            {formatDate(line.periodEnd)}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="ghost" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(92vh-64px)] p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-muted-foreground">
                {company.operatingName}
              </p>
              <p className="text-[11.5px] text-muted-foreground/80">
                {company.address}, {company.city} · BN {company.businessNumber}
              </p>
            </div>
            <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
              Paid
            </span>
          </div>

          <div className="mt-8">
            <p className="text-[12px] text-muted-foreground">Net deposit</p>
            <p className="font-semibold tracking-tightest text-[52px] leading-none">
              {formatCAD(line.netPay)}
            </p>
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              {line.employee.firstName} {line.employee.lastName} · SIN{" "}
              {line.employee.sin} · {PROVINCE_NAMES[line.employee.province]}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-border/70 bg-muted/30 p-5">
            <Block title="Earnings">
              <Row label="Regular" value={line.regularPay} />
              <Row label="Overtime (1.5×)" value={line.overtimePay} />
              <Row label="Bonus" value={line.bonusAmount} />
              <Row label="Vacation paid" value={line.vacationAccrual} />
              <div className="mt-1 border-t border-border/60 pt-2">
                <Row label="Gross pay" value={line.grossPay} strong />
              </div>
              {line.vacationBanked > 0 && (
                <p className="mt-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                  Vacation banked this period:{" "}
                  <span className="font-medium text-foreground">
                    {formatCAD(line.vacationBanked)}
                  </span>
                </p>
              )}
            </Block>
            <Block title="Deductions">
              <Row label="Federal tax" value={-line.federalTax} />
              <Row
                label={`${line.employee.province} tax`}
                value={-line.provincialTax}
              />
              <Row label="CPP" value={-(line.cppEmployee + line.cpp2Employee)} />
              <Row label="EI" value={-line.eiEmployee} />
              <div className="mt-1 border-t border-border/60 pt-2">
                <Row
                  label="Total deductions"
                  value={-line.totalDeductions}
                  strong
                />
              </div>
            </Block>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-border/70 p-4 text-[12px]">
            <Mini
              label="Hours"
              value={
                line.employee.employmentType === "salary"
                  ? "Salary"
                  : `${line.hoursWorked.toFixed(1)} hrs`
              }
            />
            <Mini
              label="Overtime"
              value={
                line.employee.employmentType === "salary"
                  ? "—"
                  : `${line.overtimeHours.toFixed(1)} hrs`
              }
            />
            <Mini label="Pay frequency" value={line.employee.payFrequency} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-[12px] text-muted-foreground">
            <p>
              <span className="font-medium text-foreground/80">Employer contributions</span>
              <br />
              CPP {formatCAD(line.cppEmployer + line.cpp2Employer)} · EI{" "}
              {formatCAD(line.eiEmployer)}
            </p>
            <p className="text-right">
              Pay date {formatDate(line.periodEnd)} · Generated by NorthPay
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5 text-[13px]">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          strong ? "font-semibold tracking-tight" : ""
        }`}
      >
        {formatCAD(value)}
      </span>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-medium tracking-tight capitalize">{value}</p>
    </div>
  );
}

