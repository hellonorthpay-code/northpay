import { jsPDF } from "jspdf";
import type { CompanySettings } from "@/lib/payroll/types";
import type { MonthlyRemittance } from "@/lib/services/remittance";
import { formatDate } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Payroll remittance (PD7A-style) report PDF.
//
// Mirrors the visual language of the on-screen CRA tab: a clean header, a
// summary band (remitted / outstanding / total), a component breakdown, and a
// month-by-month table. Runs in the browser via jsPDF (same as the paystub).
// ─────────────────────────────────────────────────────────────────────────

const PAGE_W = 612;
const MARGIN = 42;
const INNER_W = PAGE_W - MARGIN * 2;

const INK: [number, number, number] = [20, 20, 22];
const MUTED: [number, number, number] = [110, 110, 118];
const RULE: [number, number, number] = [224, 224, 228];
const SOFT: [number, number, number] = [246, 246, 249];
const SUCCESS: [number, number, number] = [30, 120, 75];
const AMBER: [number, number, number] = [176, 120, 20];

function money(n: number) {
  return (
    "$" +
    n.toLocaleString("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export interface RemittanceSummary {
  remittedTotal: number;
  outstandingTotal: number;
  total: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  ei: number;
}

export function generateRemittancePDF(
  company: CompanySettings,
  months: MonthlyRemittance[],
  summary: RemittanceSummary,
  taxYear: number
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("helvetica", "normal");

  const text = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const draw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  let y = MARGIN;

  // ── Header ──
  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.operatingName || company.legalName || "Company", MARGIN, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  text(MUTED);
  doc.text("Payroll Remittance Report", MARGIN + INNER_W, y - 3, { align: "right" });
  doc.text(`Tax year ${taxYear}`, MARGIN + INNER_W, y + 10, { align: "right" });

  y += 22;
  doc.setFontSize(9);
  text(MUTED);
  const idBits = [
    company.legalName && company.legalName !== company.operatingName
      ? company.legalName
      : "",
    company.businessNumber ? `BN ${company.businessNumber}` : "",
    company.craPayrollAccount ? company.craPayrollAccount : "",
  ].filter(Boolean);
  if (idBits.length) doc.text(idBits.join("   ·   "), MARGIN, y);

  y += 18;
  draw(RULE);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, MARGIN + INNER_W, y);
  y += 22;

  // ── Summary band: three tiles ──
  const gap = 12;
  const tileW = (INNER_W - gap * 2) / 3;
  const tileH = 62;
  const tiles: Array<{ label: string; value: string; tone: [number, number, number] }> = [
    { label: "Remitted to date", value: money(summary.remittedTotal), tone: SUCCESS },
    {
      label: "Outstanding",
      value: money(summary.outstandingTotal),
      tone: summary.outstandingTotal > 0 ? AMBER : INK,
    },
    { label: "Total source deductions", value: money(summary.total), tone: INK },
  ];
  tiles.forEach((t, i) => {
    const x = MARGIN + i * (tileW + gap);
    fill(SOFT);
    doc.roundedRect(x, y, tileW, tileH, 10, 10, "F");
    text(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(t.label.toUpperCase(), x + 14, y + 20);
    text(t.tone);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t.value, x + 14, y + 44);
  });
  y += tileH + 20;

  // ── Component breakdown row ──
  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Source deductions by component", MARGIN, y);
  y += 12;
  fill(SOFT);
  doc.roundedRect(MARGIN, y, INNER_W, 46, 10, 10, "F");
  const comps = [
    ["Federal tax", money(summary.federalTax)],
    ["Provincial tax", money(summary.provincialTax)],
    ["CPP (×2)", money(summary.cpp)],
    ["EI (×2.4)", money(summary.ei)],
  ];
  const compW = INNER_W / comps.length;
  comps.forEach(([label, value], i) => {
    const x = MARGIN + i * compW + 14;
    text(MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x, y + 18);
    text(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(value, x, y + 34);
  });
  y += 46 + 26;

  // ── Monthly table ──
  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Monthly remittances", MARGIN, y);
  y += 14;

  // Column layout
  const cols = [
    { key: "month", label: "Month", w: 96, align: "left" as const },
    { key: "due", label: "Due", w: 74, align: "left" as const },
    { key: "status", label: "Status", w: 78, align: "left" as const },
    { key: "fed", label: "Federal", w: 62, align: "right" as const },
    { key: "prov", label: "Prov.", w: 56, align: "right" as const },
    { key: "cpp", label: "CPP", w: 56, align: "right" as const },
    { key: "ei", label: "EI", w: 50, align: "right" as const },
    { key: "total", label: "Total", w: 56, align: "right" as const },
  ];
  const colX: number[] = [];
  let cx = MARGIN;
  for (const c of cols) {
    colX.push(cx);
    cx += c.w;
  }

  // Header row
  draw(RULE);
  doc.setLineWidth(0.8);
  text(MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  cols.forEach((c, i) => {
    const x = c.align === "right" ? colX[i] + c.w : colX[i];
    doc.text(c.label.toUpperCase(), x, y, { align: c.align });
  });
  y += 6;
  doc.line(MARGIN, y, MARGIN + INNER_W, y);
  y += 14;

  const sorted = [...months].sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  for (const m of sorted) {
    if (y > 720) {
      doc.addPage();
      y = MARGIN;
    }
    const row: Record<string, string> = {
      month: m.monthLabel,
      due: formatDate(m.dueDate),
      status: m.remitted ? "Remitted" : "Outstanding",
      fed: money(m.federalTax),
      prov: money(m.provincialTax),
      cpp: money(m.cpp),
      ei: money(m.ei),
      total: money(m.total),
    };
    cols.forEach((c, i) => {
      if (c.key === "status") {
        text(m.remitted ? SUCCESS : AMBER);
      } else {
        text(INK);
      }
      doc.setFont("helvetica", c.key === "total" ? "bold" : "normal");
      const x = c.align === "right" ? colX[i] + c.w : colX[i];
      doc.text(row[c.key], x, y, { align: c.align });
    });
    y += 8;
    draw(RULE);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, MARGIN + INNER_W, y);
    y += 12;
  }

  // ── Footer ──
  text(MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Generated by NorthPay on ${formatDate(new Date().toISOString().slice(0, 10))}. Verify against your CRA statement of account before filing.`,
    MARGIN,
    792 - MARGIN
  );

  doc.save(`remittance-report-${taxYear}.pdf`);
}
