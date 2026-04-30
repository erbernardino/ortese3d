import io
import urllib.request
from datetime import date as _date, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.graphics.shapes import Drawing, Line, Rect, Circle, String, Polygon
from reportlab.lib.enums import TA_LEFT


def _fetch_image(url, timeout=10):
    """Baixa uma imagem para BytesIO. Retorna None em falha (silencioso)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OrteseCAD-PDF"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return io.BytesIO(resp.read())
    except Exception:
        return None


PRIMARY = colors.HexColor("#2d3748")
ACCENT = colors.HexColor("#9f7aea")
SUCCESS = colors.HexColor("#38a169")
WARNING = colors.HexColor("#d69e2e")
DANGER = colors.HexColor("#c53030")


def _base_doc(buf, title="OrteseCAD"):
    return SimpleDocTemplate(
        buf, pagesize=A4, title=title,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
    )


def _styles():
    s = getSampleStyleSheet()
    s.add(ParagraphStyle("Brand", parent=s["Heading1"],
                         fontSize=18, textColor=ACCENT, spaceAfter=2))
    s.add(ParagraphStyle("DocTitle", parent=s["Heading2"],
                         fontSize=14, textColor=PRIMARY, spaceAfter=8))
    s.add(ParagraphStyle("Section", parent=s["Heading3"],
                         fontSize=12, textColor=PRIMARY,
                         spaceAfter=4, spaceBefore=10))
    s.add(ParagraphStyle("Small", parent=s["Normal"],
                         fontSize=9, textColor=colors.HexColor("#666"),
                         alignment=TA_LEFT))
    return s


def _header(today_str):
    return [
        Paragraph("OrteseCAD", _styles()["Brand"]),
        Paragraph(f"Allogic · Relatório gerado em {today_str}",
                  _styles()["Small"]),
        Spacer(1, 4 * mm),
    ]


def _calc_age_label(birth):
    if not birth:
        return "—"
    try:
        bd = datetime.fromisoformat(str(birth).replace("Z", "")).date()
        today = _date.today()
        months = (today.year - bd.year) * 12 + (today.month - bd.month)
        if today.day < bd.day:
            months -= 1
        if months < 24:
            return f"{months} meses"
        return f"{months // 12} anos e {months % 12} meses"
    except Exception:
        return str(birth)


def _patient_card(patient):
    rows = [
        ["Paciente", patient.get("name", "—")],
        ["Nascimento / Idade", f"{patient.get('birthDate', '—')}  ·  {_calc_age_label(patient.get('birthDate'))}"],
        ["Responsável", patient.get("guardian", "—")],
        ["Diagnóstico", patient.get("diagnosis", "—")],
    ]
    t = Table(rows, colWidths=[42 * mm, 130 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf2f7")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def _measurements_table(measurements):
    rows = [
        ["Medida", "Valor"],
        ["Circunferência Occipital", f"{measurements.get('circOccipital', '—')} mm"],
        ["Circunferência Frontal", f"{measurements.get('circFrontal', '—')} mm"],
        ["Diagonal A (maior)", f"{measurements.get('diagA', '—')} mm"],
        ["Diagonal B (menor)", f"{measurements.get('diagB', '—')} mm"],
        ["CVAI", f"{measurements.get('cvai', '—')} %"],
        ["Altura Craniana", f"{measurements.get('height', '—')} mm"],
    ]
    t = Table(rows, colWidths=[90 * mm, 60 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _cvai_chart(evaluations, width=170 * mm, height=60 * mm):
    """
    Gráfico de evolução do CVAI usando ReportLab Drawing.
    `evaluations` é uma lista de dicts: {date, measurements: {cvai}}.
    """
    pts = []
    for e in evaluations or []:
        meas = e.get("measurements") or {}
        cvai = meas.get("cvai")
        if cvai is None or e.get("date") is None:
            continue
        try:
            t = datetime.fromisoformat(str(e["date"])).timestamp()
            pts.append((t, float(cvai), e["date"]))
        except Exception:
            continue

    d = Drawing(width, height)

    if len(pts) < 2:
        d.add(String(width / 2, height / 2,
                     "Dados insuficientes para gráfico (≥ 2 avaliações)",
                     fontSize=9, fillColor=colors.HexColor("#999"),
                     textAnchor="middle"))
        return d

    pts.sort(key=lambda p: p[0])
    margin_l = 28
    margin_r = 12
    margin_t = 14
    margin_b = 22

    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x_min, x_max = min(xs), max(xs)
    y_min = 0
    y_max = max(8.75, max(ys) * 1.15)

    # ReportLab Drawing usa coords matemáticas: y aumenta para cima.
    plot_w = width - margin_l - margin_r
    plot_h = height - margin_t - margin_b
    plot_top = margin_b + plot_h          # topo do plot (CVAI máximo)
    plot_bottom = margin_b                # fundo do plot (CVAI = 0)

    def x_to_px(x):
        if x_max == x_min:
            return margin_l
        return margin_l + (x - x_min) / (x_max - x_min) * plot_w

    def y_to_px(y):
        return plot_bottom + (y - y_min) / (y_max - y_min) * plot_h

    # bandas de severidade (verde no fundo = CVAI baixo, vermelho no topo)
    bands = [
        (0, 3.5, colors.HexColor("#c6f6d5")),
        (3.5, 6.5, colors.HexColor("#fefcbf")),
        (6.5, max(8.75, y_max), colors.HexColor("#fed7d7")),
    ]
    for lo, hi, color in bands:
        if lo >= y_max:
            continue
        hi_clamped = min(hi, y_max)
        d.add(Rect(margin_l, y_to_px(lo),
                   plot_w, y_to_px(hi_clamped) - y_to_px(lo),
                   fillColor=color, strokeColor=None))

    # eixos
    d.add(Line(margin_l, plot_bottom, margin_l + plot_w, plot_bottom,
               strokeColor=colors.HexColor("#a0aec0")))
    d.add(Line(margin_l, plot_bottom, margin_l, plot_top,
               strokeColor=colors.HexColor("#a0aec0")))

    # labels eixo Y
    for y_val in [0, 3.5, 6.5]:
        if y_val < y_max:
            d.add(String(margin_l - 4, y_to_px(y_val) - 3,
                         f"{y_val:g}", fontSize=7,
                         fillColor=colors.HexColor("#666"),
                         textAnchor="end"))

    # linha + pontos
    poly = []
    for x, y, _label in pts:
        poly.extend([x_to_px(x), y_to_px(y)])
    d.add(Polygon(poly, strokeColor=colors.HexColor("#3182ce"),
                  strokeWidth=1.5, fillColor=None))

    for x, y, label in pts:
        cx, cy = x_to_px(x), y_to_px(y)
        d.add(Circle(cx, cy, 2.5, fillColor=colors.HexColor("#3182ce"),
                     strokeColor=colors.white, strokeWidth=0.5))
        d.add(String(cx, cy + 5, f"{y:.1f}%", fontSize=7,
                     fillColor=PRIMARY, textAnchor="middle"))
        # labels de data abaixo do eixo X
        d.add(String(cx, plot_bottom - 10, str(label)[5:],
                     fontSize=7, fillColor=colors.HexColor("#666"),
                     textAnchor="middle"))

    return d


def _evaluations_table(evaluations):
    if not evaluations:
        return Paragraph("Nenhuma avaliação registrada.", _styles()["Normal"])
    baseline_cvai = None
    rows = [["Data", "Diag A", "Diag B", "CVAI", "Δ CVAI", "Observações"]]
    for i, e in enumerate(evaluations):
        m = e.get("measurements") or {}
        cvai = m.get("cvai")
        if i == 0:
            baseline_cvai = cvai
        delta = ""
        if cvai is not None and baseline_cvai is not None:
            delta = f"{cvai - baseline_cvai:+.2f}"
        rows.append([
            e.get("date", "—"),
            str(m.get("diagA", "—")),
            str(m.get("diagB", "—")),
            f"{cvai}%" if cvai is not None else "—",
            delta,
            (e.get("notes") or "")[:60],
        ])
    t = Table(rows, colWidths=[24*mm, 18*mm, 18*mm, 22*mm, 18*mm, 70*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _photos_block(evaluations, max_photos=4):
    """
    Embed das fotos da última avaliação que tem fotos. Limite total
    para não inflar o PDF. Tolerante: ignora fotos que não baixarem.
    """
    s = _styles()
    last_with_photos = None
    for e in reversed(evaluations or []):
        if e.get("photos"):
            last_with_photos = e
            break
    if not last_with_photos:
        return None

    photos = last_with_photos["photos"][:max_photos]
    cells = []
    for p in photos:
        url = p.get("url") if isinstance(p, dict) else None
        if not url:
            continue
        buf = _fetch_image(url)
        if not buf:
            continue
        try:
            img = Image(buf, width=40 * mm, height=40 * mm, kind="proportional")
            cells.append(img)
        except Exception:
            continue

    if not cells:
        return None

    out = [
        Paragraph(f"Fotografias · {last_with_photos.get('date', '')}", s["Section"]),
    ]
    # Layout em grid 2x2 ou linha única
    if len(cells) <= 2:
        rows = [cells]
    else:
        rows = [cells[:2], cells[2:]]
    t = Table(rows, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    out.append(t)
    return out


def _ai_zones_block(suggestion):
    if not suggestion:
        return None
    s = _styles()
    out = [
        Paragraph("Análise de Assimetria · Sugestão IA", s["Section"]),
        Paragraph(suggestion.get("summary", ""), s["Normal"]),
        Paragraph(
            f"Confiança: {int(round(suggestion.get('confidence', 0) * 100))}% · "
            f"Método: {suggestion.get('method', 'heuristic')}",
            s["Small"],
        ),
        Spacer(1, 3 * mm),
    ]
    rows = [["Tipo", "Localização", "Raio", "Intensidade", "Justificativa"]]
    for z in suggestion.get("zones", []):
        rows.append([
            (z.get("type", "")).capitalize(),
            z.get("label", ""),
            f"{z.get('radius_mm', '')} mm",
            f"{int(round(z.get('intensity', 0) * 100))}%",
            (z.get("rationale") or "")[:60],
        ])
    t = Table(rows, colWidths=[20*mm, 50*mm, 16*mm, 22*mm, 64*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    out.append(t)
    return out


def generate_clinical_pdf(patient, measurements, model_meta,
                          evaluations=None, suggestion=None) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf, "OrteseCAD — Relatório Clínico")
    s = _styles()
    today = _date.today().isoformat()

    body = _header(today)
    body.append(Paragraph("Relatório Clínico", s["DocTitle"]))
    body.append(_patient_card(patient))

    body.append(Paragraph("Medidas Cranianas Iniciais", s["Section"]))
    body.append(_measurements_table(measurements))

    if evaluations and len(evaluations) >= 1:
        body.append(Paragraph("Evolução do CVAI", s["Section"]))
        body.append(_cvai_chart(evaluations))
        body.append(Spacer(1, 2 * mm))
        body.append(_evaluations_table(evaluations))

        photo_block = _photos_block(evaluations)
        if photo_block:
            body.extend(photo_block)

    ai = _ai_zones_block(suggestion)
    if ai:
        body.extend(ai)

    body.append(Paragraph("Modelo Gerado", s["Section"]))
    info = [
        ["Volume estimado",
         f"{model_meta.get('volume_cm3', '—')} cm³"],
        ["Peso estimado (PLA 1.24 g/cm³)",
         f"{model_meta.get('weight_g', '—')} g"],
    ]
    if model_meta.get("min_thickness_mm") is not None:
        info.append(["Espessura mínima medida",
                     f"{model_meta.get('min_thickness_mm')} mm"])
    t = Table(info, colWidths=[90 * mm, 60 * mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf2f7")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
    ]))
    body.append(t)

    body.append(Spacer(1, 8 * mm))
    body.append(Paragraph(
        "Este relatório foi gerado pelo OrteseCAD e deve ser interpretado "
        "em conjunto com avaliação clínica presencial. As sugestões de IA "
        "são heurísticas baseadas em parâmetros antropométricos e não "
        "substituem julgamento clínico especializado.",
        s["Small"],
    ))

    doc.build(body)
    return buf.getvalue()


def generate_technical_pdf(patient, measurements, model_meta,
                           evaluations=None, suggestion=None) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf, "OrteseCAD — Especificações Técnicas")
    s = _styles()
    today = _date.today().isoformat()

    body = _header(today)
    body.append(Paragraph("Especificações Técnicas de Fabricação", s["DocTitle"]))
    body.append(Paragraph(f"<b>Paciente:</b> {patient.get('name', '—')}",
                          s["Normal"]))

    body.append(Paragraph("Parâmetros do Modelo", s["Section"]))
    rows = [
        ["Parâmetro", "Valor"],
        ["Vértices", str(model_meta.get("vertex_count", "—"))],
        ["Faces", str(model_meta.get("face_count", "—"))],
        ["Volume", f"{model_meta.get('volume_cm3', '—')} cm³"],
        ["Peso (PLA 1.24 g/cm³)", f"{model_meta.get('weight_g', '—')} g"],
    ]
    if model_meta.get("min_thickness_mm") is not None:
        rows.append(["Espessura mínima medida (p5)",
                     f"{model_meta['min_thickness_mm']} mm"])
    t = Table(rows, colWidths=[90 * mm, 60 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f7fafc")]),
    ]))
    body.append(t)

    body.append(Paragraph("Recomendações de Fabricação", s["Section"]))
    body.append(Paragraph(
        "<b>Material:</b> PLA ou PETG médico, espessura de parede mínima 2 mm.",
        s["Normal"]))
    body.append(Paragraph(
        "<b>Layer height:</b> 0.2 mm com bocal 0.4 mm.",
        s["Normal"]))
    body.append(Paragraph(
        "<b>Infill:</b> 20% padrão gyroid para rigidez e leveza.",
        s["Normal"]))
    body.append(Paragraph(
        "<b>Pós-processamento:</b> lixar internamente regiões de contato; "
        "forrar com EVA 2 mm; verificar bordas vivas próximas à abertura "
        "frontal.",
        s["Normal"]))

    body.append(Paragraph("Acabamento Clínico", s["Section"]))
    body.append(Paragraph(
        "Após a impressão, o capacete passa por validação dimensional, "
        "lixamento, prova clínica no paciente e ajustes finais antes "
        "do uso continuado.",
        s["Normal"]))

    doc.build(body)
    return buf.getvalue()
