import { jsPDF } from "jspdf";
import type {
  CompanySettings,
  Employee,
  PayrollRun,
} from "@/lib/payroll/types";
import { TAX_YEAR, CPP, EI } from "@/lib/payroll/constants";
import { computeAnnualTotals, type YTDTotals } from "./ytd";
import {
  type T4OtherInfoEntry,
  getOtherInfoMeta,
} from "./t4-boxes";

/**
 * T4 slip in CRA T4(24) layout — two identical slips per page, bilingual
 * labels, exact CRA positioning.
 *
 * ─── Architecture ────────────────────────────────────────────────────
 *
 * The data shape (T4Data) is split into:
 *   • Standard boxes — every field that has a fixed position on the slip
 *     (10, 12, 14, 16, 16A, 17, 17A, 18, 20, 22, 24, 26, 28, 29, 44, 45,
 *     46, 50, 52, 54, 55, 56)
 *   • otherInformation[] — generic Box-Case/Amount-Montant entries that
 *     fill the 6 cells at the bottom. Phase 2/3 features add to this
 *     array; the renderer iterates it. No layout code changes needed.
 *
 * See lib/pdf/t4-boxes.ts for the full registry of "Other information"
 * codes and the migration recipe.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const PAGE_MARGIN = 14;
const SLIP_GAP = 12;
const SLIP_W = PAGE_W - PAGE_MARGIN * 2; // 584
const SLIP_H = (PAGE_H - PAGE_MARGIN * 2 - SLIP_GAP) / 2; // 376

// Left vertical strip reserved for "Protected B" + "T4 (24)" text
const LEFT_STRIP = 14;
const INNER_X_OFFSET = LEFT_STRIP + 2;
const INNER_W = SLIP_W - INNER_X_OFFSET - 4;

// Vertical section heights
const HEADER_H = 48;
const OTHER_H = 54;
const MID_H = SLIP_H - HEADER_H - OTHER_H - 6;

// Left/right column split inside MID — left holds employer + employee blocks,
// right holds 16 amount boxes in a 2×8 grid.
const LEFT_COL_W = 286;
const COL_GAP = 6;
const RIGHT_COL_W = INNER_W - LEFT_COL_W - COL_GAP;

// Sub-column geometry for the right grid
const SUB_GAP = 6;
const SUB_COL_W = (RIGHT_COL_W - SUB_GAP) / 2;

// Right grid rows
const MINI_ROW_H = 26;
const AMOUNT_ROWS = 8;
const AMOUNT_ROW_H = (MID_H - MINI_ROW_H - 6) / AMOUNT_ROWS;

// Single colour — pure black on white, exactly like the CRA original
const INK: [number, number, number] = [0, 0, 0];

function money(n: number) {
  return n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Data shape — extensible
// ─────────────────────────────────────────────────────────────────────────
export interface T4Data {
  year: number;

  employer: {
    name: string;
    /** Box 54 — Employer's account number. */
    accountNumber: string;
  };

  employee: {
    /** Box 12 — SIN (often masked on copies). */
    sin: string;
    lastName: string;
    firstName: string;
    initial: string;
    /** Box 10 — Province of employment (2-letter code). */
    province: string;
    /** Address lines (printed inside the employee box). */
    addressLines: string[];
  };

  // ── Standard boxes ──
  /** Box 14 — Employment income. */
  box14: number;
  /** Box 16 — Employee's CPP contributions (CPP1). */
  box16: number;
  /** Box 16A — Employee's second CPP contributions (CPP2). */
  box16A: number;
  /** Box 17 — Employee's QPP contributions (Quebec only). */
  box17: number;
  /** Box 17A — Employee's second QPP contributions. */
  box17A: number;
  /** Box 18 — Employee's EI premiums. */
  box18: number;
  /** Box 20 — Registered Pension Plan contributions. */
  box20: number;
  /** Box 22 — Income tax deducted (federal + provincial combined). */
  box22: number;
  /** Box 24 — EI insurable earnings (capped at annual MIE). */
  box24: number;
  /** Box 26 — CPP/QPP pensionable earnings (capped at YMPE). */
  box26: number;
  /** Box 29 — Employment code (one of T4_EMPLOYMENT_CODES). */
  box29: string;
  /** Box 44 — Union dues. */
  box44: number;
  /** Box 45 — Dental benefits code (1-5 per T4_DENTAL_BENEFIT_CODES). */
  box45: string;
  /** Box 46 — Charitable donations. */
  box46: number;
  /** Box 50 — RPP or DPSP registration number. */
  box50: string;
  /** Box 52 — Pension adjustment. */
  box52: number;
  /** Box 55 — Employee's PPIP premiums (Quebec only). */
  box55: number;
  /** Box 56 — PPIP insurable earnings (Quebec only). */
  box56: number;

  // ── Box 28 exempt checkboxes ──
  exemptCPP: boolean;
  exemptEI: boolean;
  exemptPPIP: boolean;

  // ── Extensible: Other information codes (page 2 of CRA T4) ──
  /**
   * Up to 6 entries — each becomes a Box-Case + Amount-Montant pair at
   * the bottom of the slip. To add a new T4-impacting feature in
   * Phase 2/3, just push an entry here.
   *
   *   Example: { code: 40, amount: 1500 }   // Box 40 — Other taxable benefits
   *   Example: { code: 85, amount: 600 }    // Box 85 — Health premiums
   *
   * If more than 6 are needed, additional slips would be required (CRA
   * spec — not yet implemented).
   */
  otherInformation: T4OtherInfoEntry[];
}

// ─────────────────────────────────────────────────────────────────────────
// Entry point used by the UI
// ─────────────────────────────────────────────────────────────────────────
export function generateT4PDF(
  employee: Employee,
  company: CompanySettings,
  runs: PayrollRun[],
  year: number = TAX_YEAR
) {
  const totals: YTDTotals = computeAnnualTotals(employee.id, runs, year);

  const data: T4Data = {
    year,
    employer: {
      name: company.legalName,
      accountNumber: company.businessNumber,
    },
    employee: {
      sin: employee.sin,
      lastName: employee.lastName.toUpperCase(),
      firstName: employee.firstName,
      initial: "",
      province: employee.province,
      addressLines: [],
    },
    box14: totals.gross,
    box16: totals.cpp,
    box16A: totals.cpp2,
    box17: 0,
    box17A: 0,
    box18: totals.ei,
    box20: 0,
    box22: totals.federalTax + totals.provincialTax,
    box24: Math.min(totals.eiInsurable, EI.maxInsurableEarnings),
    box26: Math.min(totals.cppPensionable, CPP.ympe),
    box29: "",
    box44: 0,
    box45: "",
    box46: 0,
    box50: "",
    box52: 0,
    box55: 0,
    box56: 0,
    exemptCPP: false,
    exemptEI: false,
    exemptPPIP: false,
    otherInformation: [],
    // Phase 2/3 features will populate otherInformation, e.g.:
    //   otherInformation: [
    //     { code: 40, amount: taxableBenefitsTotal },
    //     { code: 85, amount: healthPremiumsTotal },
    //   ],
  };

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  doc.setDrawColor(...INK);

  drawT4Slip(doc, PAGE_MARGIN, PAGE_MARGIN, data);
  drawT4Slip(doc, PAGE_MARGIN, PAGE_MARGIN + SLIP_H + SLIP_GAP, data);

  // Dashed cut line between the two slips (CRA standard)
  doc.setLineDashPattern([3, 3], 0);
  doc.setLineWidth(0.5);
  doc.line(
    PAGE_MARGIN,
    PAGE_MARGIN + SLIP_H + SLIP_GAP / 2,
    PAGE_W - PAGE_MARGIN,
    PAGE_MARGIN + SLIP_H + SLIP_GAP / 2
  );
  doc.setLineDashPattern([], 0);

  doc.save(`T4-${year}-${employee.lastName}-${employee.firstName}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────
// One T4 slip
// ─────────────────────────────────────────────────────────────────────────
function drawT4Slip(doc: jsPDF, x: number, y: number, d: T4Data) {
  // Outer perimeter
  doc.setLineWidth(1.4);
  doc.rect(x, y, SLIP_W, SLIP_H);

  // "Protected B" + form code on left vertical strip
  doc.setFontSize(7);
  doc.text(
    "Protected B when completed / Protégé B une fois rempli",
    x + 9,
    y + SLIP_H - 14,
    { angle: 90 }
  );
  doc.setFontSize(6.5);
  doc.text("T4 (24)", x + 9, y + SLIP_H - 14 - 230, { angle: 90 });

  const innerX = x + INNER_X_OFFSET;
  const innerY = y + 4;

  // ─── Header row ───
  const employerW = INNER_W * 0.58;
  const craX = innerX + employerW + 4;
  const craW = INNER_W - employerW - 4;

  drawEmployerNameBox(doc, innerX, innerY, employerW, HEADER_H, d.employer.name);
  drawCRAHeader(doc, craX, innerY, craW, HEADER_H, d.year);

  // ─── Middle section ───
  const midY = innerY + HEADER_H + 4;
  drawLeftColumn(doc, innerX, midY, LEFT_COL_W, MID_H, d);
  drawRightColumn(
    doc,
    innerX + LEFT_COL_W + COL_GAP,
    midY,
    RIGHT_COL_W,
    MID_H,
    d
  );

  // ─── Other information row (full width, bottom) ───
  drawOtherInformation(
    doc,
    innerX,
    midY + MID_H + 4,
    INNER_W,
    d.otherInformation
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Header pieces
// ─────────────────────────────────────────────────────────────────────────
function drawEmployerNameBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  name: string
) {
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, h);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Employer's name – Nom de l'employeur", x + 4, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(name, x + 6, y + 24);
}

function drawCRAHeader(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  year: number
) {
  // Simplified maple-leaf glyph: red diamond inside a small framed box
  doc.setLineWidth(0.4);
  doc.rect(x + 4, y + 3, 18, 13);
  // Red maple-leaf approximation — filled triangle with stem
  doc.setFillColor(204, 33, 47);
  doc.triangle(x + 13, y + 5, x + 8, y + 14, x + 18, y + 14, "F");
  doc.setFillColor(0, 0, 0);

  // Bilingual agency name
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Canada Revenue", x + 25, y + 8);
  doc.text("Agency", x + 25, y + 15);
  doc.text("Agence du revenu", x + 88, y + 8);
  doc.text("du Canada", x + 88, y + 15);

  // Year label + box
  doc.setFontSize(6.5);
  doc.text("Year", x + 4, y + 28);
  doc.text("Année", x + 4, y + 35);
  doc.setLineWidth(0.6);
  doc.rect(x + 25, y + 24, 44, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(year), x + 47, y + 35, { align: "center" });

  // T4 + title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("T4", x + w - 4, y + 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Statement of Remuneration Paid", x + w - 4, y + 30, {
    align: "right",
  });
  doc.setFontSize(7.5);
  doc.text("État de la rémunération payée", x + w - 4, y + 39, {
    align: "right",
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Left column: employer account, SIN, exempt, employment code, employee block
// ─────────────────────────────────────────────────────────────────────────
function drawLeftColumn(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  d: T4Data
) {
  // Box 54 — Employer's account number
  const acctH = 26;
  drawLeftBox(
    doc,
    x,
    y,
    w,
    acctH,
    "54",
    "Employer's account number / Numéro de compte de l'employeur",
    d.employer.accountNumber
  );

  // Row of three: SIN | Exempt | Employment code
  const rowY = y + acctH + 4;
  const rowH = 38;
  const sinW = w * 0.42;
  const exemptW = w * 0.42;
  const empCodeW = w - sinW - exemptW - 8;

  drawLeftBox(
    doc,
    x,
    rowY,
    sinW,
    rowH,
    "12",
    "Social insurance number",
    d.employee.sin,
    "Numéro d'assurance sociale"
  );
  drawExemptBox(doc, x + sinW + 4, rowY, exemptW, rowH, d);
  drawLeftBox(
    doc,
    x + sinW + exemptW + 8,
    rowY,
    empCodeW,
    rowH,
    "29",
    "Employment code",
    d.box29,
    "Code d'emploi"
  );

  // Employee name + address (fills the rest)
  const empY = rowY + rowH + 4;
  const empH = h - acctH - rowH - 12;
  drawEmployeeAddress(doc, x, empY, w, empH, d.employee);
}

function drawLeftBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  num: string,
  labelEn: string,
  value: string,
  labelFr?: string
) {
  // Labels at top
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(labelEn, x + 22, y + 7);
  if (labelFr) doc.text(labelFr, x + 22, y + 14);

  // Number tag on left
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(num, x + 2, y + h / 2 + 4);

  // Value box
  const boxY = labelFr ? y + 17 : y + 11;
  const boxH = h - (boxY - y) - 2;
  doc.setLineWidth(0.5);
  doc.rect(x + 22, boxY, w - 22, boxH);

  if (value) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(value, x + 22 + (w - 22) / 2, boxY + boxH / 2 + 4, {
      align: "center",
    });
  }
}

function drawExemptBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  d: T4Data
) {
  // Label + box number
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Exempt – Exemption", x + 22, y + 7);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("28", x + 2, y + h / 2 + 4);

  // 3 checkboxes for CPP/QPP, EI, PPIP
  const cbSize = 9;
  const cbY = y + 18;
  const items: Array<{ en: string; fr: string; checked: boolean }> = [
    { en: "CPP/QPP", fr: "RPC/RRQ", checked: d.exemptCPP },
    { en: "EI", fr: "AE", checked: d.exemptEI },
    { en: "PPIP", fr: "RPAP", checked: d.exemptPPIP },
  ];
  const startX = x + 22;
  const stepX = (w - 22) / 3;
  for (let i = 0; i < items.length; i++) {
    const cx = startX + i * stepX + (stepX - cbSize) / 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(items[i].en, cx + cbSize / 2, cbY - 4, { align: "center" });
    doc.setLineWidth(0.5);
    doc.rect(cx, cbY - 2, cbSize, cbSize);
    if (items[i].checked) {
      // X mark inside the checkbox
      doc.setLineWidth(0.8);
      doc.line(cx + 1, cbY - 1, cx + cbSize - 1, cbY + cbSize - 3);
      doc.line(cx + cbSize - 1, cbY - 1, cx + 1, cbY + cbSize - 3);
    }
    doc.text(items[i].fr, cx + cbSize / 2, cbY + cbSize + 6, {
      align: "center",
    });
  }
}

function drawEmployeeAddress(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  emp: T4Data["employee"]
) {
  // External label
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Employee's name and address – Nom et adresse de l'employé",
    x,
    y + 6
  );

  // Outer body
  const bodyY = y + 9;
  const bodyH = h - 9;
  doc.setLineWidth(0.6);
  doc.rect(x, bodyY, w, bodyH);

  // Sub-labels for the name fields (split bilingually to avoid overflow)
  doc.setFontSize(5);
  doc.text("Last name (in capital letters)", x + 4, bodyY + 5);
  doc.text("Nom de famille (en lettres moulées)", x + 4, bodyY + 11);
  doc.text("First name", x + w * 0.58, bodyY + 5);
  doc.text("Prénom", x + w * 0.58, bodyY + 11);
  doc.text("Initial", x + w * 0.85, bodyY + 5);
  doc.text("Initiale", x + w * 0.85, bodyY + 11);

  // Name row sub-box
  const nameRowY = bodyY + 14;
  const nameRowH = 18;
  doc.setLineWidth(0.4);
  doc.rect(x + 4, nameRowY, w - 8, nameRowH);

  // Name values
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(emp.lastName, x + 8, nameRowY + 13);
  doc.text(emp.firstName, x + w * 0.58 + 4, nameRowY + 13);
  if (emp.initial) {
    doc.text(emp.initial, x + w * 0.85 + 4, nameRowY + 13);
  }

  // Address lines below the name row (left blank for handwriting if absent)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let addrY = nameRowY + nameRowH + 12;
  for (const line of emp.addressLines) {
    if (!line) continue;
    doc.text(line, x + 8, addrY);
    addrY += 12;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Right column: 2-col × 8-row grid of amount boxes + top mini row
// ─────────────────────────────────────────────────────────────────────────
function drawRightColumn(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  d: T4Data
) {
  // Mini row at top: Box 45 (dental code) + Box 10 (province)
  drawTextBox(
    doc,
    x,
    y,
    SUB_COL_W,
    MINI_ROW_H,
    "45",
    "Employer-offered dental benefits",
    "Prestations dentaires offertes par l'employeur",
    d.box45
  );
  drawTextBox(
    doc,
    x + SUB_COL_W + SUB_GAP,
    y,
    SUB_COL_W,
    MINI_ROW_H,
    "10",
    "Province of employment",
    "Province d'emploi",
    d.employee.province
  );

  // Main grid
  const gridY = y + MINI_ROW_H + 4;

  const rows: Array<[AmountSpec, AmountSpec]> = [
    [
      { num: "14", labelEn: "Employment income", labelFr: "Revenus d'emploi", value: d.box14 },
      { num: "22", labelEn: "Income tax deducted", labelFr: "Impôt sur le revenu retenu", value: d.box22 },
    ],
    [
      { num: "16", labelEn: "Employee's CPP contributions – see over", labelFr: "Cotisations de l'employé au RPC – voir au verso", value: d.box16 },
      { num: "17", labelEn: "Employee's QPP contributions – see over", labelFr: "Cotisations de l'employé au RRQ – voir au verso", value: d.box17, blankIfZero: true },
    ],
    [
      { num: "16A", labelEn: "Employee's second CPP contributions", labelFr: "Deuxièmes cotisations de l'employé au RPC", value: d.box16A },
      { num: "17A", labelEn: "Employee's second QPP contributions", labelFr: "Deuxièmes cotisations de l'employé au RRQ", value: d.box17A, blankIfZero: true },
    ],
    [
      { num: "24", labelEn: "EI insurable earnings", labelFr: "Gains assurables d'AE", value: d.box24 },
      { num: "26", labelEn: "CPP/QPP pensionable earnings", labelFr: "Gains ouvrant droit à pension – RPC/RRQ", value: d.box26 },
    ],
    [
      { num: "18", labelEn: "Employee's EI premiums", labelFr: "Cotisations de l'employé à l'AE", value: d.box18 },
      { num: "44", labelEn: "Union dues", labelFr: "Cotisations syndicales", value: d.box44, blankIfZero: true },
    ],
    [
      { num: "20", labelEn: "RPP contributions", labelFr: "Cotisations à un RPA", value: d.box20, blankIfZero: true },
      { num: "46", labelEn: "Charitable donations", labelFr: "Dons de bienfaisance", value: d.box46, blankIfZero: true },
    ],
    [
      { num: "52", labelEn: "Pension adjustment", labelFr: "Facteur d'équivalence", value: d.box52, blankIfZero: true },
      { num: "50", labelEn: "RPP or DPSP registration number", labelFr: "N° d'agrément d'un RPA ou d'un RPDB", value: 0, blankIfZero: true, textOverride: d.box50 },
    ],
    [
      { num: "55", labelEn: "Employee's PPIP premiums – see over", labelFr: "Cotisations de l'employé au RPAP – voir au verso", value: d.box55, blankIfZero: true },
      { num: "56", labelEn: "PPIP insurable earnings", labelFr: "Gains assurables du RPAP", value: d.box56, blankIfZero: true },
    ],
  ];

  for (let i = 0; i < rows.length; i++) {
    const [left, right] = rows[i];
    const rY = gridY + i * AMOUNT_ROW_H;
    drawAmountBox(doc, x, rY, SUB_COL_W, AMOUNT_ROW_H - 2, left);
    drawAmountBox(doc, x + SUB_COL_W + SUB_GAP, rY, SUB_COL_W, AMOUNT_ROW_H - 2, right);
  }
}

interface AmountSpec {
  num: string;
  labelEn: string;
  labelFr: string;
  value: number;
  blankIfZero?: boolean;
  /** Override the right-aligned money value with a free-text string. */
  textOverride?: string;
}

function drawAmountBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  spec: AmountSpec
) {
  // Two-line centered label above the value box
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(spec.labelEn, x + w / 2, y + 6, { align: "center", maxWidth: w });
  doc.text(spec.labelFr, x + w / 2, y + 13, { align: "center", maxWidth: w });

  // Value box
  const boxY = y + 16;
  const boxH = h - 16;
  const numW = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(spec.num, x + 2, boxY + boxH / 2 + 3);

  doc.setLineWidth(0.5);
  doc.rect(x + numW, boxY, w - numW, boxH);

  const showValue = !(spec.blankIfZero && spec.value === 0 && !spec.textOverride);
  if (showValue) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const display = spec.textOverride ?? money(spec.value);
    doc.text(display, x + w - 4, boxY + boxH / 2 + 3.2, { align: "right" });
  }
}

function drawTextBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  num: string,
  labelEn: string,
  labelFr: string,
  value: string
) {
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(labelEn, x + w / 2, y + 6, { align: "center", maxWidth: w });
  doc.text(labelFr, x + w / 2, y + 13, { align: "center", maxWidth: w });

  const boxY = y + 16;
  const boxH = h - 16;
  const numW = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(num, x + 2, boxY + boxH / 2 + 3);

  doc.setLineWidth(0.5);
  doc.rect(x + numW, boxY, w - numW, boxH);

  if (value) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, x + numW + (w - numW) / 2, boxY + boxH / 2 + 3.2, {
      align: "center",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Other information row (bottom, full width)
//   Renders 6 cells (3 cols × 2 rows). Each cell has Box-Case + Amount-Montant.
//   Iterates over T4Data.otherInformation — extensible for Phase 2/3.
// ─────────────────────────────────────────────────────────────────────────
function drawOtherInformation(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  entries: T4OtherInfoEntry[]
) {
  // Section heading on the far left (bilingual)
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Other information", x, y + 8);
  doc.text("(see over)", x, y + 16);
  doc.setFontSize(6.5);
  doc.text("Autres renseignements", x, y + 30);
  doc.text("(voir au verso)", x, y + 38);

  // 6 cells: 3 columns × 2 rows
  const cellsStartX = x + 90;
  const cellW = (w - 90) / 3;
  const cellRowH = 24;

  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const cx = cellsStartX + col * cellW + 2;
    const cy = y + row * cellRowH + 2;
    const entry = entries[i];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text("Box – Case", cx, cy + 6);
    doc.text("Amount – Montant", cx + 36, cy + 6);
    doc.setLineWidth(0.5);
    doc.rect(cx, cy + 8, 32, 13);
    doc.rect(cx + 36, cy + 8, cellW - 44, 13);

    if (entry) {
      // Code goes in the small left box
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(String(entry.code), cx + 16, cy + 17, { align: "center" });
      // Amount in the right box
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(money(entry.amount), cx + 36 + (cellW - 44) - 4, cy + 17, {
        align: "right",
      });
      // Tiny bilingual label below cell (uses the registry)
      const meta = getOtherInfoMeta(entry.code);
      if (meta) {
        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text(meta.en.substring(0, 40), cx, cy + 23, { maxWidth: cellW - 6 });
      }
    }
  }
}
