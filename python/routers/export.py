from fastapi import APIRouter

router = APIRouter(prefix="/export", tags=["export"])

@router.post("/stl")
def export_stl(data: dict):
    return {"message": "not implemented"}

@router.post("/gcode")
def export_gcode(data: dict):
    return {"message": "not implemented"}

@router.post("/pdf")
def export_pdf(data: dict):
    return {"message": "not implemented"}
