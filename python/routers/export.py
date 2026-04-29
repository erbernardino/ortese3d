from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from python.services.exporter import export_stl, export_gcode
from python.services.pdf_generator import generate_clinical_pdf, generate_technical_pdf
import trimesh
import base64
import io

router = APIRouter(prefix="/export", tags=["export"])


def _mesh_from_b64(stl_b64: str) -> trimesh.Trimesh:
    raw = base64.b64decode(stl_b64)
    return trimesh.load(io.BytesIO(raw), file_type="stl")


@router.post("/stl")
def export_stl_endpoint(data: dict):
    if "stl_b64" not in data:
        raise HTTPException(status_code=400, detail="stl_b64 é obrigatório")
    try:
        mesh = _mesh_from_b64(data["stl_b64"])
        stl_bytes = export_stl(mesh)
        return Response(
            content=stl_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=ortese.stl"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/gcode")
def export_gcode_endpoint(data: dict):
    if "stl_b64" not in data:
        raise HTTPException(status_code=400, detail="stl_b64 é obrigatório")
    try:
        mesh = _mesh_from_b64(data["stl_b64"])
        gcode = export_gcode(
            mesh,
            layer_height_mm=data.get("layer_height_mm", 0.2),
            feedrate=int(data.get("feedrate", 1500)),
        )
        return Response(
            content=gcode,
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=ortese.gcode"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pdf")
def export_pdf_endpoint(data: dict):
    pdf_type = data.get("type", "clinical")
    patient = data.get("patient", {})
    measurements = data.get("measurements", {})
    model_meta = data.get("model_meta", {})

    try:
        if pdf_type == "technical":
            pdf_bytes = generate_technical_pdf(patient, measurements, model_meta)
        else:
            pdf_bytes = generate_clinical_pdf(patient, measurements, model_meta)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=ortese_{pdf_type}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
