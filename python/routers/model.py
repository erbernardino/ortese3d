from fastapi import APIRouter, HTTPException
from fastapi import UploadFile, File
from pydantic import BaseModel
from python.services.model_generator import (
    generate_from_measurements, generate_from_scan, split_into_two_parts,
)
from python.services.scan_processor import process_scan
from python.services.zone_suggester import suggest_zones
import numpy as np
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
    condition_type: str | None = None      # 'plagiocephaly' | 'brachycephaly'


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


@router.post("/generate-from-scan")
def generate_from_scan_endpoint(data: dict):
    """
    Recebe stl_b64 (scan 3D já limpo) + parâmetros de capacete e
    devolve um STL do capacete construído sobre a superfície do scan.
    """
    stl_b64 = data.get("stl_b64")
    if not stl_b64:
        raise HTTPException(status_code=400, detail="stl_b64 é obrigatório")
    try:
        raw = base64.b64decode(stl_b64)
        scan = trimesh.load(io.BytesIO(raw), file_type="stl")
        helmet = generate_from_scan(
            scan,
            offset_mm=float(data.get("offset_mm", 4.0)),
            wall_mm=float(data.get("wall_mm", 3.0)),
            vent_holes=int(data.get("vent_holes", 12)),
            vent_radius_mm=float(data.get("vent_radius_mm", 4.0)),
            frontal_opening=bool(data.get("frontal_opening", True)),
        )
        buf = io.BytesIO()
        helmet.export(buf, file_type="stl")
        return {
            "stl_b64": base64.b64encode(buf.getvalue()).decode(),
            "vertex_count": len(helmet.vertices),
            "face_count": len(helmet.faces),
            "is_watertight": helmet.is_watertight,
            "volume_cm3": round(abs(helmet.volume) / 1000, 2),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/split-helmet")
def split_helmet_endpoint(data: dict):
    """
    Recebe stl_b64 do capacete inteiro e devolve duas peças (frontal
    e traseira) já com conectores macho/fêmea. Resposta:
      { front_stl_b64, back_stl_b64, pins: [{y, z}], stats: {...} }
    """
    stl_b64 = data.get("stl_b64")
    if not stl_b64:
        raise HTTPException(status_code=400, detail="stl_b64 é obrigatório")
    try:
        raw = base64.b64decode(stl_b64)
        helmet = trimesh.load(io.BytesIO(raw), file_type="stl")
        bounds = helmet.bounding_box.extents
        outer_dims = np.array(bounds) / 2

        result = split_into_two_parts(
            helmet, outer_dims,
            pin_count=int(data.get("pin_count", 4)),
            pin_radius=float(data.get("pin_radius_mm", 2.5)),
            lug_extension=float(data.get("lug_extension_mm", 12.0)),
            lug_thickness=float(data.get("lug_thickness_mm", 8.0)),
            lug_width=float(data.get("lug_width_mm", 16.0)),
        )

        def to_b64(mesh):
            buf = io.BytesIO()
            mesh.export(buf, file_type="stl")
            return base64.b64encode(buf.getvalue()).decode()

        return {
            "front_stl_b64": to_b64(result["front"]),
            "back_stl_b64": to_b64(result["back"]),
            "pins": [{"y": float(y), "z": float(z)} for (y, z) in result["pins"]],
            "stats": {
                "front_volume_cm3": round(abs(result["front"].volume) / 1000, 2),
                "back_volume_cm3": round(abs(result["back"].volume) / 1000, 2),
                "front_face_count": len(result["front"].faces),
                "back_face_count": len(result["back"].faces),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-zones")
def suggest_zones_endpoint(data: dict):
    """
    Recebe medidas e diagnóstico, devolve sugestão heurística de zonas
    de pressão/alívio + análise textual.
    """
    measurements = data.get("measurements") or {}
    diagnosis = data.get("diagnosis", "") or ""
    try:
        return suggest_zones(measurements, diagnosis)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
def validate_model(data: dict):
    stl_b64 = data.get("stl_b64")
    if not stl_b64:
        raise HTTPException(status_code=400, detail="stl_b64 é obrigatório")
    try:
        raw = base64.b64decode(stl_b64)
        mesh = trimesh.load(io.BytesIO(raw), file_type="stl")
        from python.services.validator import validate_mesh
        return validate_mesh(
            mesh,
            min_thickness_mm=data.get("min_thickness_mm", 2.0),
            min_clearance_mm=data.get("min_clearance_mm", 3.0),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
