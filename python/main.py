from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from python.routers import model, export

app = FastAPI(title="OrteseCAD API")

# CORS allow-all: intentional for localhost-only communication with Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(model.router)
app.include_router(export.router)

@app.get("/status")
def status():
    return {"status": "ok"}
