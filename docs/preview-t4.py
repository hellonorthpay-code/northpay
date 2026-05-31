"""Visual preview that mirrors lib/pdf/t4.ts exactly."""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = letter
PAGE_MARGIN = 14
SLIP_GAP = 12
SLIP_W = PAGE_W - PAGE_MARGIN * 2
SLIP_H = (PAGE_H - PAGE_MARGIN * 2 - SLIP_GAP) / 2

LEFT_STRIP = 14
INNER_X_OFFSET = LEFT_STRIP + 2
INNER_W = SLIP_W - INNER_X_OFFSET - 4

HEADER_H = 48
OTHER_H = 54
MID_H = SLIP_H - HEADER_H - OTHER_H - 6

LEFT_COL_W = 286
COL_GAP = 6
RIGHT_COL_W = INNER_W - LEFT_COL_W - COL_GAP

SUB_GAP = 6
SUB_COL_W = (RIGHT_COL_W - SUB_GAP) / 2

MINI_ROW_H = 26
AMOUNT_ROWS = 8
AMOUNT_ROW_H = (MID_H - MINI_ROW_H - 6) / AMOUNT_ROWS


def yflip(y, h=0):
    return PAGE_H - y - h


def money(n):
    return f"{n:,.2f}"


SAMPLE = {
    "year": 2026,
    "employer": {"name": "Northwind Coffee Roasters Inc.", "accountNumber": "123456789 RP0001"},
    "employee": {
        "sin": "*** *** 482", "lastName": "BELL", "firstName": "Jordan",
        "initial": "", "province": "ON", "addressLines": [],
    },
    "box14": 92000.00, "box16": 4230.45, "box16A": 0.00, "box17": 0, "box17A": 0,
    "box18": 1123.07, "box20": 0, "box22": 17856.43, "box24": 68900.00, "box26": 74600.00,
    "box29": "", "box44": 0, "box45": "", "box46": 0, "box50": "", "box52": 0,
    "box55": 0, "box56": 0,
    "exemptCPP": False, "exemptEI": False, "exemptPPIP": False,
    # Phase 2 example — what it looks like when we populate extras:
    "otherInformation": [
        # {"code": 40, "amount": 1500.00},
        # {"code": 85, "amount": 600.00},
    ],
}

OTHER_INFO_REGISTRY = {
    30: "Board and lodging", 31: "Special work site", 32: "Travel zone",
    33: "Medical travel", 34: "Personal use of vehicle", 36: "Low-int loans",
    40: "Other taxable allowances and benefits", 42: "Employment commissions",
    66: "Eligible retiring allowances", 67: "Non-eligible retiring allowances",
    85: "Employee-paid health premiums", 87: "Emergency services volunteer",
}


def draw_amount_box(c, x, y, w, h, num, label_en, label_fr, value,
                    blank_if_zero=False, text_override=None):
    c.setFont("Helvetica", 6)
    c.drawCentredString(x + w / 2, yflip(y + 6), label_en)
    c.drawCentredString(x + w / 2, yflip(y + 13), label_fr)
    box_y = y + 16
    box_h = h - 16
    num_w = 18
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 2, yflip(box_y + box_h / 2 + 3), num)
    c.setLineWidth(0.5)
    c.rect(x + num_w, yflip(box_y, box_h), w - num_w, box_h)
    show = not (blank_if_zero and value == 0 and not text_override)
    if show:
        c.setFont("Helvetica", 9.5)
        display = text_override if text_override else money(value)
        c.drawRightString(x + w - 4, yflip(box_y + box_h / 2 + 3.2), display)


def draw_text_box(c, x, y, w, h, num, label_en, label_fr, value):
    c.setFont("Helvetica", 6)
    c.drawCentredString(x + w / 2, yflip(y + 6), label_en)
    c.drawCentredString(x + w / 2, yflip(y + 13), label_fr)
    box_y = y + 16
    box_h = h - 16
    num_w = 18
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 2, yflip(box_y + box_h / 2 + 3), num)
    c.setLineWidth(0.5)
    c.rect(x + num_w, yflip(box_y, box_h), w - num_w, box_h)
    if value:
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(x + num_w + (w - num_w) / 2, yflip(box_y + box_h / 2 + 3.2), value)


def draw_left_box(c, x, y, w, h, num, label_en, value, label_fr=None):
    c.setFont("Helvetica", 6.5)
    c.drawString(x + 22, yflip(y + 7), label_en)
    if label_fr:
        c.drawString(x + 22, yflip(y + 14), label_fr)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 2, yflip(y + h / 2 + 4), num)
    box_y = y + 17 if label_fr else y + 11
    box_h = h - (box_y - y) - 2
    c.setLineWidth(0.5)
    c.rect(x + 22, yflip(box_y, box_h), w - 22, box_h)
    if value:
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(x + 22 + (w - 22) / 2, yflip(box_y + box_h / 2 + 4), value)


def draw_exempt_box(c, x, y, w, h, d):
    c.setFont("Helvetica", 6.5)
    c.drawString(x + 22, yflip(y + 7), "Exempt – Exemption")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 2, yflip(y + h / 2 + 4), "28")
    items = [("CPP/QPP", "RPC/RRQ", d["exemptCPP"]),
             ("EI", "AE", d["exemptEI"]),
             ("PPIP", "RPAP", d["exemptPPIP"])]
    cb_size = 9
    cb_y = y + 18
    start_x = x + 22
    step_x = (w - 22) / 3
    for i, (en, fr, checked) in enumerate(items):
        cx = start_x + i * step_x + (step_x - cb_size) / 2
        c.setFont("Helvetica", 6)
        c.drawCentredString(cx + cb_size / 2, yflip(cb_y - 4), en)
        c.setLineWidth(0.5)
        c.rect(cx, yflip(cb_y - 2, cb_size), cb_size, cb_size)
        if checked:
            c.setLineWidth(0.8)
            c.line(cx + 1, yflip(cb_y - 1), cx + cb_size - 1, yflip(cb_y + cb_size - 3))
            c.line(cx + cb_size - 1, yflip(cb_y - 1), cx + 1, yflip(cb_y + cb_size - 3))
        c.drawCentredString(cx + cb_size / 2, yflip(cb_y + cb_size + 6), fr)


def draw_cra_header(c, x, y, w, h, year):
    c.setLineWidth(0.4)
    c.rect(x + 4, yflip(y + 3, 13), 18, 13)
    c.setFillColorRGB(204/255, 33/255, 47/255)
    p = c.beginPath()
    p.moveTo(x + 13, yflip(y + 5))
    p.lineTo(x + 8, yflip(y + 14))
    p.lineTo(x + 18, yflip(y + 14))
    p.close()
    c.drawPath(p, fill=1)
    c.setFillColorRGB(0, 0, 0)

    c.setFont("Helvetica", 6.5)
    c.drawString(x + 25, yflip(y + 8), "Canada Revenue")
    c.drawString(x + 25, yflip(y + 15), "Agency")
    c.drawString(x + 88, yflip(y + 8), "Agence du revenu")
    c.drawString(x + 88, yflip(y + 15), "du Canada")

    c.setFont("Helvetica", 6.5)
    c.drawString(x + 4, yflip(y + 28), "Year")
    c.drawString(x + 4, yflip(y + 35), "Année")
    c.setLineWidth(0.6)
    c.rect(x + 25, yflip(y + 24, 14), 44, 14)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(x + 47, yflip(y + 35), str(year))

    c.setFont("Helvetica-Bold", 18)
    c.drawRightString(x + w - 4, yflip(y + 18), "T4")
    c.setFont("Helvetica", 8.5)
    c.drawRightString(x + w - 4, yflip(y + 30), "Statement of Remuneration Paid")
    c.setFont("Helvetica", 7.5)
    c.drawRightString(x + w - 4, yflip(y + 39), "État de la rémunération payée")


def draw_employer_name_box(c, x, y, w, h, name):
    c.setLineWidth(0.6)
    c.rect(x, yflip(y, h), w, h)
    c.setFont("Helvetica", 6.5)
    c.drawString(x + 4, yflip(y + 7), "Employer's name – Nom de l'employeur")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 6, yflip(y + 24), name)


def draw_employee_address(c, x, y, w, h, emp):
    c.setFont("Helvetica", 6.5)
    c.drawString(x, yflip(y + 6), "Employee's name and address – Nom et adresse de l'employé")
    body_y = y + 9
    body_h = h - 9
    c.setLineWidth(0.6)
    c.rect(x, yflip(body_y, body_h), w, body_h)
    c.setFont("Helvetica", 5)
    c.drawString(x + 4, yflip(body_y + 5), "Last name (in capital letters)")
    c.drawString(x + 4, yflip(body_y + 11), "Nom de famille (en lettres moulées)")
    c.drawString(x + w * 0.58, yflip(body_y + 5), "First name")
    c.drawString(x + w * 0.58, yflip(body_y + 11), "Prénom")
    c.drawString(x + w * 0.85, yflip(body_y + 5), "Initial")
    c.drawString(x + w * 0.85, yflip(body_y + 11), "Initiale")
    name_row_y = body_y + 14
    name_row_h = 18
    c.setLineWidth(0.4)
    c.rect(x + 4, yflip(name_row_y, name_row_h), w - 8, name_row_h)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 8, yflip(name_row_y + 13), emp["lastName"])
    c.drawString(x + w * 0.58 + 4, yflip(name_row_y + 13), emp["firstName"])


def draw_left_column(c, x, y, w, h, d):
    acct_h = 26
    draw_left_box(c, x, y, w, acct_h, "54",
                  "Employer's account number / Numéro de compte de l'employeur",
                  d["employer"]["accountNumber"])
    row_y = y + acct_h + 4
    row_h = 38
    sin_w = w * 0.42
    exempt_w = w * 0.42
    emp_code_w = w - sin_w - exempt_w - 8
    draw_left_box(c, x, row_y, sin_w, row_h, "12",
                  "Social insurance number", d["employee"]["sin"],
                  label_fr="Numéro d'assurance sociale")
    draw_exempt_box(c, x + sin_w + 4, row_y, exempt_w, row_h, d)
    draw_left_box(c, x + sin_w + exempt_w + 8, row_y, emp_code_w, row_h, "29",
                  "Employment code", d["box29"], label_fr="Code d'emploi")
    emp_y = row_y + row_h + 4
    emp_h = h - acct_h - row_h - 12
    draw_employee_address(c, x, emp_y, w, emp_h, d["employee"])


def draw_right_column(c, x, y, w, h, d):
    draw_text_box(c, x, y, SUB_COL_W, MINI_ROW_H, "45",
                  "Employer-offered dental benefits",
                  "Prestations dentaires offertes par l'employeur", d["box45"])
    draw_text_box(c, x + SUB_COL_W + SUB_GAP, y, SUB_COL_W, MINI_ROW_H, "10",
                  "Province of employment", "Province d'emploi",
                  d["employee"]["province"])

    grid_y = y + MINI_ROW_H + 4
    rows = [
        (("14", "Employment income", "Revenus d'emploi", d["box14"], False, None),
         ("22", "Income tax deducted", "Impôt sur le revenu retenu", d["box22"], False, None)),
        (("16", "Employee's CPP contributions – see over", "Cotisations de l'employé au RPC – voir au verso", d["box16"], False, None),
         ("17", "Employee's QPP contributions – see over", "Cotisations de l'employé au RRQ – voir au verso", d["box17"], True, None)),
        (("16A", "Employee's second CPP contributions", "Deuxièmes cotisations de l'employé au RPC", d["box16A"], False, None),
         ("17A", "Employee's second QPP contributions", "Deuxièmes cotisations de l'employé au RRQ", d["box17A"], True, None)),
        (("24", "EI insurable earnings", "Gains assurables d'AE", d["box24"], False, None),
         ("26", "CPP/QPP pensionable earnings", "Gains ouvrant droit à pension – RPC/RRQ", d["box26"], False, None)),
        (("18", "Employee's EI premiums", "Cotisations de l'employé à l'AE", d["box18"], False, None),
         ("44", "Union dues", "Cotisations syndicales", d["box44"], True, None)),
        (("20", "RPP contributions", "Cotisations à un RPA", d["box20"], True, None),
         ("46", "Charitable donations", "Dons de bienfaisance", d["box46"], True, None)),
        (("52", "Pension adjustment", "Facteur d'équivalence", d["box52"], True, None),
         ("50", "RPP or DPSP registration number", "N° d'agrément d'un RPA ou d'un RPDB", 0, True, d["box50"] or None)),
        (("55", "Employee's PPIP premiums – see over", "Cotisations de l'employé au RPAP – voir au verso", d["box55"], True, None),
         ("56", "PPIP insurable earnings", "Gains assurables du RPAP", d["box56"], True, None)),
    ]
    for i, (left, right) in enumerate(rows):
        r_y = grid_y + i * AMOUNT_ROW_H
        n, le, lf, v, bz, t = left
        draw_amount_box(c, x, r_y, SUB_COL_W, AMOUNT_ROW_H - 2, n, le, lf, v,
                        blank_if_zero=bz, text_override=t)
        n, le, lf, v, bz, t = right
        draw_amount_box(c, x + SUB_COL_W + SUB_GAP, r_y, SUB_COL_W, AMOUNT_ROW_H - 2,
                        n, le, lf, v, blank_if_zero=bz, text_override=t)


def draw_other_information(c, x, y, w, entries):
    c.setFont("Helvetica", 7)
    c.drawString(x, yflip(y + 8), "Other information")
    c.drawString(x, yflip(y + 16), "(see over)")
    c.setFont("Helvetica", 6.5)
    c.drawString(x, yflip(y + 30), "Autres renseignements")
    c.drawString(x, yflip(y + 38), "(voir au verso)")

    cells_x = x + 90
    cell_w = (w - 90) / 3
    cell_row_h = 24
    for i in range(6):
        row = i // 3
        col = i % 3
        cx = cells_x + col * cell_w + 2
        cy = y + row * cell_row_h + 2
        c.setFont("Helvetica", 6)
        c.drawString(cx, yflip(cy + 6), "Box – Case")
        c.drawString(cx + 36, yflip(cy + 6), "Amount – Montant")
        c.setLineWidth(0.5)
        c.rect(cx, yflip(cy + 8, 13), 32, 13)
        c.rect(cx + 36, yflip(cy + 8, 13), cell_w - 44, 13)
        if i < len(entries):
            entry = entries[i]
            c.setFont("Helvetica-Bold", 9)
            c.drawCentredString(cx + 16, yflip(cy + 17), str(entry["code"]))
            c.setFont("Helvetica", 9)
            c.drawRightString(cx + 36 + (cell_w - 44) - 4, yflip(cy + 17), money(entry["amount"]))
            label = OTHER_INFO_REGISTRY.get(entry["code"], "")
            if label:
                c.setFont("Helvetica", 5)
                c.drawString(cx, yflip(cy + 23), label[:40])


def draw_slip(c, sx, sy, d):
    c.setLineWidth(1.4)
    c.rect(sx, yflip(sy, SLIP_H), SLIP_W, SLIP_H)

    c.saveState()
    c.translate(sx + 9, yflip(sy + SLIP_H - 14))
    c.rotate(90)
    c.setFont("Helvetica", 7)
    c.drawString(0, 0, "Protected B when completed / Protégé B une fois rempli")
    c.restoreState()
    c.saveState()
    c.translate(sx + 9, yflip(sy + SLIP_H - 14 - 230))
    c.rotate(90)
    c.setFont("Helvetica", 6.5)
    c.drawString(0, 0, "T4 (24)")
    c.restoreState()

    inner_x = sx + INNER_X_OFFSET
    inner_y = sy + 4
    employer_w = INNER_W * 0.58
    cra_x = inner_x + employer_w + 4
    cra_w = INNER_W - employer_w - 4

    draw_employer_name_box(c, inner_x, inner_y, employer_w, HEADER_H, d["employer"]["name"])
    draw_cra_header(c, cra_x, inner_y, cra_w, HEADER_H, d["year"])

    mid_y = inner_y + HEADER_H + 4
    draw_left_column(c, inner_x, mid_y, LEFT_COL_W, MID_H, d)
    draw_right_column(c, inner_x + LEFT_COL_W + COL_GAP, mid_y, RIGHT_COL_W, MID_H, d)
    draw_other_information(c, inner_x, mid_y + MID_H + 4, INNER_W, d["otherInformation"])


def main():
    out = "/Users/rajbirbal/Desktop/Complete_with_Docusign_Rajbir_Rated_Illustra/Can/northpay/docs/t4-preview.pdf"
    c = canvas.Canvas(out, pagesize=letter)

    # First page — empty (what most employees get)
    draw_slip(c, PAGE_MARGIN, PAGE_MARGIN, SAMPLE)
    draw_slip(c, PAGE_MARGIN, PAGE_MARGIN + SLIP_H + SLIP_GAP, SAMPLE)
    c.setDash(3, 3)
    c.setLineWidth(0.5)
    sep_y = yflip(PAGE_MARGIN + SLIP_H + SLIP_GAP / 2)
    c.line(PAGE_MARGIN, sep_y, PAGE_W - PAGE_MARGIN, sep_y)

    # Second page demos how Phase 2 features show up via otherInformation[]
    c.showPage()
    sample_phase2 = dict(SAMPLE)
    sample_phase2["otherInformation"] = [
        {"code": 40, "amount": 1500.00},
        {"code": 85, "amount": 600.00},
        {"code": 66, "amount": 10000.00},
    ]
    draw_slip(c, PAGE_MARGIN, PAGE_MARGIN, sample_phase2)
    draw_slip(c, PAGE_MARGIN, PAGE_MARGIN + SLIP_H + SLIP_GAP, sample_phase2)
    c.setDash(3, 3)
    c.setLineWidth(0.5)
    c.line(PAGE_MARGIN, sep_y, PAGE_W - PAGE_MARGIN, sep_y)

    c.save()
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
