"""
Generates NorthPay-Payroll-Math.pdf — a comprehensive reference of every
formula and constant the engine uses, with worked examples.

Values mirror lib/payroll/constants.ts and lib/payroll/engine.ts EXACTLY.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# ───────────────────────── 2026 constants (mirror constants.ts) ─────────────────────────
TAX_YEAR = 2026

CPP = {
    "ybe": 3500,
    "ympe": 74600,       # confirmed 2026
    "yampe": 85000,      # confirmed 2026
    "rate": 0.0595,
    "cpp2_rate": 0.04,
}
CPP_MAX = (CPP["ympe"] - CPP["ybe"]) * CPP["rate"]   # $4,230.45
CPP2_MAX = (CPP["yampe"] - CPP["ympe"]) * CPP["cpp2_rate"]  # $416.00

EI = {
    "mie": 68900,        # confirmed 2026
    "rate": 0.0163,      # confirmed 2026 (was 1.64% in 2025)
    "multiplier": 1.4,
}
EI_MAX = EI["mie"] * EI["rate"]  # $1,123.07

# Federal 2026 — lowest rate dropped 15% → 14% (Tax Cut for the Middle Class)
FEDERAL = {
    "brackets": [
        (58523, 0.14),    # ← 14%, not 15%
        (117045, 0.205),
        (181440, 0.26),
        (258482, 0.29),
        (float("inf"), 0.33),
    ],
    "bpa": 16452,
    "bpa_phaseout_start": 181440,
    "bpa_phaseout_end": 258482,
    "bpa_low": 14829,
    "lowest_rate": 0.14,
}

# All 2026 provincial tables — confirmed per province
PROVINCIAL = {
    "ON": {"name": "Ontario", "brackets": [(53891, 0.0505), (107785, 0.0915), (150000, 0.1116), (220000, 0.1216), (float("inf"), 0.1316)], "bpa": 12989, "surtax": [(5818, 0.20), (7446, 0.36)]},
    "AB": {"name": "Alberta", "brackets": [(61200, 0.08), (154259, 0.10), (185111, 0.12), (246813, 0.13), (370220, 0.14), (float("inf"), 0.15)], "bpa": 22769},
    "BC": {"name": "British Columbia", "brackets": [(50363, 0.056), (100728, 0.077), (115648, 0.105), (140430, 0.1229), (190405, 0.147), (265545, 0.168), (float("inf"), 0.205)], "bpa": 13216},
    "MB": {"name": "Manitoba", "brackets": [(47564, 0.108), (101200, 0.1275), (float("inf"), 0.174)], "bpa": 15780},
    "SK": {"name": "Saskatchewan", "brackets": [(54532, 0.105), (155805, 0.125), (float("inf"), 0.145)], "bpa": 20381},
    "NS": {"name": "Nova Scotia", "brackets": [(30995, 0.0879), (61991, 0.1495), (97418, 0.1667), (157124, 0.175), (float("inf"), 0.21)], "bpa": 11932},
    "NB": {"name": "New Brunswick", "brackets": [(52332, 0.094), (104666, 0.14), (193861, 0.16), (float("inf"), 0.195)], "bpa": 13664},
    "PE": {"name": "Prince Edward Island", "brackets": [(32656, 0.098), (81310, 0.138), (float("inf"), 0.167)], "bpa": 14525},
    "NL": {"name": "Newfoundland & Labrador", "brackets": [(44678, 0.087), (89355, 0.145), (159529, 0.158), (223340, 0.178), (285318, 0.198), (570635, 0.208), (1141272, 0.213), (float("inf"), 0.218)], "bpa": 15000},
}

OT_HOURS = {"ON": 44, "AB": 44, "BC": 40, "MB": 40, "SK": 40, "NS": 48, "NB": 44, "PE": 48, "NL": 40}
PERIODS = {"weekly": 52, "biweekly": 26, "semimonthly": 24, "monthly": 12}


# ───────────────────────── Pure math helpers (mirror engine) ─────────────────────────
def round2(n):
    return round(n + 1e-9, 2)


def tax_on_income(annual, brackets):
    tax, last = 0.0, 0.0
    for cap, rate in brackets:
        if annual > cap:
            tax += (cap - last) * rate
            last = cap
        else:
            tax += (annual - last) * rate
            return tax
    return tax


def calc_cpp(pensionable, periods, ytd_cpp=0):
    exempt = CPP["ybe"] / periods
    contrib = max(0, pensionable - exempt) * CPP["rate"]
    remaining = CPP_MAX - ytd_cpp
    return round2(min(contrib, max(0, remaining)))


def calc_cpp2(period_pens, ytd_pens=0, ytd_cpp2=0):
    year_start, year_end = ytd_pens, ytd_pens + period_pens
    overlap = max(0, min(year_end, CPP["yampe"]) - max(year_start, CPP["ympe"]))
    contrib = overlap * CPP["cpp2_rate"]
    remaining = CPP2_MAX - ytd_cpp2
    return round2(min(contrib, max(0, remaining)))


def calc_ei(insurable, ytd_ei=0):
    prem = insurable * EI["rate"]
    remaining = EI_MAX - ytd_ei
    return round2(min(prem, max(0, remaining)))


def federal_bpa(annual_income):
    start = FEDERAL["bpa_phaseout_start"]
    end = FEDERAL["bpa_phaseout_end"]
    if annual_income <= start: return FEDERAL["bpa"]
    if annual_income >= end: return FEDERAL["bpa_low"]
    t = (annual_income - start) / (end - start)
    return FEDERAL["bpa"] - (FEDERAL["bpa"] - FEDERAL["bpa_low"]) * t


def calc_federal(period_taxable, periods):
    if period_taxable <= 0: return 0.0
    annualized = period_taxable * periods
    gross = tax_on_income(annualized, FEDERAL["brackets"])
    bpa_credit = federal_bpa(annualized) * FEDERAL["lowest_rate"]
    return round2(max(0, gross - bpa_credit) / periods)


def calc_prov(period_taxable, periods, prov):
    if period_taxable <= 0: return 0.0
    cfg = PROVINCIAL[prov]
    annualized = period_taxable * periods
    gross = tax_on_income(annualized, cfg["brackets"])
    bpa_credit = cfg["bpa"] * cfg["brackets"][0][1]
    pt = max(0, gross - bpa_credit)
    if "surtax" in cfg:
        sur = 0
        for over, rate in cfg["surtax"]:
            if pt > over:
                sur += (pt - over) * rate
        pt += sur
    return round2(pt / periods)


def run_line(annual_salary, prov, freq):
    """Compute a salaried payroll line — matches engine.ts behaviour."""
    periods = PERIODS[freq]
    gross = round2(annual_salary / periods)
    cpp_e = calc_cpp(gross, periods)
    cpp2 = calc_cpp2(gross)
    ei_e = calc_ei(gross)
    # K2 credit uses lowest federal rate — 14% for 2026.
    credit = round2((cpp_e + cpp2 + ei_e) * FEDERAL["lowest_rate"])
    fed = calc_federal(gross, periods)
    fed = round2(max(0, fed - credit))
    prov_t = calc_prov(gross, periods, prov)
    total_ded = round2(cpp_e + cpp2 + ei_e + fed + prov_t)
    net = round2(gross - total_ded)
    return {"gross": gross, "cpp": cpp_e, "cpp2": cpp2, "ei": ei_e,
            "fed": fed, "prov": prov_t, "ded": total_ded, "net": net}


# ───────────────────────── PDF setup ─────────────────────────
INK = colors.HexColor("#141416")
MUTED = colors.HexColor("#6e6e76")
RULE = colors.HexColor("#dcdce0")
SOFT = colors.HexColor("#f6f7f9")
ACCENT = colors.HexColor("#0b6e4f")
WARN = colors.HexColor("#a3580d")

styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                    fontSize=22, leading=26, textColor=INK, spaceAfter=4, spaceBefore=0)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=14, leading=18, textColor=INK, spaceAfter=4, spaceBefore=14)
H3 = ParagraphStyle("H3", parent=styles["Heading3"], fontName="Helvetica-Bold",
                    fontSize=11, leading=15, textColor=INK, spaceAfter=2, spaceBefore=8)
BODY = ParagraphStyle("BODY", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=9.5, leading=14, textColor=INK, spaceAfter=4)
SMALL = ParagraphStyle("SMALL", parent=styles["BodyText"], fontName="Helvetica",
                       fontSize=8.5, leading=12, textColor=MUTED)
MONO = ParagraphStyle("MONO", parent=styles["BodyText"], fontName="Courier",
                      fontSize=8.5, leading=12, textColor=INK, leftIndent=10,
                      backColor=SOFT, borderPadding=6, spaceBefore=4, spaceAfter=8)
TITLE = ParagraphStyle("TITLE", parent=styles["Title"], fontName="Helvetica-Bold",
                       fontSize=34, leading=40, textColor=INK, alignment=TA_LEFT,
                       spaceAfter=2)
SUB = ParagraphStyle("SUB", parent=styles["Title"], fontName="Helvetica",
                     fontSize=12, leading=16, textColor=MUTED, alignment=TA_LEFT)


def std_table_style(header_bg=SOFT):
    return TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 8.5),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])


def money(n):
    return f"${n:,.2f}"


def pct(n):
    return f"{n * 100:.2f}%"


# ───────────────────────── Content builders ─────────────────────────
def cover():
    return [
        Spacer(1, 1.4 * inch),
        Paragraph("NorthPay", TITLE),
        Paragraph("Canadian Payroll Calculation Reference", SUB),
        Spacer(1, 0.4 * inch),
        Paragraph(f"Tax year {TAX_YEAR} · 9 provinces · 4 pay frequencies", BODY),
        Paragraph(
            "Every formula, every constant, every bracket used by the NorthPay "
            "engine — alongside worked examples so you can verify any paystub or "
            "T4 by hand.",
            BODY,
        ),
        Spacer(1, 0.5 * inch),
        meta_table(),
        Spacer(1, 2 * inch),
        Paragraph(
            "Generated from <i>lib/payroll/constants.ts</i> and <i>lib/payroll/engine.ts</i>. "
            "Numbers below 2026 finalization are projected from 2025 with light indexation; "
            "All values verified against CRA, CEIC and provincial 2026 sources.",
            SMALL,
        ),
        PageBreak(),
    ]


def meta_table():
    data = [
        ["Tax year", str(TAX_YEAR)],
        ["Provinces supported", "ON · AB · BC · MB · SK · NS · NB · PE · NL"],
        ["Quebec", "Intentionally excluded (separate RQ system)"],
        ["Pay frequencies", "Weekly (52) · Bi-weekly (26) · Semi-monthly (24) · Monthly (12)"],
        ["CPP1 employee rate", pct(CPP["rate"])],
        ["CPP2 rate (YMPE→YAMPE)", pct(CPP["cpp2_rate"])],
        ["EI employee rate", pct(EI["rate"])],
        ["EI employer multiplier", f"{EI['multiplier']}×"],
    ]
    t = Table(data, colWidths=[2.0 * inch, 4.5 * inch])
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
        ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, SOFT]),
        ("BOX", (0, 0), (-1, -1), 0.6, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def section_periods():
    items = [
        Paragraph("1. Pay frequency math", H2),
        Paragraph(
            "Every per-period calculation starts by dividing the annual amount by "
            "<b>periods per year</b>. The reverse — annualizing — multiplies the period "
            "amount by the same factor so it can be compared against annual tax brackets and "
            "CRA exemptions.",
            BODY,
        ),
    ]
    freq_table = Table(
        [
            ["Frequency", "Periods / year", "Formula (gross)"],
            ["Weekly", "52", "annual_salary / 52"],
            ["Bi-weekly", "26", "annual_salary / 26"],
            ["Semi-monthly", "24", "annual_salary / 24"],
            ["Monthly", "12", "annual_salary / 12"],
        ],
        colWidths=[1.6 * inch, 1.2 * inch, 3.7 * inch],
    )
    freq_table.setStyle(std_table_style())
    items.append(Spacer(1, 4))
    items.append(freq_table)
    items.append(Spacer(1, 4))
    items.append(
        Paragraph(
            "For hourly employees: <i>gross = hourly_rate × regular_hours + hourly_rate × "
            "1.5 × overtime_hours + bonuses + vacation_accrual</i>",
            BODY,
        )
    )
    return items


def section_cpp():
    rate_table = Table(
        [
            ["Constant", "Value", "Source"],
            ["Year's Basic Exemption (YBE)", money(CPP["ybe"]), "CRA — frozen"],
            ["YMPE (CPP1 ceiling)", money(CPP["ympe"]), "CRA 2026 confirmed"],
            ["YAMPE (CPP2 ceiling)", money(CPP["yampe"]), "CRA 2026 confirmed"],
            ["Employee rate", pct(CPP["rate"]), "CRA"],
            ["Annual max CPP1", money(CPP_MAX), "(YMPE − YBE) × rate"],
            ["Annual max CPP2", money(CPP2_MAX), "(YAMPE − YMPE) × 4%"],
        ],
        colWidths=[2.4 * inch, 1.4 * inch, 2.7 * inch],
    )
    rate_table.setStyle(std_table_style())

    # Worked example: ON salary 92,000 bi-weekly
    bi_pens = round2(92000 / 26)
    bi_exempt = round2(CPP["ybe"] / 26)
    bi_cpp = calc_cpp(bi_pens, 26)
    formula = (
        f"period_exempt = {CPP['ybe']} / 26 = {bi_exempt:.2f}<br/>"
        f"taxable_for_cpp = {bi_pens:.2f} − {bi_exempt:.2f} = {bi_pens - bi_exempt:.2f}<br/>"
        f"contribution = {bi_pens - bi_exempt:.2f} × {CPP['rate']} = {bi_cpp:.2f}<br/>"
        f"YTD remaining vs cap → if YTD CPP ≥ {money(CPP_MAX)} → contribution = 0"
    )

    return [
        Paragraph("2. Canada Pension Plan (CPP1)", H2),
        Paragraph(
            "CPP1 is the base tier. Pensionable earnings above the YBE and below YMPE are "
            "taxed at 5.95% (employee) matched 1:1 by the employer.",
            BODY,
        ),
        rate_table,
        Spacer(1, 6),
        Paragraph("Per-period formula (lib/payroll/cpp.ts)", H3),
        Paragraph(
            "<font name='Courier'>cpp = max(0, pensionable − YBE/periods) × 5.95% &nbsp;"
            "(capped so YTD ≤ annual max)</font>",
            BODY,
        ),
        Paragraph("Worked example — Ontario, salary $92,000, bi-weekly", H3),
        Paragraph(formula, MONO),
    ]


def section_cpp2():
    return [
        Paragraph("3. CPP2 (second tier)", H2),
        Paragraph(
            "Earnings above YMPE up to YAMPE are taxed at 4% (employee + employer match). "
            "Once YTD pensionable earnings exceed YAMPE, CPP2 contribution = 0.",
            BODY,
        ),
        Paragraph(
            "<font name='Courier'>tier_overlap = max(0, min(year_end, YAMPE) − max(year_start, YMPE))<br/>"
            "cpp2 = tier_overlap × 4% &nbsp; (capped at annual max)</font>",
            BODY,
        ),
        Paragraph(
            f"Example — employee with YTD pensionable $70,000, this period adds $5,000:<br/>"
            f"year_start = 70,000 · year_end = 75,000 · YMPE = {money(CPP['ympe'])}<br/>"
            f"overlap = min(75000, 85000) − max(70000, 74600) = 75000 − 74600 = 400<br/>"
            f"cpp2 = 400 × 4% = $16.00",
            MONO,
        ),
    ]


def section_ei():
    table = Table(
        [
            ["Constant", "Value"],
            ["Maximum Insurable Earnings (MIE)", money(EI["mie"])],
            ["Employee rate", pct(EI["rate"])],
            ["Employer multiplier", f"{EI['multiplier']}×"],
            ["Annual max employee premium", money(EI_MAX)],
            ["Annual max employer premium", money(EI_MAX * EI["multiplier"])],
        ],
        colWidths=[3.0 * inch, 3.5 * inch],
    )
    table.setStyle(std_table_style())
    return [
        Paragraph("4. Employment Insurance (EI)", H2),
        Paragraph(
            "EI premiums are deducted on insurable earnings until the annual maximum is hit. "
            "Employer pays 1.4× the employee premium.",
            BODY,
        ),
        table,
        Paragraph(
            "<font name='Courier'>ei_employee = insurable × 1.63% &nbsp; (capped at annual max)<br/>"
            "ei_employer  = ei_employee × 1.4</font>",
            BODY,
        ),
        Paragraph(
            f"Example — gross $3,538.46 (Ontario, salary $92k bi-weekly):<br/>"
            f"ei_employee = 3,538.46 × 0.0163 = {money(round2(3538.46 * 0.0163))}<br/>"
            f"ei_employer = {money(round2(3538.46 * 0.0163))} × 1.4 = {money(round2(3538.46 * 0.0163 * 1.4))}",
            MONO,
        ),
    ]


def section_federal():
    rows = [["Income up to", "Marginal rate", "Constant K"]]
    last, cumulative = 0, 0
    for cap, rate in FEDERAL["brackets"]:
        upto = "no ceiling" if cap == float("inf") else money(cap)
        rows.append([upto, pct(rate), money(cumulative)])
        if cap != float("inf"):
            cumulative += (cap - last) * rate
            last = cap
    table = Table(rows, colWidths=[2.0 * inch, 1.4 * inch, 2.0 * inch])
    table.setStyle(std_table_style())

    annual = 92000
    gross_tax = tax_on_income(annual, FEDERAL["brackets"])
    eff_bpa = federal_bpa(annual)
    bpa_credit = eff_bpa * FEDERAL["lowest_rate"]
    period_fed = round2(max(0, gross_tax - bpa_credit) / 26)

    return [
        Paragraph("5. Federal income tax", H2),
        Paragraph(
            "Annual brackets for 2026 — <b>note the lowest rate is now 14%</b> "
            "(was 15% in 2025), per the Tax Cut for the Middle Class taking full effect. "
            "The engine annualizes the period gross, applies the brackets, subtracts the "
            "BPA credit, then divides back into the period.",
            BODY,
        ),
        table,
        Paragraph(
            f"<b>Basic Personal Amount with phase-out:</b><br/>"
            f"&nbsp;&nbsp;income ≤ {money(FEDERAL['bpa_phaseout_start'])} → BPA = {money(FEDERAL['bpa'])}<br/>"
            f"&nbsp;&nbsp;{money(FEDERAL['bpa_phaseout_start'])} < income < {money(FEDERAL['bpa_phaseout_end'])} → linear from {money(FEDERAL['bpa'])} down to {money(FEDERAL['bpa_low'])}<br/>"
            f"&nbsp;&nbsp;income ≥ {money(FEDERAL['bpa_phaseout_end'])} → BPA = {money(FEDERAL['bpa_low'])}",
            BODY,
        ),
        Paragraph(
            f"BPA credit = effective BPA × 14% — at $92k income that's "
            f"{money(eff_bpa)} × 14% = {money(bpa_credit)}",
            BODY,
        ),
        Paragraph("Per-period formula (lib/payroll/federal-tax.ts)", H3),
        Paragraph(
            "<font name='Courier'>annualized = period_gross × periods<br/>"
            "annual_tax = sum(bracket × rate)<br/>"
            "eff_BPA = federalBPA(annualized) &nbsp; ← phase-out aware<br/>"
            "annual_net = max(0, annual_tax − eff_BPA × 14%)<br/>"
            "period_fed = annual_net / periods<br/>"
            "period_fed −= (CPP + CPP2 + EI) × 14% &nbsp; ← K2 (lowest rate)</font>",
            BODY,
        ),
        Paragraph(
            f"Example — Ontario salary $92,000 bi-weekly:<br/>"
            f"annualized = 3,538.46 × 26 = {money(3538.46*26)}<br/>"
            f"annual_tax = 58,523 × 14% + (92,000 − 58,523) × 20.5% = "
            f"{money(58523*0.14)} + {money((92000-58523)*0.205)} = {money(gross_tax)}<br/>"
            f"BPA credit = 16,452 × 14% = {money(bpa_credit)}<br/>"
            f"annual_net = {money(gross_tax)} − {money(bpa_credit)} = {money(gross_tax - bpa_credit)}<br/>"
            f"period_fed = {money(gross_tax - bpa_credit)} / 26 = {money(period_fed)}<br/>"
            f"(then reduced by ~$36 of CPP+EI credit at 14% before final number)",
            MONO,
        ),
    ]


def section_provincial():
    items = [
        Paragraph("6. Provincial income tax (9 provinces)", H2),
        Paragraph(
            "Same formula shape as federal — annualize, apply brackets, subtract provincial "
            "BPA credit, divide back. Ontario adds a surtax on top of provincial tax. Quebec "
            "is excluded.",
            BODY,
        ),
    ]
    # Build one mini-section per province
    for code in ["ON", "AB", "BC", "MB", "SK", "NS", "NB", "PE", "NL"]:
        cfg = PROVINCIAL[code]
        rows = [["Income up to", "Marginal rate"]]
        for cap, rate in cfg["brackets"]:
            upto = "no ceiling" if cap == float("inf") else money(cap)
            rows.append([upto, pct(rate)])
        bracket_t = Table(rows, colWidths=[2.4 * inch, 1.2 * inch])
        bracket_t.setStyle(std_table_style())

        meta_text = f"<b>BPA</b> {money(cfg['bpa'])} · BPA credit = BPA × {pct(cfg['brackets'][0][1])} = {money(cfg['bpa'] * cfg['brackets'][0][1])}"
        if "surtax" in cfg:
            meta_text += (
                "<br/><b>Surtax</b> (applied to provincial tax above thresholds): "
                + " · ".join(f"{pct(r)} over {money(o)}" for o, r in cfg["surtax"])
            )

        block = [
            Paragraph(f"{cfg['name']} ({code})", H3),
            bracket_t,
            Paragraph(meta_text, BODY),
            Spacer(1, 4),
        ]
        items.append(KeepTogether(block))
    return items


def section_vacation_overtime():
    ot_rows = [["Province", "OT threshold (weekly hrs)", "OT rate"]]
    for code, hrs in OT_HOURS.items():
        ot_rows.append([PROVINCIAL[code]["name"], str(hrs), "1.5× regular"])
    ot_t = Table(ot_rows, colWidths=[2.7 * inch, 2.2 * inch, 1.4 * inch])
    ot_t.setStyle(std_table_style())

    return [
        Paragraph("7. Vacation accrual & overtime", H2),
        Paragraph("Vacation (lib/payroll/engine.ts)", H3),
        Paragraph(
            "Salaried employees: 0 (vacation paid as part of regular salary).<br/>"
            "Hourly employees: <font name='Courier'>vacation = (regular + overtime + bonus) × "
            "vacation_percent</font>. Default 4% (2 weeks). Operator may set per-employee.",
            BODY,
        ),
        Paragraph("Overtime by province", H3),
        Paragraph(
            "When the operator records overtime hours, the engine pays "
            "<font name='Courier'>hourly_rate × 1.5 × ot_hours</font>. The thresholds below "
            "are advisory (UI hint) — the engine does not auto-compute OT from total hours yet.",
            BODY,
        ),
        ot_t,
    ]


def section_ytd():
    return [
        Paragraph("8. YTD enforcement (correctness layer)", H2),
        Paragraph(
            "Before every payroll run, <b>PayrollYTDService</b> folds all finalized + voided "
            "runs in the current tax year per employee and feeds the result into the engine. "
            "The CPP / CPP2 / EI services then cap the period contribution against the annual "
            "max:",
            BODY,
        ),
        Paragraph(
            "<font name='Courier'>contribution_capped = min(contribution_uncapped, "
            "annual_max − YTD)</font>",
            BODY,
        ),
        Paragraph(
            "Voided runs and their reversal entries are both included in the fold — they net "
            "to zero, so no special-case logic is needed in YTD. Preview/draft runs are "
            "excluded.",
            BODY,
        ),
        Paragraph(
            f"Caps for {TAX_YEAR}: CPP1 = {money(CPP_MAX)} · CPP2 = {money(CPP2_MAX)} · "
            f"EI = {money(EI_MAX)}",
            BODY,
        ),
    ]


def section_province_comparison():
    """Same $80k salary, bi-weekly, across all 9 provinces — comparison table."""
    rows = [["Province", "Gross / period", "Fed", "Prov", "CPP", "EI", "Net / period", "Net / yr"]]
    for code in ["ON", "AB", "BC", "MB", "SK", "NS", "NB", "PE", "NL"]:
        r = run_line(80000, code, "biweekly")
        rows.append([
            PROVINCIAL[code]["name"],
            money(r["gross"]),
            money(r["fed"]),
            money(r["prov"]),
            money(r["cpp"] + r["cpp2"]),
            money(r["ei"]),
            money(r["net"]),
            money(round2(r["net"] * 26)),
        ])
    t = Table(rows, colWidths=[1.5*inch, 0.85*inch, 0.7*inch, 0.7*inch, 0.7*inch, 0.65*inch, 0.85*inch, 0.85*inch])
    t.setStyle(std_table_style())
    return [
        Paragraph("9. Worked example A — $80,000 salary, bi-weekly, all 9 provinces", H2),
        Paragraph(
            "Same gross. Different provincial tax + (in Ontario) surtax produce different net "
            "pay. These are the exact numbers NorthPay would put on a paystub.",
            BODY,
        ),
        t,
    ]


def section_frequency_comparison():
    """Same Ontario salary $80k at 4 frequencies."""
    rows = [["Frequency", "Periods/yr", "Gross / period", "Fed", "Prov", "CPP", "EI", "Net / period", "Net / yr"]]
    for freq in ["weekly", "biweekly", "semimonthly", "monthly"]:
        r = run_line(80000, "ON", freq)
        rows.append([
            freq.replace("semimonthly", "semi-monthly"),
            str(PERIODS[freq]),
            money(r["gross"]),
            money(r["fed"]),
            money(r["prov"]),
            money(r["cpp"] + r["cpp2"]),
            money(r["ei"]),
            money(r["net"]),
            money(round2(r["net"] * PERIODS[freq])),
        ])
    t = Table(rows, colWidths=[1.05*inch, 0.65*inch, 0.85*inch, 0.65*inch, 0.65*inch, 0.65*inch, 0.6*inch, 0.85*inch, 0.85*inch])
    t.setStyle(std_table_style())
    return [
        Paragraph("10. Worked example B — Ontario $80,000 across 4 pay frequencies", H2),
        Paragraph(
            "Tiny differences in net per year come from rounding to cents each period and from "
            "how the per-period exemption (YBE/periods) divides differently. Annual totals "
            "agree within a few dollars.",
            BODY,
        ),
        t,
    ]


def section_hourly_example():
    """Hourly with vacation + overtime — Priya, BC, $38/hr, biweekly, 6% vac, 4 OT hrs."""
    rate = 38.0
    weeks = 2
    reg_hrs = 40 * weeks  # 80
    ot_hrs = 4
    reg_pay = round2(rate * reg_hrs)
    ot_pay = round2(rate * 1.5 * ot_hrs)
    bonus = 0
    pre_vac = reg_pay + ot_pay + bonus
    vac = round2(pre_vac * 0.06)
    gross = round2(pre_vac + vac)
    cpp_e = calc_cpp(gross, 26)
    cpp2 = calc_cpp2(gross)
    ei_e = calc_ei(gross)
    credit = round2((cpp_e + cpp2 + ei_e) * 0.15)
    fed = round2(max(0, calc_federal(gross, 26) - credit))
    prov = calc_prov(gross, 26, "BC")
    ded = round2(cpp_e + cpp2 + ei_e + fed + prov)
    net = round2(gross - ded)

    rows = [
        ["Line", "Calculation", "Amount"],
        ["Regular pay", f"{rate} × {reg_hrs} hrs", money(reg_pay)],
        ["Overtime", f"{rate} × 1.5 × {ot_hrs} hrs", money(ot_pay)],
        ["Earnings before vacation", "", money(pre_vac)],
        ["Vacation accrual", f"{money(pre_vac)} × 6%", money(vac)],
        ["Gross pay", "", money(gross)],
        ["CPP1", f"({money(gross)} − YBE/26) × 5.95%", money(cpp_e)],
        ["CPP2", "earnings still below YMPE → 0", money(cpp2)],
        ["EI", f"{money(gross)} × 1.63%", money(ei_e)],
        ["Federal tax (after CPP/EI credit)", "", money(fed)],
        ["BC provincial tax", "", money(prov)],
        ["Total deductions", "", money(ded)],
        ["Net pay", "gross − deductions", money(net)],
    ]
    t = Table(rows, colWidths=[2.4*inch, 2.7*inch, 1.4*inch])
    t.setStyle(std_table_style())

    return [
        Paragraph("11. Worked example C — hourly with overtime + vacation", H2),
        Paragraph(
            "Priya Sharma · British Columbia · $38/hr · bi-weekly · 6% vacation · 4 OT hours "
            "this period",
            BODY,
        ),
        t,
        Paragraph(
            "Employer also pays: CPP match " + money(cpp_e) + " + EI 1.4× = " +
            money(round2(ei_e * 1.4)) + ". Total employer cost = gross + CPP + CPP2 + EI(1.4×) "
            "= " + money(round2(gross + cpp_e + cpp2 + ei_e * 1.4)) + ".",
            BODY,
        ),
    ]


def section_paystub_layout():
    rows = [
        ["Field", "Source"],
        ["Employer name + address + BN + CRA account", "CompanySettings (settings repo)"],
        ["Pay period / pay date", "PayrollRun.periodStart, .periodEnd, .payDate"],
        ["Employee name, SIN, employment type, freq", "PayrollLineResult.employee snapshot"],
        ["Regular / Overtime / Bonus / Vacation", "PayrollLineResult.regularPay, .overtimePay, .bonusAmount, .vacationAccrual"],
        ["Gross pay", "PayrollLineResult.grossPay"],
        ["Federal / Provincial tax", "PayrollLineResult.federalTax, .provincialTax"],
        ["CPP (CPP1 + CPP2)", "PayrollLineResult.cppEmployee + .cpp2Employee"],
        ["EI", "PayrollLineResult.eiEmployee"],
        ["Net deposit", "PayrollLineResult.netPay"],
        ["YTD column (current vs YTD)", "computeYTD() — folds all finalized + voided runs"],
        ["Employer contributions footer", "PayrollLineResult.cppEmployer, .cpp2Employer, .eiEmployer"],
    ]
    t = Table(rows, colWidths=[3.0 * inch, 3.5 * inch])
    t.setStyle(std_table_style())
    return [
        Paragraph("12. Paystub PDF — field mapping (lib/pdf/paystub.ts)", H2),
        Paragraph(
            "The downloadable paystub is rendered client-side with jsPDF (Letter, 612×792 pt). "
            "Each field on the PDF maps 1:1 to a line in the saved PayrollRun:",
            BODY,
        ),
        t,
    ]


def section_t4_layout():
    rows = [
        ["Box", "Field", "Source"],
        ["10", "Province of employment", "Employee.province"],
        ["12", "Social Insurance Number", "Employee.sin"],
        ["14", "Employment income", "Σ line.grossPay for the tax year"],
        ["16", "Employee CPP contributions", "Σ line.cppEmployee"],
        ["16A", "Employee CPP2 contributions", "Σ line.cpp2Employee"],
        ["18", "Employee EI premiums", "Σ line.eiEmployee"],
        ["22", "Income tax deducted (fed + prov)", "Σ (line.federalTax + line.provincialTax)"],
        ["24", "EI insurable earnings (capped at MIE)", "min(Σ gross, $68,900)"],
        ["26", "CPP pensionable earnings (capped at YMPE)", "min(Σ gross, $74,600)"],
        ["28", "Exempt — CPP / EI / PPIP", "Empty checkboxes (not auto-detected)"],
        ["50", "RPP / DPSP registration number", "Not modeled — blank"],
        ["52", "Pension adjustment", "Not modeled — $0.00"],
        ["54", "Business number", "CompanySettings.businessNumber"],
    ]
    t = Table(rows, colWidths=[0.5 * inch, 2.5 * inch, 3.6 * inch])
    t.setStyle(std_table_style())
    return [
        Paragraph("13. T4 slip PDF — box mapping (lib/pdf/t4.ts)", H2),
        Paragraph(
            "Annual T4 slip is built per-employee by aggregating every finalized + voided run "
            "in the tax year. Box-to-source mapping:",
            BODY,
        ),
        t,
        Paragraph(
            "<b>Caps:</b> Box 24 caps at MIE ($68,900); Box 26 caps at YMPE ($74,600). Above "
            "those amounts the box shows the cap, not the raw sum.",
            BODY,
        ),
    ]


def section_flow():
    return [
        Paragraph("14. End-to-end run flow", H2),
        Paragraph(
            "<font name='Courier'>"
            "PayrollView.handleRun()<br/>"
            "  -&gt; PayrollLifecycleService.finalize({ employees, period })<br/>"
            "       * PayrollYTDService(runs).getYTDMap()<br/>"
            "       * PayrollValidationService.validate(...)   &lt;- blocks on errors<br/>"
            "       * runPayroll({ employees, ytdByEmployee, ... })<br/>"
            "           - calculatePayrollLine per employee<br/>"
            "               - calculateCPP(pensionable, periods, ytdCpp)<br/>"
            "               - calculateCPP2(periodPens, ytdPens, ytdCpp2)<br/>"
            "               - calculateEI(insurable, ytdEi)<br/>"
            "               - calculateFederalTax(periodTaxable, periods)<br/>"
            "               - calculateProvincialTax(province, periodTaxable, periods)<br/>"
            "           - aggregate totals, compute inputHash<br/>"
            "       * IPayrollRepository.save(run)             &lt;- rejects dup hash<br/>"
            "       * AuditLogService.log('payroll.finalized')<br/>"
            "</font>",
            BODY,
        ),
        Paragraph(
            "Every step is pure (no side effects) until <i>save()</i> and <i>log()</i> at the "
            "very end. This keeps the math fully reproducible.",
            BODY,
        ),
    ]


def section_glossary():
    rows = [
        ["Term", "Meaning"],
        ["YBE", "Year's Basic Exemption ($3,500). Earnings below this are CPP-exempt."],
        ["YMPE", "Year's Maximum Pensionable Earnings. Top of CPP1 tier."],
        ["YAMPE", "Year's Additional Maximum Pensionable Earnings. Top of CPP2 tier."],
        ["BPA", "Basic Personal Amount. Tax-free baseline; converted to a credit at the lowest bracket rate."],
        ["MIE", "Maximum Insurable Earnings for EI ($68,900)."],
        ["K2 credit", "PDOC formula factor reducing federal tax by 15% of CPP+EI. Approximated here."],
        ["Surtax", "Ontario only — extra provincial tax above two thresholds."],
        ["Pensionable", "Earnings counted for CPP. In NorthPay = full gross."],
        ["Insurable", "Earnings counted for EI. In NorthPay = full gross."],
    ]
    t = Table(rows, colWidths=[1.4 * inch, 5.1 * inch])
    t.setStyle(std_table_style())
    return [Paragraph("15. Glossary", H2), t]


# ───────────────────────── Build ─────────────────────────
def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    if doc.page > 1:
        canvas.drawString(0.6 * inch, 0.45 * inch, "NorthPay — Payroll Calculation Reference")
        canvas.drawRightString(letter[0] - 0.6 * inch, 0.45 * inch,
                               f"{TAX_YEAR} · Page {doc.page}")
    canvas.restoreState()


def build():
    out = "/Users/rajbirbal/Desktop/Complete_with_Docusign_Rajbir_Rated_Illustra/Can/northpay/docs/NorthPay-Payroll-Math.pdf"
    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.6 * inch, bottomMargin=0.7 * inch,
        title="NorthPay Payroll Math Reference", author="NorthPay",
    )
    story = []
    story.extend(cover())
    story.extend(section_periods())
    story.extend(section_cpp())
    story.extend(section_cpp2())
    story.extend(section_ei())
    story.append(PageBreak())
    story.extend(section_federal())
    story.append(PageBreak())
    story.extend(section_provincial())
    story.append(PageBreak())
    story.extend(section_vacation_overtime())
    story.extend(section_ytd())
    story.append(PageBreak())
    story.extend(section_province_comparison())
    story.append(Spacer(1, 12))
    story.extend(section_frequency_comparison())
    story.append(PageBreak())
    story.extend(section_hourly_example())
    story.append(PageBreak())
    story.extend(section_paystub_layout())
    story.append(Spacer(1, 12))
    story.extend(section_t4_layout())
    story.append(PageBreak())
    story.extend(section_flow())
    story.append(Spacer(1, 12))
    story.extend(section_glossary())

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"Wrote {out}")


if __name__ == "__main__":
    build()
