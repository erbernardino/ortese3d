from python.services.pdf_generator import generate_clinical_pdf, generate_technical_pdf

PATIENT = {
    "name": "João Pedro S.",
    "birthDate": "2025-08-01",
    "guardian": "Maria S.",
    "diagnosis": "Plagiocefalia posicional",
}
MEASUREMENTS = {
    "circOccipital": 380,
    "circFrontal": 370,
    "diagA": 135,
    "diagB": 118,
    "cvai": 8.4,
    "height": 72,
}
MODEL_META = {"volume_cm3": 142.0, "weight_g": 176.0, "vertex_count": 1200}


def test_clinical_pdf_returns_bytes():
    pdf = generate_clinical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert isinstance(pdf, bytes)


def test_clinical_pdf_is_valid_pdf():
    pdf = generate_clinical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert pdf[:4] == b"%PDF"


def test_technical_pdf_returns_bytes():
    pdf = generate_technical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert isinstance(pdf, bytes)


def test_technical_pdf_is_valid_pdf():
    pdf = generate_technical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert pdf[:4] == b"%PDF"


def test_pdfs_have_content():
    clinical = generate_clinical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    technical = generate_technical_pdf(PATIENT, MEASUREMENTS, MODEL_META)
    assert len(clinical) > 1000
    assert len(technical) > 1000
