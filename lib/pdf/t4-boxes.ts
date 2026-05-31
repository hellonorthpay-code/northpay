/**
 * T4 "Other information" box registry — every code that can appear in the
 * 6 numbered cells at the bottom of a T4(24) slip, with bilingual labels
 * straight off page 2 of the official CRA form.
 *
 * ────────────────────────────────────────────────────────────────────────
 * HOW TO USE THIS FOR PHASE 2 / 3 FEATURES
 * ────────────────────────────────────────────────────────────────────────
 *
 * The T4 slip layout never changes — the right column always shows the
 * fixed boxes (14, 22, 16, 17, 16A, 17A, 24, 26, 18, 44, 20, 46, 52, 50,
 * 55, 56), and the bottom has 6 generic Box-Case / Amount-Montant cells.
 *
 * When you ship a new feature that needs to land on T4, you just push an
 * entry into T4Data.otherInformation — NO layout code changes required.
 *
 * Examples:
 *   Phase 2 — Taxable benefits     → push { code: 40, amount: <total> }
 *   Phase 2 — Health premiums      → push { code: 85, amount: <total> }
 *   Phase 2 — Retiring allowance   → push { code: 66 or 67, amount }
 *   Phase 3 — Commission tracking  → push { code: 42, amount }
 *   Phase 3 — Fishers              → push { code: 78/79/80 }
 *
 * The renderer iterates through the array and looks up labels here.
 *
 * Source: CRA T4(24) form, page 2 "Report these amounts on your tax return"
 * and "Do not report these amounts on your tax return".
 */

export type T4BoxCategory =
  | "report-on-return"      // Goes on the employee's T1 return at the noted line
  | "internal"              // Already included in Box 14, informational only
  | "indigenous"            // Indian Act exempt-income codes
  | "covid"                 // 2020 CERB-era split employment income windows
  | "security-options"      // 110(1)(d) / 110(1)(d.1) deductions
  | "fishers"               // Self-employed fishers
  | "special-employment";   // Placement, taxi, barbers, etc.

export interface T4BoxMeta {
  code: number;
  en: string;
  fr: string;
  category: T4BoxCategory;
  /** CRA tax return line where the amount is reported, if any. */
  taxReturnLine?: string;
  /** True if amount is informational (already included in Box 14). */
  internalOnly?: boolean;
}

export const T4_OTHER_INFO_BOXES: Record<number, T4BoxMeta> = {
  // ── Internal (already in Box 14) ───────────────────────────────────
  30: { code: 30, category: "internal", internalOnly: true,
    en: "Board and lodging",
    fr: "Pension et logement" },
  31: { code: 31, category: "internal", internalOnly: true,
    en: "Special work site",
    fr: "Chantier particulier" },
  32: { code: 32, category: "internal", internalOnly: true,
    en: "Travel in a prescribed zone",
    fr: "Voyages dans une zone visée par règlement" },
  33: { code: 33, category: "internal", internalOnly: true,
    en: "Medical travel assistance",
    fr: "Aide accordée pour les voyages pour soins médicaux" },
  34: { code: 34, category: "internal", internalOnly: true,
    en: "Personal use of employer's automobile or motor vehicle",
    fr: "Usage personnel de l'automobile ou du véhicule à moteur de l'employeur" },
  36: { code: 36, category: "internal", internalOnly: true,
    en: "Interest-free and low-interest loans",
    fr: "Prêts sans intérêt ou à faible intérêt" },
  40: { code: 40, category: "internal", internalOnly: true,
    en: "Other taxable allowances and benefits",
    fr: "Autres allocations et avantages imposables" },

  // ── Security options (some internal, some on return) ───────────────
  38: { code: 38, category: "security-options", internalOnly: true,
    en: "Security options benefits – Before June 25, 2024",
    fr: "Avantages liés aux options d'achat de titres – Avant le 25 juin 2024" },
  86: { code: 86, category: "security-options", internalOnly: true,
    en: "Security options election",
    fr: "Choix liés aux options d'achat de titres" },
  90: { code: 90, category: "security-options", internalOnly: true,
    en: "Security option benefits – On or after June 25, 2024",
    fr: "Avantages liés aux options d'achat de titres – À partir du 25 juin 2024" },
  39: { code: 39, category: "security-options", taxReturnLine: "24900",
    en: "Security options deduction 110(1)(d) – Before June 25, 2024",
    fr: "Déduction pour options d'achat de titres 110(1)(d) – Avant le 25 juin 2024" },
  41: { code: 41, category: "security-options", taxReturnLine: "24900",
    en: "Security options deduction 110(1)(d.1) – Before June 25, 2024",
    fr: "Déduction pour options d'achat de titres 110(1)(d.1) – Avant le 25 juin 2024" },
  91: { code: 91, category: "security-options", taxReturnLine: "24900",
    en: "Security options deduction 110(1)(d) – On or after June 25, 2024",
    fr: "Déduction pour options d'achat de titres 110(1)(d) – À partir du 25 juin 2024" },
  92: { code: 92, category: "security-options", taxReturnLine: "24900",
    en: "Security options deduction 110(1)(d.1) – On or after June 25, 2024",
    fr: "Déduction pour options d'achat de titres 110(1)(d.1) – À partir du 25 juin 2024" },

  // ── COVID-era split employment income ──────────────────────────────
  57: { code: 57, category: "covid", internalOnly: true,
    en: "Employment Income – March 15 to May 9, 2020",
    fr: "Revenus d'emploi – Du 15 mars au 9 mai 2020" },
  58: { code: 58, category: "covid", internalOnly: true,
    en: "Employment Income – May 10 to July 4, 2020",
    fr: "Revenus d'emploi – Du 10 mai au 4 juillet 2020" },
  59: { code: 59, category: "covid", internalOnly: true,
    en: "Employment Income – July 5 to August 29, 2020",
    fr: "Revenus d'emploi – Du 5 juillet au 29 août 2020" },
  60: { code: 60, category: "covid", internalOnly: true,
    en: "Employment Income – August 30 to September 26, 2020",
    fr: "Revenus d'emploi – Du 30 août au 26 septembre 2020" },

  // ── Reported on the employee's tax return ──────────────────────────
  42: { code: 42, category: "report-on-return", taxReturnLine: "10120", internalOnly: true,
    en: "Employment commissions",
    fr: "Commissions d'emploi" },
  43: { code: 43, category: "report-on-return", taxReturnLine: "24400", internalOnly: true,
    en: "Canadian Armed Forces personnel and police deduction",
    fr: "Déduction pour le personnel des Forces canadiennes et des forces policières" },
  66: { code: 66, category: "report-on-return", taxReturnLine: "13000",
    en: "Eligible retiring allowances",
    fr: "Allocations de retraite admissibles" },
  67: { code: 67, category: "report-on-return", taxReturnLine: "13000",
    en: "Non-eligible retiring allowances",
    fr: "Allocations de retraite non admissibles" },
  74: { code: 74, category: "report-on-return", taxReturnLine: "20700",
    en: "Past service contributions for 1989 or earlier years while a contributor",
    fr: "Services passés pour 1989 et les années précédentes pendant que l'employé cotisait" },
  75: { code: 75, category: "report-on-return", taxReturnLine: "20700",
    en: "Past service contributions for 1989 or earlier years while not a contributor",
    fr: "Services passés pour 1989 et les années précédentes pendant que l'employé ne cotisait pas" },
  77: { code: 77, category: "report-on-return", taxReturnLine: "22900",
    en: "Workers' compensation benefits repaid to the employer",
    fr: "Indemnités pour accidents du travail remboursées à l'employeur" },
  85: { code: 85, category: "report-on-return", taxReturnLine: "33099",
    en: "Employee-paid premiums for private health services plans",
    fr: "Primes versées par l'employé à un régime privé d'assurance-maladie" },
  87: { code: 87, category: "report-on-return", taxReturnLine: "10100",
    en: "Emergency services volunteer exempt amount",
    fr: "Montant exempté d'impôt versé à un volontaire des services d'urgence" },

  // ── Fishers ───────────────────────────────────────────────────────
  78: { code: 78, category: "fishers",
    en: "Fishers – Gross income",
    fr: "Pêcheurs – Revenus bruts" },
  79: { code: 79, category: "fishers",
    en: "Fishers – Net partnership amount",
    fr: "Pêcheurs – Montant net d'un associé de la société de personnes" },
  80: { code: 80, category: "fishers",
    en: "Fishers – Shareperson amount",
    fr: "Pêcheurs – Montant du pêcheur à part" },

  // ── Special employment categories ─────────────────────────────────
  81: { code: 81, category: "special-employment",
    en: "Placement or employment agency workers",
    fr: "Travailleurs d'agences ou de bureaux de placement" },
  82: { code: 82, category: "special-employment",
    en: "Taxi drivers and drivers of other passenger-carrying vehicles",
    fr: "Chauffeurs de taxi ou d'un autre véhicule de transport de passagers" },
  83: { code: 83, category: "special-employment",
    en: "Barbers or hairdressers",
    fr: "Barbiers et coiffeurs" },

  // ── Indian Act exempt income ───────────────────────────────────────
  69: { code: 69, category: "indigenous",
    en: "Indian Act (exempt income) – Non-eligible retiring allowances",
    fr: "Loi sur les Indiens (revenu d'emploi exonéré) – Allocations de retraite non admissibles" },
  71: { code: 71, category: "indigenous",
    en: "Indian Act (exempt income) – Employment",
    fr: "Loi sur les Indiens (revenu d'emploi exonéré) – emploi" },
  88: { code: 88, category: "indigenous",
    en: "Indian Act (exempt income) – Self-employed",
    fr: "Loi sur les Indiens (revenu d'emploi exonéré) – travail indépendant" },
  94: { code: 94, category: "indigenous",
    en: "Indian Act (exempt income) – RPP contributions",
    fr: "Loi sur les Indiens (revenu d'emploi exonéré) – cotisations à un RPA" },
  95: { code: 95, category: "indigenous",
    en: "Indian Act (exempt income) – Union dues",
    fr: "Loi sur les Indiens (revenu d'emploi exonéré) – cotisations syndicales" },
};

export interface T4OtherInfoEntry {
  /** Box code (one of T4_OTHER_INFO_BOXES keys). */
  code: number;
  /** Dollar amount for the year. */
  amount: number;
}

/** Look up bilingual labels for a given Other-Information code. */
export function getOtherInfoMeta(code: number): T4BoxMeta | undefined {
  return T4_OTHER_INFO_BOXES[code];
}

/** Dental benefits Box 45 valid codes (CRA spec). */
export const T4_DENTAL_BENEFIT_CODES = {
  1: "Not eligible for any dental coverage",
  2: "Only the payee (employee)",
  3: "Payee, spouse and dependent children",
  4: "Only the payee and their immediate family",
  5: "Only some of the payee's family",
} as const;

/** Employment code Box 29 (CRA spec — most common values). */
export const T4_EMPLOYMENT_CODES = {
  11: "Placement or employment agency workers",
  12: "Drivers of taxis or other passenger-carrying vehicles",
  13: "Barbers or hairdressers",
  14: "Withdrawal from prescribed salary deferral arrangement plan",
  15: "Seasonal Agricultural Workers Program",
  16: "Detached employee — Social security agreement",
  17: "Fishers — Self-employed",
} as const;
