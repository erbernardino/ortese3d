from fastapi import APIRouter, HTTPException
from fastapi import UploadFile, File
from pydantic import BaseModel
from python.services.model_generator import generate_from_measurements
from python.services.scan_processor import process_scan
import trimesh
import base64
import io
import tempfile
import os

router = APIRouter(prefix="/model", tags=["model"])


class MeasurementsInput(BaseModel):
    circ_occipital: float
    circ_frontal: float
    diag_a: float
    diag_b: float
    cvai: float
    height: float
    offset_mm: float = 4.0
    wall_mm: float = 3.0


@router.post("/generate")
def generate_model(data: MeasurementsInput):
    try:
        mesh = generate_from_measurements(data.model_dump())
        buf = io.BytesIO()
        mesh.export(buf, file_type="stl")
        stl_b64 = base64.b64encode(buf.getvalue()).decode()
        return {
            "stl_b64": stl_b64,
            "vertex_count": len(mesh.vertices),
            "face_count": len(mesh.faces),
            "is_watertight": mesh.is_watertight,
            "volume_cm3": round(abs(mesh.volume) / 1000, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-scan")
async def import_scan(file: UploadFile = File(...)):
    suffix = "." + file.filename.split(".")[-1].lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        mesh = process_scan(tmp_path)
        buf = io.BytesIO()
        mesh.export(buf, file_type="stl")
        stl_b64 = base64.b64encode(buf.getvalue()).decode()
        return {
            "stl_b64": stl_b64,
            "vertex_count": len(mesh.vertices),
            "face_count": len(mesh.faces),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.post("/validate")
def validate_model(data: dict):
    return {"message": "not implemented"}
