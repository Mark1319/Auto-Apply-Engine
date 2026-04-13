import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from automation import JobAutomator
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import uuid
import shutil
from datetime import datetime
from pathlib import Path


app = FastAPI(title="Auto Job Apply API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
RESUME_DIR = DATA_DIR / "resumes"
RESUME_DIR.mkdir(exist_ok=True)

DB_FILE = DATA_DIR / "db.json"

def load_db():
    if not DB_FILE.exists():
        return {"applications": [], "profile": {}, "filters": {}, "resumes": []}
    return json.loads(DB_FILE.read_text())

def save_db(data):
    DB_FILE.write_text(json.dumps(data, indent=2))

# ─── Models ───────────────────────────────────────────────────────────────────

class Profile(BaseModel):
    full_name: str
    email: str
    phone: str
    location: str
    linkedin: Optional[str] = ""
    portfolio: Optional[str] = ""
    summary: Optional[str] = ""
    skills: Optional[List[str]] = []
    experience_years: Optional[int] = 0

class JobFilter(BaseModel):
    keywords: List[str]
    locations: List[str]
    job_types: List[str]  # full-time, part-time, contract, internship
    platforms: List[str]  # linkedin, indeed, naukri, internshala
    min_salary: Optional[int] = None
    max_salary: Optional[int] = None
    experience_level: Optional[str] = ""

class ApplicationUpdate(BaseModel):
    status: str  # applied, interview, rejected, offered, withdrawn

class AutoApplyRequest(BaseModel):
    platforms: List[str]
    max_jobs: Optional[int] = 10
    filter_id: Optional[str] = None
    tailor_enabled: Optional[bool] = False
    anthropic_api_key: Optional[str] = ""

class ApiKeyConfig(BaseModel):
    anthropic_api_key: str

# ─── Profile ──────────────────────────────────────────────────────────────────

@app.get("/api/profile")
def get_profile():
    db = load_db()
    return db.get("profile", {})

@app.post("/api/profile")
def save_profile(profile: Profile):
    db = load_db()
    db["profile"] = profile.model_dump()
    save_db(db)
    return {"success": True, "message": "Profile saved"}

# ─── Resumes ──────────────────────────────────────────────────────────────────

@app.get("/api/resumes")
def list_resumes():
    db = load_db()
    return db.get("resumes", [])

@app.post("/api/resumes/upload")
async def upload_resume(file: UploadFile = File(...)):
    if not file.filename.endswith((".pdf", ".docx", ".doc")):
        raise HTTPException(400, "Only PDF and Word documents are supported")
    
    resume_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    save_path = RESUME_DIR / f"{resume_id}{ext}"
    
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    db = load_db()
    resume_entry = {
        "id": resume_id,
        "filename": file.filename,
        "path": str(save_path),
        "uploaded_at": datetime.now().isoformat(),
        "is_default": len(db.get("resumes", [])) == 0
    }
    db.setdefault("resumes", []).append(resume_entry)
    save_db(db)
    return resume_entry

@app.delete("/api/resumes/{resume_id}")
def delete_resume(resume_id: str):
    db = load_db()
    resumes = db.get("resumes", [])
    resume = next((r for r in resumes if r["id"] == resume_id), None)
    if not resume:
        raise HTTPException(404, "Resume not found")
    
    try:
        os.remove(resume["path"])
    except FileNotFoundError:
        pass
    
    db["resumes"] = [r for r in resumes if r["id"] != resume_id]
    save_db(db)
    return {"success": True}

@app.patch("/api/resumes/{resume_id}/set-default")
def set_default_resume(resume_id: str):
    db = load_db()
    for r in db.get("resumes", []):
        r["is_default"] = r["id"] == resume_id
    save_db(db)
    return {"success": True}

# ─── Filters ──────────────────────────────────────────────────────────────────

@app.get("/api/filters")
def get_filters():
    db = load_db()
    return db.get("filters", {})

@app.post("/api/filters")
def save_filters(filters: JobFilter):
    db = load_db()
    db["filters"] = filters.model_dump()
    save_db(db)
    return {"success": True, "message": "Filters saved"}

# ─── Applications ─────────────────────────────────────────────────────────────

@app.get("/api/applications")
def get_applications(status: Optional[str] = None, platform: Optional[str] = None):
    db = load_db()
    apps = db.get("applications", [])
    if status:
        apps = [a for a in apps if a.get("status") == status]
    if platform:
        apps = [a for a in apps if a.get("platform") == platform]
    return sorted(apps, key=lambda x: x.get("applied_at", ""), reverse=True)

@app.patch("/api/applications/{app_id}")
def update_application(app_id: str, update: ApplicationUpdate):
    db = load_db()
    for app in db.get("applications", []):
        if app["id"] == app_id:
            app["status"] = update.status
            app["updated_at"] = datetime.now().isoformat()
            save_db(db)
            return {"success": True}
    raise HTTPException(404, "Application not found")

@app.delete("/api/applications/{app_id}")
def delete_application(app_id: str):
    db = load_db()
    db["applications"] = [a for a in db.get("applications", []) if a["id"] != app_id]
    save_db(db)
    return {"success": True}

@app.get("/api/applications/stats")
def get_stats():
    db = load_db()
    apps = db.get("applications", [])
    stats = {
        "total": len(apps),
        "applied": len([a for a in apps if a.get("status") == "applied"]),
        "interview": len([a for a in apps if a.get("status") == "interview"]),
        "offered": len([a for a in apps if a.get("status") == "offered"]),
        "rejected": len([a for a in apps if a.get("status") == "rejected"]),
        "by_platform": {}
    }
    for app in apps:
        p = app.get("platform", "unknown")
        stats["by_platform"][p] = stats["by_platform"].get(p, 0) + 1
    return stats


# ─── API Key Config ───────────────────────────────────────────────────────────

@app.get("/api/config")
def get_config():
    db = load_db()
    cfg = db.get("config", {})
    # Mask the key for security
    key = cfg.get("anthropic_api_key", "")
    return {"anthropic_api_key": "sk-ant-..." + key[-6:] if key else ""}

@app.post("/api/config")
def save_config(config: ApiKeyConfig):
    db = load_db()
    db["config"] = {"anthropic_api_key": config.anthropic_api_key}
    save_db(db)
    return {"success": True, "message": "API key saved"}

# ─── Auto Apply ───────────────────────────────────────────────────────────────

active_sessions = {}

@app.post("/api/auto-apply/start")
async def start_auto_apply(request: AutoApplyRequest, background_tasks: BackgroundTasks):
    db = load_db()
    profile = db.get("profile")
    if not profile:
        raise HTTPException(400, "Please complete your profile first")
    
    filters = db.get("filters")
    if not filters:
        raise HTTPException(400, "Please set job filters first")
    
    resumes = db.get("resumes", [])
    default_resume = next((r for r in resumes if r.get("is_default")), None)
    if not resumes:
        raise HTTPException(400, "Please upload at least one resume")
    
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = {"status": "running", "progress": [], "started_at": datetime.now().isoformat()}
    
    # Resolve API key: request body takes priority, else use saved config
    cfg = db.get("config", {})
    api_key = request.anthropic_api_key or cfg.get("anthropic_api_key", "") or os.getenv("ANTHROPIC_API_KEY", "")

    # background_tasks.add_task(
    # await run_auto_apply(
    #     run_auto_apply,
    #     session_id=session_id,
    #     profile=profile,
    #     filters=filters,
    #     resume_path=default_resume["path"] if default_resume else resumes[0]["path"],
    #     platforms=request.platforms,
    #     max_jobs=request.max_jobs,
    #     tailor_enabled=request.tailor_enabled,
    #     anthropic_api_key=api_key,
    # )
    await run_auto_apply(
        session_id=session_id,
        profile=profile,
        filters=filters,
        resume_path=default_resume["path"] if default_resume else resumes[0]["path"],
        platforms=request.platforms,
        max_jobs=request.max_jobs,
        tailor_enabled=request.tailor_enabled,
        anthropic_api_key=api_key,
    )
    return {"session_id": session_id, "message": "Auto-apply started"}

async def run_auto_apply(session_id, profile, filters, resume_path, platforms, max_jobs, tailor_enabled=False, anthropic_api_key=""):
    db = load_db()
    automator = JobAutomator(
        profile, filters, resume_path,
        tailor_enabled=tailor_enabled,
        anthropic_api_key=anthropic_api_key,
    )
    
    try:
        for platform in platforms:
            jobs = await automator.apply_jobs(platform, max_jobs=max_jobs)
            for job in jobs:
                job["id"] = str(uuid.uuid4())
                job["applied_at"] = datetime.now().isoformat()
                job["status"] = "applied"
                db.setdefault("applications", []).append(job)
                save_db(db)
                tailored_badge = " ✨ tailored" if job.get("tailored") else ""
                active_sessions[session_id]["progress"].append(
                    f"Applied to {job['title']} at {job['company']}{tailored_badge}"
                )
        
        active_sessions[session_id]["status"] = "completed"
    except Exception as e:
        active_sessions[session_id]["status"] = "error"
        active_sessions[session_id]["error"] = str(e)

@app.get("/api/auto-apply/status/{session_id}")
def get_session_status(session_id: str):
    if session_id not in active_sessions:
        raise HTTPException(404, "Session not found")
    return active_sessions[session_id]

@app.post("/api/auto-apply/stop/{session_id}")
def stop_session(session_id: str):
    if session_id in active_sessions:
        active_sessions[session_id]["status"] = "stopped"
    return {"success": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
