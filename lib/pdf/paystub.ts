import { jsPDF } from "jspdf";
import type { PayrollLineResult, PayrollRun } from "@/lib/payroll/types";
import type { CompanySettings } from "@/lib/payroll/types";
import { PROVINCE_NAMES } from "@/lib/payroll/types";
import { computeYTD } from "./ytd";
import { formatDate } from "@/lib/utils";

const PAGE_W = 612;
const MARGIN = 36;
const INNER_W = PAGE_W - MARGIN * 2;

function money(n: number) {
  return n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rgb(doc: jsPDF, kind: "text" | "draw" | "fill", c: [number, number, number]) {
  if (kind === "text") doc.setTextColor(c[0], c[1], c[2]);
  if (kind === "draw") doc.setDrawColor(c[0], c[1], c[2]);
  if (kind === "fill") doc.setFillColor(c[0], c[1], c[2]);
}

const INK = [20, 20, 22] as [number, number, number];
const MUTED = [110, 110, 118] as [number, number, number];
const RULE = [220, 220, 224] as [number, number, number];
const SOFT = [247, 247, 250] as [number, number, number];
const SUCCESS = [40, 130, 80] as [number, number, number];

/** Build the paystub and trigger a browser download. */
export function generatePaystubPDF(
  line: PayrollLineResult,
  company: CompanySettings,
  allRuns: PayrollRun[]
) {
  const { doc, filename } = buildPaystubDoc(line, company, allRuns);
  doc.save(filename);
}

/**
 * Build the paystub and return it as base64 (no download) so it can be
 * attached to a transactional email. Runs in the browser at enqueue time.
 */
export function paystubPDFBase64(
  line: PayrollLineResult,
  company: CompanySettings,
  allRuns: PayrollRun[]
): { base64: string; filename: string } {
  const { doc, filename } = buildPaystubDoc(line, company, allRuns);
  const uri = doc.output("datauristring");
  const base64 = uri.substring(uri.indexOf(",") + 1);
  return { base64, filename };
}

function buildPaystubDoc(
  line: PayrollLineResult,
  company: CompanySettings,
  allRuns: PayrollRun[]
): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("helvetica", "normal");
  rgb(doc, "text", INK);
  rgb(doc, "draw", RULE);

  const ytd = computeYTD(line.employeeId, allRuns, line.periodEnd);
  const emp = line.employee;
  let y = MARGIN;

  // ─────────── Header band ───────────
  rgb(doc, "fill", SOFT);
  doc.rect(MARGIN, y, INNER_W, 56, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  rgb(doc, "text", INK);
  doc.text(company.operatingName || company.legalName, MARGIN + 14, y + 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rgb(doc, "text", MUTED);
  doc.text(
    `${company.address}, ${company.city}  ·  BN ${company.businessNumber}`,
    MARGIN + 14,
    y + 40
  );
  if (company.craPayrollAccount) {
    doc.text(
      `CRA payroll account ${company.craPayrollAccount}`,
      MARGIN + 14,
      y + 50
    );
  }

  // Right side of header band
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  rgb(doc, "text", INK);
  doc.text("STATEMENT OF EARNINGS", MARGIN + INNER_W - 14, y + 22, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rgb(doc, "text", MUTED);
  doc.text(
    `Pay period: ${formatDate(line.periodStart)} – ${formatDate(line.periodEnd)}`,
    MARGIN + INNER_W - 14,
    y + 38,
    { align: "right" }
  );
  doc.text(`Pay date: ${formatDate(line.periodEnd)}`, MARGIN + INNER_W - 14, y + 50, {
    align: "right",
  });

  y += 56;

  // ─────────── Employee block ───────────
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  rgb(doc, "text", MUTED);
  doc.text("EMPLOYEE", MARGIN, y);
  doc.text("EMPLOYMENT", MARGIN + INNER_W / 2, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  rgb(doc, "text", INK);
  y += 14;
  doc.text(`${emp.firstName} ${emp.lastName}`, MARGIN, y);
  doc.text(
    `${PROVINCE_NAMES[emp.province]} · ${emp.employmentType}`,
    MARGIN + INNER_W / 2,
    y
  );

  doc.setFontSize(8.5);
  rgb(doc, "text", MUTED);
  y += 12;
  doc.text(`SIN: ${emp.sin}`, MARGIN, y);
  doc.text(
    `Pay frequency: ${emp.payFrequency
      .replace("semimonthly", "semi-monthly")
      .replace("semiannually", "semi-annually")}`,
    MARGIN + INNER_W / 2,
    y
  );

  y += 12;
  doc.text(`Employee ID: ${emp.id.slice(0, 12).toUpperCase()}`, MARGIN, y);
  if (emp.employmentType === "salary") {
    doc.text(
      `Annual salary: $${money(emp.annualSalary ?? 0)}`,
      MARGIN + INNER_W / 2,
      y
    );
  } else {
    doc.text(`Hourly rate: $${money(emp.hourlyRate ?? 0)}`, MARGIN + INNER_W / 2, y);
  }

  y += 18;
  rgb(doc, "draw", RULE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + INNER_W, y);

  // ─────────── Two-column tables ───────────
  y += 18;
  const colW = (INNER_W - 16) / 2;
  const earningsX = MARGIN;
  const deductionsX = MARGIN + colW + 16;
  const startY = y;

  y = drawTable(
    doc,
    earningsX,
    y,
    colW,
    "EARNINGS",
    [
      ["Regular", line.regularPay, ytd.regular],
      ["Overtime (1.5×)", line.overtimePay, ytd.overtime],
      ["Bonus", line.bonusAmount, ytd.bonus],
      ["Vacation paid", line.vacationAccrual, ytd.vacation],
    ],
    ["Gross pay", line.grossPay, ytd.gross]
  );

  const earningsEndY = y;
  y = drawTable(
    doc,
    deductionsX,
    startY,
    colW,
    "DEDUCTIONS",
    [
      ["Federal income tax", line.federalTax, ytd.federalTax],
      [
        `${emp.province} income tax`,
        line.provincialTax,
        ytd.provincialTax,
      ],
      [
        "CPP contribution",
        line.cppEmployee + line.cpp2Employee,
        ytd.cpp + ytd.cpp2,
      ],
      ["EI premium", line.eiEmployee, ytd.ei],
    ],
    ["Total deductions", line.totalDeductions, ytd.totalDeductions]
  );

  y = Math.max(y, earningsEndY) + 6;

  // ─────────── Net pay box ───────────
  y += 14;
  rgb(doc, "draw", RULE);
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN, y, INNER_W, 64, 6, 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rgb(doc, "text", MUTED);
  doc.text("NET DEPOSIT", MARGIN + 18, y + 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  rgb(doc, "text", INK);
  doc.text(`$${money(line.netPay)}`, MARGIN + 18, y + 50);

  // Right side: YTD net
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  rgb(doc, "text", MUTED);
  doc.text("YEAR TO DATE NET", MARGIN + INNER_W - 18, y + 22, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  rgb(doc, "text", INK);
  doc.text(`$${money(ytd.net)}`, MARGIN + INNER_W - 18, y + 44, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rgb(doc, "text", SUCCESS);
  doc.text("PAID", MARGIN + INNER_W - 18, y + 58, { align: "right" });

  y += 78;

  // ─────────── Vacation banked (only if accruing) ───────────
  if (line.vacationBanked > 0 || line.employee.vacationMode === "accrue") {
    const ytdBanked = ytd.vacation; // YTD totals only track paid; this is a placeholder
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    rgb(doc, "text", MUTED);
    doc.text("VACATION BANKED THIS PERIOD", MARGIN, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    rgb(doc, "text", INK);
    doc.text(`$${money(line.vacationBanked)}`, MARGIN + INNER_W, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    rgb(doc, "text", MUTED);
    doc.text(
      `Vacation rate ${line.employee.vacationPercent}% · accrued separately, paid out on request`,
      MARGIN,
      y + 10
    );
    y += 22;
  }

  // ─────────── Employer contributions ───────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  rgb(doc, "text", MUTED);
  doc.text("EMPLOYER CONTRIBUTIONS (NOT DEDUCTED FROM PAY)", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rgb(doc, "text", INK);
  y += 14;
  doc.text(
    `CPP match: $${money(line.cppEmployer + line.cpp2Employer)}`,
    MARGIN,
    y
  );
  doc.text(
    `EI (1.4×): $${money(line.eiEmployer)}`,
    MARGIN + 180,
    y
  );
  doc.text(
    `Total employer cost: $${money(
      line.grossPay + line.cppEmployer + line.cpp2Employer + line.eiEmployer
    )}`,
    MARGIN + INNER_W,
    y,
    { align: "right" }
  );

  // ─────────── Footer ───────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rgb(doc, "text", MUTED);
  doc.text(
    "This statement reflects gross-to-net calculations under CRA payroll guidance. Keep for your records.",
    MARGIN,
    792 - MARGIN
  );
  doc.text("Generated by NorthPay", MARGIN + INNER_W, 792 - MARGIN, {
    align: "right",
  });

  const filename = `paystub-${emp.lastName}-${line.periodEnd}.pdf`;
  return { doc, filename };
}

function drawTable(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  heading: string,
  rows: Array<[string, number, number]>,
  total: [string, number, number]
) {
  // Title
  rgb(doc, "fill", SOFT);
  doc.rect(x, y, w, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  rgb(doc, "text", INK);
  doc.text(heading, x + 10, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  rgb(doc, "text", MUTED);
  doc.text("CURRENT", x + w - 80, y + 14, { align: "right" });
  doc.text("YTD", x + w - 10, y + 14, { align: "right" });

  y += 22;

  // Rows
  rgb(doc, "draw", RULE);
  doc.setLineWidth(0.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const [label, current, ytd] of rows) {
    rgb(doc, "text", INK);
    doc.text(label, x + 10, y + 13);
    rgb(doc, "text", current === 0 ? MUTED : INK);
    doc.text(`$${money(current)}`, x + w - 80, y + 13, { align: "right" });
    rgb(doc, "text", MUTED);
    doc.text(`$${money(ytd)}`, x + w - 10, y + 13, { align: "right" });
    y += 18;
    doc.line(x, y, x + w, y);
  }

  // Total row
  rgb(doc, "fill", SOFT);
  doc.rect(x, y, w, 22, "F");
  doc.setFont("helvetica", "bold");
  rgb(doc, "text", INK);
  doc.text(total[0], x + 10, y + 14);
  doc.text(`$${money(total[1])}`, x + w - 80, y + 14, { align: "right" });
  rgb(doc, "text", MUTED);
  doc.text(`$${money(total[2])}`, x + w - 10, y + 14, { align: "right" });
  y += 22;

  // Outline
  rgb(doc, "draw", RULE);
  doc.setLineWidth(0.6);
  doc.rect(x, y - rows.length * 18 - 44, w, rows.length * 18 + 44);

  return y;
}
