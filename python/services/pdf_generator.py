import io
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm


def _base_doc(buf):
    return SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )


def generate_clinical_pdf(patient: dict, measurements: dict, model_meta: dict) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Heading1"], fontSize=16, spaceAfter=6
    )
    body = [
        Paragraph("OrteseCAD — Relatório Clínico", title_style),
        Spacer(1, 4 * mm),
        Paragraph(f"<b>Paciente:</b> {patient.get('name', '—')}", styles["Normal"]),
        Paragraph(f"<b>Nascimento:</b> {patient.get('birthDate', '—')}", styles["Normal"]),
        Paragraph(f"<b>Responsável:</b> {patient.get('guardian', '—')}", styles["Normal"]),
        Paragraph(f"<b>Diagnóstico:</b> {patient.get('diagnosis', '—')}", styles["Normal"]),
        Spacer(1, 6 * mm),
        Paragraph("Medidas Cranianas", styles["Heading2"]),
    ]

    meas_data = [
        ["Medida", "Valor"],
        ["Circ. Occipital", f"{measurements.get('circOccipital', '—')} mm"],
        ["Circ. Frontal", f"{measurements.get('circFrontal', '—')} mm"],
        ["Diagonal A (maior)", f"{measurements.get('diagA', '—')} mm"],
        ["Diagonal B (menor)", f"{measurements.get('diagB', '—')} mm"],
        ["CVAI", f"{measurements.get('cvai', '—')} %"],
        ["Altura Craniana", f"{measurements.get('height', '—')} mm"],
    ]
    t = Table(meas_data, colWidths=[80 * mm, 60 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d3748")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f7fafc")],
                ),
            ]
        )
    )
    body.append(t)
    body.append(Spacer(1, 6 * mm))
    body.append(Paragraph("Dados do Modelo", styles["Heading2"]))
    body.append(
        Paragraph(
            f"Volume estimado: {model_meta.get('volume_cm3', '—')} cm³", styles["Normal"]
        )
    )
    body.append(
        Paragraph(
            f"Peso estimado: {model_meta.get('weight_g', '—')} g", styles["Normal"]
        )
    )

    doc.build(body)
    return buf.getvalue()


def generate_technical_pdf(patient: dict, measurements: dict, model_meta: dict) -> bytes:
    buf = io.BytesIO()
    doc = _base_doc(buf)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Heading1"], fontSize=14, spaceAfter=6
    )
    body = [
        Paragraph("OrteseCAD — Especificações Técnicas de Fabricação", title_style),
        Spacer(1, 4 * mm),
        Paragraph(f"Paciente: {patient.get('name', '—')}", styles["Normal"]),
        Spacer(1, 4 * mm),
        Paragraph("Parâmetros de Fabricação", styles["Heading2"]),
        Paragraph(
            f"Vértices da malha: {model_meta.get('vertex_count', '—')}", styles["Normal"]
        ),
        Paragraph(
            f"Volume: {model_meta.get('volume_cm3', '—')} cm³", styles["Normal"]
        ),
        Paragraph(
            f"Peso estimado (PLA): {model_meta.get('weight_g', '—')} g", styles["Normal"]
        ),
        Spacer(1, 4 * mm),
        Paragraph("Recomendações de Impressão 3D", styles["Heading2"]),
        Paragraph(
            "Material: PLA / PETG — espessura de parede mínima 2mm.", styles["Normal"]
        ),
        Paragraph("Layer height recomendado: 0.2mm.", styles["Normal"]),
        Paragraph("Infill: 20% gyroid.", styles["Normal"]),
    ]

    doc.build(body)
    return buf.getvalue()
