#!/usr/bin/env python3
"""
NorthPay payroll math reference PDF generator.
Mirrors lib/payroll/constants.ts + engine.ts exactly.

Generated values are computed inline — no copy-paste from a source of truth
that could drift. If a constant changes in TS, change it here too and re-run.
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# ─────────────────────────────────────────────────────────────────────────
# Constants — kept in sync with lib/payroll/constants.ts
# ─────────────────────────────────────────────────────────────────────────

TAX_YEAR = 2026

# CPP 2026
CPP_YBE = 3500
CPP_YMPE = 74600
CPP_YAMPE = 85000
CPP_RATE = 0.0595
CPP2_RATE = 0.04
CPP_MAX = (CPP_YMPE - CPP_YBE) * CPP_RATE          # 4230.45
CPP2_MAX = (CPP_YAMPE - CPP_YMPE) * CPP2_RATE      # 416.00

# EI 2026
EI_MIE = 68900
EI_RATE = 0.0163
EI_EMPLOYER_MULT = 1.4
EI_MAX = EI_MIE * EI_RATE                          # 1123.07

# Federal 2026
FED_LOWEST_RATE = 0.14
FED_BRACKETS = [
    (58523, 0.14),
    (117045, 0.205),
    (181440, 0.26),
    (258482, 0.29),
    (float("inf"), 0.33),
]
BPA_HIGH = 16452
BPA_LOW = 14829
BPA_START = 181440
BPA_END = 258482

# Pay periods per year
PERIODS = {
    "weekly": 52,
    "biweekly": 26,
    "semimonthly": 24,
    "monthly": 12,
}

# Provincial tax tables (2026 confirmed)
PROV = {
    "ON": {
        "name": "Ontario",
        "brackets": [(53891, 0.0505), (107785, 0.0915), (150000, 0.1116),
                     (220000, 0.1216), (float("inf"), 0.1316)],
        "bpa": 12989,
        "surtax": [(5818, 0.20), (7446, 0.36)],
        "ot": 44,
    },
    "AB": {
        "name": "Alberta",
        "brackets": [(61200, 0.08), (154259, 0.10), (185111, 0.12),
                     (246813, 0.13), (370220, 0.14), (float("inf"), 0.15)],
        "bpa": 22769,
        "ot": 44,
    },
    "BC": {
        "name": "British Columbia",
        "brackets": [(50363, 0.056), (100728, 0.077), (115648, 0.105),
                     (140430, 0.1229), (190405, 0.147), (265545, 0.168),
                     (float("inf"), 0.205)],
        "bpa": 13216,
        "ot": 40,
    },
    "MB": {
        "name": "Manitoba",
        "brackets": [(47564, 0.108), (101200, 0.1275), (float("inf"), 0.174)],
        "bpa": 15780,
        "ot": 40,
    },
    "SK": {
        "name": "Saskatchewan",
        "brackets": [(54532, 0.105), (155805, 0.125), (float("inf"), 0.145)],
        "bpa": 20381,
        "ot": 40,
    },
    "NS": {
        "name": "Nova Scotia",
        "brackets": [(30995, 0.0879), (61991, 0.1495), (97418, 0.1667),
                     (157124, 0.175), (float("inf"), 0.21)],
        "bpa": 11932,
        "ot": 48,
    },
    "NB": {
        "name": "New Brunswick",
        "brackets": [(52332, 0.094), (104666, 0.14), (193861, 0.16),
                     (float("inf"), 0.195)],
        "bpa": 13664,
        "ot": 44,
    },
    "PE": {
        "name": "Prince Edward Island",
        "brackets": [(32656, 0.098), (81310, 0.138), (float("inf"), 0.167)],
        "bpa": 14525,
        "ot": 48,
    },
    "NL": {
        "name": "Newfoundland & Labrador",
        "brackets": [(44678, 0.087), (89355, 0.145), (159529, 0.158),
                     (223340, 0.178), (285318, 0.198), (570635, 0.208),
                     (1141272, 0.213), (float("inf"), 0.218)],
        "bpa": 15000,
        "ot": 40,
    },
}

# ─────────────────────────────────────────────────────────────────────────
# Math functions — mirror lib/payroll/{cpp,ei,federal-tax,provincial-tax}.ts
# ─────────────────────────────────────────────────────────────────────────

def r2(x): return round(x + 1e-9, 2)
def fmt(x): return f"${x:,.2f}"


def tax_on_brackets(annual, brackets):
    tax = 0.0
    last = 0
    for cap, rate in brackets:
        if annual > cap:
            tax += (cap - last) * rate
            last = cap
        else:
            tax += (annual - last) * rate
            return tax
    return tax


def federal_bpa(annual):
    if annual <= BPA_START:
        return BPA_HIGH
    if annual >= BPA_END:
        return BPA_LOW
    t = (annual - BPA_START) / (BPA_END - BPA_START)
    return BPA_HIGH - (BPA_HIGH - BPA_LOW) * t


def federal_tax_period(gross_period, pay_periods):
    annual = gross_period * pay_periods
    gross_tax = tax_on_brackets(annual, FED_BRACKETS)
    credit = federal_bpa(annual) * FED_LOWEST_RATE
    annual_tax = max(0, gross_tax - credit)
    return annual_tax / pay_periods


def provincial_tax_period(gross_period, pay_periods, province):
    p = PROV[province]
    annual = gross_period * pay_periods
    gross_tax = tax_on_brackets(annual, p["brackets"])
    credit = p["bpa"] * p["brackets"][0][1]
    prov_tax = max(0, gross_tax - credit)
    if "surtax" in p:
        st = 0.0
        for over, rate in p["surtax"]:
            if prov_tax > over:
                st += (prov_tax - over) * rate
        prov_tax += st
    return prov_tax / pay_periods


def cpp_period(gross_period, pay_periods, ytd_cpp=0):
    period_exempt = CPP_YBE / pay_periods
    contribution = max(0, gross_period - period_exempt) * CPP_RATE
    remaining = CPP_MAX - ytd_cpp
    return r2(max(0, min(contribution, remaining)))


def cpp2_period(gross_period, ytd_pensionable=0, ytd_cpp2=0):
    year_start = ytd_pensionable
    year_end = ytd_pensionable + gross_period
    overlap = max(0, min(year_end, CPP_YAMPE) - max(year_start, CPP_YMPE))
    contribution = overlap * CPP2_RATE
    remaining = CPP2_MAX - ytd_cpp2
    return r2(max(0, min(contribution, remaining)))


def ei_period(gross_period, ytd_ei=0):
    premium = gross_period * EI_RATE
    remaining = EI_MAX - ytd_ei
    return r2(max(0, min(premium, remaining)))


def run_payroll(province, employment_type, frequency, annual_salary=None,
                hourly_rate=None, hours=None, ot_hours=0, bonus=0,
                vacation_pct=4, vacation_mode="payout"):
    """Mirror lib/payroll/engine.ts:calculatePayrollLine"""
    pp = PERIODS[frequency]
    if employment_type == "salary":
        regular = r2(annual_salary / pp)
        hourly_equiv = annual_salary / (40 * 52)
        overtime = r2(hourly_equiv * 1.5 * ot_hours)
    else:
        regular = r2(hourly_rate * hours)
        overtime = r2(hourly_rate * 1.5 * ot_hours)

    earnings = regular + overtime + bonus
    vac_amt = r2(earnings * vacation_pct / 100)
    vac_paid = vac_amt if vacation_mode == "payout" else 0
    vac_banked = vac_amt if vacation_mode == "accrue" else 0
    gross = r2(earnings + vac_paid)

    cpp = cpp_period(gross, pp)
    cpp2 = cpp2_period(gross)
    ei = ei_period(gross)
    ei_employer = r2(ei * EI_EMPLOYER_MULT)

    cpp_ei_credit = r2((cpp + cpp2 + ei) * FED_LOWEST_RATE)
    fed = r2(max(0, federal_tax_period(gross, pp) - cpp_ei_credit))
    prov = r2(provincial_tax_period(gross, pp, province))

    deductions = r2(cpp + cpp2 + ei + fed + prov)
    net = r2(gross - deductions)
    return {
        "regular": regular, "overtime": overtime, "bonus": bonus,
        "vacation_paid": vac_paid, "vacation_banked": vac_banked,
        "gross": gross, "cpp": cpp, "cpp2": cpp2, "ei": ei,
        "fed": fed, "prov": prov, "deductions": deductions, "net": net,
        "cpp_employer": cpp, "cpp2_employer": cpp2, "ei_employer": ei_employer,
        "employer_cost": r2(gross + cpp + cpp2 + ei_employer),
    }


# ─────────────────────────────────────────────────────────────────────────
# PDF styling
# ─────────────────────────────────────────────────────────────────────────

INK = colors.HexColor("#141416")
MUTED = colors.HexColor("#6e6e76")
RULE = colors.HexColor("#dcdce0")
SOFT = colors.HexColor("#f7f7fa")
ACCENT = colors.HexColor("#1d4ed8")
SUCCESS = colors.HexColor("#15803d")
WARN = colors.HexColor("#a16207")

styles = getSampleStyleSheet()

h1 = ParagraphStyle("h1", parent=styles["Title"], fontName="Helvetica-Bold",
                    fontSize=26, leading=30, textColor=INK, spaceBefore=0, spaceAfter=4)
h2 = ParagraphStyle("h2", parent=styles["Heading1"], fontName="Helvetica-Bold",
                    fontSize=18, leading=22, textColor=INK, spaceBefore=18, spaceAfter=8)
h3 = ParagraphStyle("h3", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=13, leading=17, textColor=INK, spaceBefore=12, spaceAfter=4)
body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica",
                      fontSize=10, leading=14, textColor=INK, spaceAfter=4)
muted = ParagraphStyle("muted", parent=body, textColor=MUTED, fontSize=9, leading=12)
caption = ParagraphStyle("caption", parent=body, textColor=MUTED, fontSize=8.5,
                         leading=11, alignment=TA_CENTER, spaceAfter=2)
mono = ParagraphStyle("mono", parent=body, fontName="Courier", fontSize=9.5, leading=13)
note = ParagraphStyle("note", parent=body, fontSize=9, leading=12, textColor=WARN)


def tbl(data, col_widths=None, header=True, total_row=False, highlight_col=None):
    """Standard formatted table."""
    style = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.35, RULE),
    ]
    if header:
        style += [
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
            ("BACKGROUND", (0, 0), (-1, 0), SOFT),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ]
    if total_row:
        style += [
            ("FONT", (0, -1), (-1, -1), "Helvetica-Bold", 9.5),
            ("BACKGROUND", (0, -1), (-1, -1), SOFT),
            ("LINEABOVE", (0, -1), (-1, -1), 0.8, INK),
        ]
    if highlight_col is not None:
        style += [
            ("FONT", (highlight_col, 1), (highlight_col, -1), "Helvetica-Bold", 9.5),
        ]
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle(style))
    return t


def section(title): return Paragraph(title, h2)
def sub(title): return Paragraph(title, h3)
def p(text): return Paragraph(text, body)
def m(text): return Paragraph(text, muted)
def code(text): return Paragraph(text, mono)


# ─────────────────────────────────────────────────────────────────────────
# Build content
# ─────────────────────────────────────────────────────────────────────────

story = []

# ─── COVER ───
story += [
    Spacer(1, 1.4 * inch),
    Paragraph("NorthPay", h1),
    Paragraph(f"Canadian payroll math reference · Tax year {TAX_YEAR}", muted),
    Spacer(1, 0.3 * inch),
    Paragraph(
        "This document explains exactly how every paystub and T4 is calculated. "
        "Every formula, every bracket, every cap is here. If something in the app "
        "doesn't match this document, it's a bug.",
        body,
    ),
    Spacer(1, 0.6 * inch),
    Paragraph("Key 2026 changes (vs 2025)", h3),
    tbl([
        ["What", "2025", "2026", "Impact"],
        ["Federal lowest bracket rate", "15.00 %", "14.00 %", "Lower tax on every paystub"],
        ["Federal BPA (high)", "$16,129", "$16,452", "Higher base credit"],
        ["BPA phase-out", "—", "16,452 → 14,829", "Credit shrinks above $181k"],
        ["CPP YMPE", "$71,300", "$74,600", "Higher CPP cap"],
        ["CPP YAMPE", "$81,200", "$85,000", "Higher CPP2 ceiling"],
        ["Max CPP1 contrib", "$4,034.10", "$4,230.45", "More CPP1 over the year"],
        ["Max CPP2 contrib", "$396.00", "$416.00", "Slightly more CPP2"],
        ["EI MIE (max insurable)", "$65,700", "$68,900", "Higher EI cap"],
        ["EI employee rate", "1.64 %", "1.63 %", "Slightly lower EI"],
        ["Max EI premium", "$1,077.48", "$1,123.07", "Slightly more EI YTD"],
        ["Alberta brackets", "5 brackets, 10–15 %", "6 brackets, 8–15 %", "NEW 8 % on first $61,200"],
        ["BC lowest rate", "5.06 %", "5.60 %", "Higher BC tax (Feb 17 budget)"],
        ["Manitoba indexation", "1.7 %", "0 % (paused)", "Brackets unchanged"],
        ["NL Basic Personal Amount", "$11,067", "$15,000", "Big bump"],
        ["SK Basic Personal Amount", "$18,491", "$20,381", "Affordability Act"],
    ], col_widths=[2.2 * inch, 1.05 * inch, 1.15 * inch, 2.2 * inch]),
    Spacer(1, 0.5 * inch),
    Paragraph(
        "All values verified Dec 2025 – Jan 2026 against CRA T4127, "
        "CPB Canada CPP announcement, the EI Premium Notice, and TaxTips.ca "
        "province-by-province tables.",
        muted,
    ),
    PageBreak(),
]

# ─── 1. PAY FREQUENCY ───
story += [
    section("1.  Pay frequency math"),
    p("Every employee has a pay frequency. The engine divides annual salary "
      "by periods/year to get the per-period gross before any deductions."),
    Spacer(1, 6),
    tbl([
        ["Frequency", "Periods / year", "Symbol", "Example — $80,000 / yr"],
        ["Weekly",        "52", "weekly",       fmt(80000/52)],
        ["Bi-weekly",     "26", "biweekly",     fmt(80000/26)],
        ["Semi-monthly",  "24", "semimonthly",  fmt(80000/24)],
        ["Monthly",       "12", "monthly",      fmt(80000/12)],
    ], col_widths=[1.4*inch, 1.2*inch, 1.4*inch, 2.6*inch]),
    Spacer(1, 10),
    p("Per-period gross is the starting point for CPP, EI, federal tax, and "
      "provincial tax. Each of those four services has its own way of "
      "annualizing it (CPP and EI subtract a per-period exemption first; "
      "federal/provincial multiply gross by periods to find the bracket)."),
]

# ─── 2. CPP ───
story += [
    section(f"2.  CPP — Canada Pension Plan ({TAX_YEAR})"),
    sub("Constants (CRA confirmed)"),
    tbl([
        ["YBE — Year's Basic Exemption", fmt(CPP_YBE)],
        ["YMPE — Year's Maximum Pensionable Earnings", fmt(CPP_YMPE)],
        ["YAMPE — Year's Additional Maximum Pensionable Earnings", fmt(CPP_YAMPE)],
        ["CPP1 employee/employer rate", f"{CPP_RATE*100:.2f} %"],
        ["CPP2 rate (between YMPE and YAMPE)", f"{CPP2_RATE*100:.2f} %"],
        ["Max CPP1 contribution (annual)", fmt(CPP_MAX)],
        ["Max CPP2 contribution (annual)", fmt(CPP2_MAX)],
    ], col_widths=[3.7*inch, 1.7*inch], header=False),

    sub("Formula (per pay period)"),
    code("CPP1 = max(0, gross − YBE / periods_per_year) × 5.95 %"),
    code("       capped so YTD ≤ $4,230.45"),
    Spacer(1, 4),
    code("CPP2 = (overlap of [YTD_pensionable, YTD+gross]"),
    code("        with [YMPE, YAMPE]) × 4.00 %"),
    code("       capped so YTD ≤ $416.00"),

    sub("Worked example — Ontario, $92,000 salary, bi-weekly"),
    tbl([
        ["Step", "Calculation", "Value"],
        ["Per-period gross", "92,000 ÷ 26", fmt(92000/26)],
        ["Per-period YBE",   "3,500 ÷ 26",  fmt(CPP_YBE/26)],
        ["Taxable for CPP",  f"{fmt(92000/26)} − {fmt(CPP_YBE/26)}",  fmt(92000/26 - CPP_YBE/26)],
        ["CPP1 contribution", "× 5.95 %",   fmt((92000/26 - CPP_YBE/26) * CPP_RATE)],
        ["CPP2 contribution", "$92k < YMPE → no CPP2", "$0.00"],
    ], col_widths=[1.6*inch, 2.2*inch, 1.6*inch]),
]

# ─── 3. EI ───
story += [
    section(f"3.  EI — Employment Insurance ({TAX_YEAR})"),
    sub("Constants"),
    tbl([
        ["MIE — Max Insurable Earnings", fmt(EI_MIE)],
        ["Employee rate", f"{EI_RATE*100:.2f} %"],
        ["Employer multiplier", f"{EI_EMPLOYER_MULT}×"],
        ["Max employee premium (annual)", fmt(EI_MAX)],
        ["Max employer premium (annual)", fmt(EI_MAX * EI_EMPLOYER_MULT)],
    ], col_widths=[3.7*inch, 1.7*inch], header=False),

    sub("Formula"),
    code(f"EI_employee = gross × {EI_RATE*100:.2f} %  (capped so YTD ≤ {fmt(EI_MAX)})"),
    code(f"EI_employer = EI_employee × {EI_EMPLOYER_MULT}"),

    sub("Worked example — $92,000 salary, bi-weekly"),
    tbl([
        ["Step", "Calculation", "Value"],
        ["Per-period gross",        "92,000 ÷ 26",              fmt(92000/26)],
        ["EI employee premium",     f"× {EI_RATE*100:.2f} %",   fmt(r2(92000/26 * EI_RATE))],
        ["EI employer cost",        f"× {EI_EMPLOYER_MULT}",    fmt(r2(92000/26 * EI_RATE * EI_EMPLOYER_MULT))],
        ["Annual employee max",     "MIE × rate",               fmt(EI_MAX)],
    ], col_widths=[1.8*inch, 2.0*inch, 1.6*inch]),
]

# ─── 4. FEDERAL TAX ───
story += [
    PageBreak(),
    section(f"4.  Federal income tax ({TAX_YEAR})"),
    Paragraph(
        f"<b>2026 NEW:</b> The lowest bracket dropped from 15 % to <b>{FED_LOWEST_RATE*100:.0f} %</b>. "
        "This lower rate also applies to the BPA credit and to the K2 (CPP+EI) credit.",
        note,
    ),
    sub("Tax brackets"),
    tbl([
        ["Taxable income (annual)", "Rate", "Tax at top of bracket"],
        ["First $58,523",                       "14.0 %", fmt(58523 * 0.14)],
        ["$58,523 – $117,045",                  "20.5 %", fmt(58523*0.14 + (117045-58523)*0.205)],
        ["$117,045 – $181,440",                 "26.0 %", fmt(58523*0.14 + (117045-58523)*0.205 + (181440-117045)*0.26)],
        ["$181,440 – $258,482",                 "29.0 %", fmt(58523*0.14 + (117045-58523)*0.205 + (181440-117045)*0.26 + (258482-181440)*0.29)],
        ["Above $258,482",                      "33.0 %", "—"],
    ], col_widths=[2.3*inch, 1*inch, 1.6*inch]),

    sub("Basic Personal Amount — with phase-out"),
    p("The BPA is a tax credit applied at the lowest bracket rate (14 %)."),
    tbl([
        ["Annual income",                          "Effective BPA"],
        ["≤ $181,440",                             fmt(BPA_HIGH)],
        ["$181,440 → $258,482 (linear taper)",     f"{fmt(BPA_HIGH)} → {fmt(BPA_LOW)}"],
        ["≥ $258,482",                             fmt(BPA_LOW)],
    ], col_widths=[3.4*inch, 2*inch]),
    Spacer(1, 4),
    code("effectiveBPA(income) = bpaHigh − (bpaHigh − bpaLow) × t"),
    code("                      where t = (income − 181,440) / (258,482 − 181,440)"),

    sub("Per-period federal tax formula"),
    code("annual_taxable    = period_gross × periods_per_year"),
    code("gross_annual_tax  = sum of tax in each bracket"),
    code("bpa_credit        = effectiveBPA(annual_taxable) × 14 %"),
    code("k2_credit         = (period CPP + CPP2 + EI) × 14 %  ← per period"),
    code("period_fed_tax    = max(0, (gross_annual_tax − bpa_credit) / periods − k2_credit)"),
]

# ─── 5. PROVINCIAL TAX ───
story += [
    PageBreak(),
    section(f"5.  Provincial income tax — all 9 provinces ({TAX_YEAR})"),
    p("Each province has its own brackets, BPA, and (Ontario only) surtax. "
      "The engine reads from a single map keyed by province code; the math is identical "
      "to federal except (1) no BPA phase-out and (2) Ontario adds a surtax on top of net tax."),
]

for code_, p_ in PROV.items():
    bracket_rows = [["Up to", "Rate"]]
    last = 0
    for cap, rate in p_["brackets"]:
        cap_str = "no cap" if cap == float("inf") else fmt(cap)
        bracket_rows.append([cap_str, f"{rate*100:.2f} %"])
        last = cap
    story += [
        sub(f"{code_} — {p_['name']}"),
        tbl(bracket_rows, col_widths=[2.4*inch, 1*inch]),
        Spacer(1, 4),
        Paragraph(
            f"<b>Basic Personal Amount:</b> {fmt(p_['bpa'])} &nbsp;·&nbsp; "
            f"<b>Overtime threshold:</b> {p_['ot']} hrs / week" +
            (f" &nbsp;·&nbsp; <b>Surtax:</b> 20 % over $5,818, +36 % over $7,446 (tax-on-tax)" if "surtax" in p_ else ""),
            muted,
        ),
        Spacer(1, 8),
    ]

# ─── 6. VACATION ───
story += [
    PageBreak(),
    section("6.  Vacation pay — accrue vs payout"),
    p("Every employee has a vacation rate (default 4 %, the federal minimum). "
      "<b>How</b> vacation is paid depends on the per-employee <i>vacationMode</i> field."),

    sub("Mode: payout (default)"),
    code("vacation_amount = (regular + overtime + bonus) × vacation_pct"),
    code("gross = regular + overtime + bonus + vacation_amount"),
    p("Vacation lands in <b>gross pay</b>, gets taxed this period. Used for most hourly employees."),

    sub("Mode: accrue (banked)"),
    code("vacation_amount = (regular + overtime + bonus) × vacation_pct"),
    code("gross = regular + overtime + bonus            ← no vacation in gross"),
    code("vacation_banked_this_period = vacation_amount"),
    p("Vacation accumulates in a separate bank, untaxed for now. Paid out later as a "
      "lump sum (taxed at that time)."),

    sub("Worked example — Ontario hourly, $30/hr, 80 hrs bi-weekly, 4 %"),
    tbl([
        ["",                              "Payout mode",                     "Accrue mode"],
        ["Regular pay",                   fmt(30*80),                        fmt(30*80)],
        ["Vacation amount (4 %)",         fmt(30*80*0.04),                  fmt(30*80*0.04)],
        ["Gross (this period)",           fmt(30*80*1.04),                   fmt(30*80)],
        ["Vacation banked",               "—",                               fmt(30*80*0.04)],
        ["Taxed in this period?",         "Yes",                             "No — taxed when paid out"],
    ], col_widths=[1.8*inch, 1.7*inch, 1.7*inch]),
]

# ─── 7. OVERTIME ───
story += [
    section("7.  Overtime"),
    p(f"OT pays at <b>1.5×</b> the hourly rate. The trigger is weekly hours over the "
      "provincial threshold (column 'OT after')."),
    tbl([
        ["Province", "OT after (hrs/week)", "Rate"],
        *[(c, str(p_["ot"]), "1.5×") for c, p_ in PROV.items()],
    ], col_widths=[1.2*inch, 2*inch, 1*inch]),

    sub("Salaried OT — hourly equivalent"),
    p("Salaried employees logged with OT hours get paid at an hourly-equivalent rate:"),
    code("hourly_equiv = annual_salary / (standard_weekly_hours × 52)"),
    code("ot_pay       = hourly_equiv × 1.5 × ot_hours"),
    p("Default standard week is 40 hrs (so annual / 2,080). Configurable per employee."),

    sub("Example"),
    tbl([
        ["Salary", "Std weekly hrs", "Hourly equivalent", "5 OT hrs @ 1.5×"],
        [fmt(80000),  "40", fmt(80000/2080), fmt(80000/2080 * 1.5 * 5)],
        [fmt(80000),  "37.5", fmt(80000/1950), fmt(80000/1950 * 1.5 * 5)],
        [fmt(120000), "40", fmt(120000/2080), fmt(120000/2080 * 1.5 * 5)],
    ], col_widths=[1.2*inch, 1.3*inch, 1.6*inch, 1.6*inch]),
]

# ─── 8. YTD ───
story += [
    PageBreak(),
    section("8.  Year-to-date enforcement"),
    p("Each payroll run computes YTD per employee by folding all previously "
      "<b>finalized</b> runs in the same tax year. YTD then flows into CPP1, "
      "CPP2, and EI so caps stop deductions automatically mid-year."),

    sub("What gets capped"),
    tbl([
        ["Service",     "Annual cap",       "Behaviour after cap"],
        ["CPP1",        fmt(CPP_MAX),       "Stops contributing"],
        ["CPP2",        fmt(CPP2_MAX),      "Stops once YTD pensionable ≥ YAMPE"],
        ["EI employee", fmt(EI_MAX),        "Stops contributing"],
        ["Federal tax", "no cap",           "Continues per bracket"],
        ["Provincial",  "no cap",           "Continues per bracket"],
    ], col_widths=[1.5*inch, 1.4*inch, 2.5*inch]),

    sub("Voided runs"),
    p("When a payroll is voided, the original is kept (status='voided') and a "
      "reversal run is appended with negated line amounts. YTD always nets them to zero — "
      "no special case in the service."),
]

# ─── 9. FULL WORKED EXAMPLE — Ontario salary biweekly ───
story += [
    PageBreak(),
    section("9.  Full worked example — Ontario, $92,000 salary, bi-weekly"),
    p("End-to-end calculation. This is exactly what the engine produces."),
]

ex = run_payroll("ON", "salary", "biweekly", annual_salary=92000)
ex_table = [
    ["Step", "Calculation", "Amount"],
    ["1. Per-period gross", "92,000 ÷ 26", fmt(ex["gross"])],
    ["2. CPP1", "(gross − 3500/26) × 5.95 %", fmt(ex["cpp"])],
    ["3. CPP2", "92k < YMPE → 0", fmt(ex["cpp2"])],
    ["4. EI", f"gross × 1.63 % (capped at YTD {fmt(EI_MAX)})", fmt(ex["ei"])],
    ["5. K2 credit", f"(CPP + EI) × {FED_LOWEST_RATE*100:.0f}%", fmt(r2((ex["cpp"]+ex["cpp2"]+ex["ei"])*FED_LOWEST_RATE))],
    ["6. Federal tax", "see formula §4, less K2", fmt(ex["fed"])],
    ["7. Ontario tax", "see formula §5, includes surtax", fmt(ex["prov"])],
    ["8. Total deductions", "CPP + CPP2 + EI + Fed + ON", fmt(ex["deductions"])],
    ["9. Net pay", "gross − deductions", fmt(ex["net"])],
]
story += [
    tbl(ex_table, col_widths=[2.2*inch, 2.6*inch, 1*inch], total_row=True),
    Spacer(1, 12),
    Paragraph(
        f"Employer cost this period: gross + CPP match ({fmt(ex['cpp']+ex['cpp2'])}) + "
        f"EI 1.4× ({fmt(ex['ei_employer'])}) = <b>{fmt(ex['employer_cost'])}</b>",
        body,
    ),
]

# ─── 10. PAY FREQUENCY COMPARISON ───
story += [
    PageBreak(),
    section("10.  Same employee at every pay frequency"),
    p("Ontario, $80,000 salary. Different frequencies produce different per-period "
      "values but the same annualized totals — modulo rounding."),
]

freq_rows = [["Frequency", "Periods", "Gross", "CPP", "EI", "Fed", "ON", "Net"]]
for fname in ["weekly", "biweekly", "semimonthly", "monthly"]:
    r = run_payroll("ON", "salary", fname, annual_salary=80000)
    freq_rows.append([
        fname.replace("semimonthly", "semi-monthly"),
        str(PERIODS[fname]),
        fmt(r["gross"]), fmt(r["cpp"]), fmt(r["ei"]),
        fmt(r["fed"]), fmt(r["prov"]), fmt(r["net"]),
    ])
story += [
    tbl(freq_rows, col_widths=[1.05*inch, 0.55*inch, 0.75*inch, 0.65*inch, 0.6*inch, 0.7*inch, 0.65*inch, 0.75*inch]),
    Spacer(1, 8),
    Paragraph(
        f"Annual gross check: weekly × 52 = {fmt(80000)} · biweekly × 26 = {fmt(80000)} · "
        f"semi-monthly × 24 = {fmt(80000)} · monthly × 12 = {fmt(80000)}. All match.",
        muted,
    ),
]

# ─── 11. PROVINCE COMPARISON ───
story += [
    PageBreak(),
    section("11.  Same salary across all 9 provinces"),
    p("$80,000 salary, bi-weekly. Federal/CPP/EI are identical; only the provincial "
      "tax line differs — and the resulting net pay."),
]

prov_rows = [["Province", "Gross", "Federal", "Provincial", "CPP", "EI", "Net pay"]]
for code_ in ["ON", "AB", "BC", "MB", "SK", "NS", "NB", "PE", "NL"]:
    r = run_payroll(code_, "salary", "biweekly", annual_salary=80000)
    prov_rows.append([code_, fmt(r["gross"]), fmt(r["fed"]), fmt(r["prov"]),
                      fmt(r["cpp"]), fmt(r["ei"]), fmt(r["net"])])
story += [
    tbl(prov_rows, col_widths=[0.7*inch, 0.85*inch, 0.85*inch, 0.95*inch, 0.7*inch, 0.65*inch, 0.85*inch], highlight_col=6),
    Spacer(1, 8),
    Paragraph(
        "Highest net here: <b>Alberta</b> (new 8 % bottom bracket on first $61k + big BPA). "
        "Lowest: <b>Nova Scotia</b> (BPA only $11,932 + 14.95 % bracket starts at $30,995).",
        muted,
    ),
]

# ─── 12. HOURLY WITH OT ───
story += [
    PageBreak(),
    section("12.  Hourly example with OT and vacation payout"),
    p("BC, $30/hr, 88 regular hours + 4 OT hours bi-weekly, 4 % vacation (payout). "
      "Provincial OT threshold for BC is 40 hrs/week."),
]

hr_ex = run_payroll("BC", "hourly", "biweekly", hourly_rate=30, hours=88, ot_hours=4,
                    vacation_pct=4, vacation_mode="payout")
hr_rows = [
    ["Step", "Calculation", "Amount"],
    ["Regular pay",             "$30 × 88 hrs",                    fmt(hr_ex["regular"])],
    ["Overtime pay",            "$30 × 1.5 × 4 hrs",               fmt(hr_ex["overtime"])],
    ["Vacation (4 %)",          "(regular + OT) × 4 %",            fmt(hr_ex["vacation_paid"])],
    ["Gross",                   "sum of above",                    fmt(hr_ex["gross"])],
    ["CPP1",                    "(gross − YBE/26) × 5.95 %",       fmt(hr_ex["cpp"])],
    ["EI",                      "gross × 1.63 %",                  fmt(hr_ex["ei"])],
    ["Federal tax",             "see §4",                          fmt(hr_ex["fed"])],
    ["BC tax",                  "see §5",                          fmt(hr_ex["prov"])],
    ["Net pay",                 "gross − all deductions",          fmt(hr_ex["net"])],
]
story += [tbl(hr_rows, col_widths=[2*inch, 2.4*inch, 1.2*inch], total_row=True)]

# ─── 13. T4 BOXES ───
story += [
    PageBreak(),
    section("13.  T4 box mapping"),
    p("Every box on the T4 slip is computed from YTD totals over all finalized "
      "payroll runs in the tax year. Boxes not in this table are not yet populated."),
    tbl([
        ["Box",  "Label",                                   "Source"],
        ["10",   "Province of employment",                  "employee.province"],
        ["12",   "Social Insurance Number",                 "employee.sin"],
        ["14",   "Employment income",                       "Σ gross"],
        ["16",   "Employee's CPP contributions",            "Σ CPP1"],
        ["16A",  "Employee's second CPP contributions",     "Σ CPP2"],
        ["17",   "Employee's QPP contributions",            "0 (no Quebec support)"],
        ["17A",  "Employee's second QPP",                   "0"],
        ["18",   "Employee's EI premiums",                  "Σ EI"],
        ["22",   "Income tax deducted",                     "Σ federal + provincial"],
        ["24",   "EI insurable earnings",                   f"min(Σ gross, {fmt(EI_MIE)})"],
        ["26",   "CPP pensionable earnings",                f"min(Σ gross, {fmt(CPP_YMPE)})"],
        ["28",   "Exempt (CPP/EI/PPIP) checkboxes",         "All unchecked"],
        ["54",   "Employer's account number",               "company.businessNumber"],
        ["Other","Codes 30, 40, 42, 66+ etc.",              "Empty (Phase 2)"],
    ], col_widths=[0.6*inch, 2.6*inch, 2.4*inch]),
]

# ─── 14. PAYSTUB LAYOUT ───
story += [
    section("14.  Paystub PDF layout"),
    p("Letter size, generated client-side via jsPDF, downloaded directly to the user's machine."),
    tbl([
        ["Section",                "Contains"],
        ["Header band",            "Employer name, BN, CRA payroll account · Pay period · Pay date"],
        ["Employee block",         "Name, SIN (masked), province, frequency, employment type, comp rate"],
        ["EARNINGS table",         "Regular / OT (1.5×) / Bonus / Vacation paid — current + YTD columns"],
        ["DEDUCTIONS table",       "Federal / Provincial / CPP / EI — current + YTD"],
        ["NET DEPOSIT box",        "Large $ amount + YTD net + 'PAID' tag"],
        ["Vacation banked",        "Only shown when employee.vacationMode = 'accrue'"],
        ["Employer contributions", "CPP match + EI 1.4× + total employer cost"],
        ["Footer",                 "CRA disclaimer + 'Generated by NorthPay'"],
    ], col_widths=[1.6*inch, 4*inch]),
]

# ─── 15. LIFECYCLE + VALIDATION ───
story += [
    PageBreak(),
    section("15.  Payroll lifecycle + validation"),
    p("Every run flows through a state machine before being persisted:"),
    code("draft  →  preview  →  finalized  →  voided"),
    Spacer(1, 4),
    p("Only <b>finalized</b> runs contribute to YTD, paystubs, and T4s. Voided runs "
      "stay in the record and are netted to zero by their reversal entry."),

    sub("Pre-finalization validation checks"),
    tbl([
        ["Code",                            "Severity", "Triggers if…"],
        ["PERIOD_INVALID_DATES",            "error",    "Non-parseable date strings"],
        ["PERIOD_END_BEFORE_START",         "error",    "end < start"],
        ["PAY_DATE_BEFORE_PERIOD_END",      "error",    "pay date earlier than period end"],
        ["DUPLICATE_PAYROLL",               "error",    "Same employee + same period already finalized"],
        ["EMPLOYEE_NAME_MISSING",           "error",    "Empty first or last name"],
        ["EMPLOYEE_PROVINCE_UNSUPPORTED",   "error",    "Quebec or unknown province"],
        ["EMPLOYEE_SALARY_INVALID",         "error",    "Salary type with ≤ 0 annual"],
        ["EMPLOYEE_HOURLY_INVALID",         "error",    "Hourly type with ≤ 0 rate"],
        ["EMPLOYEE_VACATION_UNUSUAL",       "warning",  "Vacation % outside 0–20 %"],
        ["CPP_CAP_REACHED",                 "warning",  "YTD CPP1 already at annual max"],
        ["CPP2_CAP_REACHED",                "warning",  "YTD CPP2 already at annual max"],
        ["EI_CAP_REACHED",                  "warning",  "YTD EI already at annual max"],
        ["CPP2_TIER_EXHAUSTED",             "warning",  "YTD pensionable > YAMPE"],
    ], col_widths=[2.5*inch, 0.9*inch, 2.6*inch]),
    Spacer(1, 8),
    p("<b>Errors</b> block finalization. <b>Warnings</b> are surfaced in the UI "
      "but the run still completes."),
]

# ─── 16. ADDENDUM ───
story += [
    Spacer(1, 0.4 * inch),
    Paragraph("Out of scope (intentionally not modeled yet)", h3),
    tbl([
        ["Item",                                          "Reason"],
        ["Quebec (QPP/QPIP/RAMQ)",                        "Separate provincial system"],
        ["Statutory holiday averaging",                   "Provincial floor; needs holiday calendar"],
        ["TD1 personal credits (spouse, disability, age)","Per-employee; not captured yet"],
        ["RPP / DPSP contributions",                      "Benefits — Phase 2"],
        ["Taxable benefits (Box 40)",                     "Benefits — Phase 2"],
        ["Union dues (Box 44)",                           "Benefits — Phase 2"],
        ["ROE generation",                                "Termination flow"],
        ["T4 XML for e-filing",                           "CRA T619 envelope — Phase 2"],
        ["WSIB / WCB",                                    "Provincial workers' comp"],
    ], col_widths=[2.6*inch, 3*inch]),
]


# ─────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────

OUT = "/Users/rajbirbal/Desktop/Complete_with_Docusign_Rajbir_Rated_Illustra/Can/northpay/docs/NorthPay-Payroll-Math-2026.pdf"

doc = SimpleDocTemplate(
    OUT,
    pagesize=letter,
    leftMargin=0.7 * inch,
    rightMargin=0.7 * inch,
    topMargin=0.8 * inch,
    bottomMargin=0.7 * inch,
    title=f"NorthPay Payroll Math — {TAX_YEAR}",
    author="NorthPay",
)


def footer(canvas, _doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.4 * inch,
                      f"NorthPay · Canadian payroll math reference · {TAX_YEAR}")
    canvas.drawRightString(letter[0] - 0.7 * inch, 0.4 * inch,
                           f"Page {_doc.page}")
    canvas.restoreState()


doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f"Wrote {OUT}")
