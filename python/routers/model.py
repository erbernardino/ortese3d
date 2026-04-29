from fastapi import APIRouter

router = APIRouter(prefix="/model", tags=["model"])

@router.post("/generate")
def generate_model(data: dict):
    return {"message": "not implemented"}

@router.post("/validate")
def validate_model(data: dict):
    return {"message": "not implemented"}
