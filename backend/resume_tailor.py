"""
resume_tailor.py
─────────────────
Uses the Anthropic API to tailor a candidate's base resume to a specific
job description, then renders it as a clean PDF using ReportLab.

Flow:
  1. parse_base_resume()   → extract text from the user's uploaded PDF/DOCX
  2. tailor_with_ai()      → call Claude to produce a structured JSON resume
  3. render_to_pdf()       → turn that JSON into a styled PDF
  4. tailor_resume()       → orchestrates all three, returns path to temp PDF
"""

import os
import json
import uuid
import asyncio
import tempfile
from pathlib import Path
from typing import Optional

import anthropic

# Optional imports — gracefully degrade if not installed
try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

try:
    import docx
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


TAILORED_DIR = Path("data/tailored_resumes")
TAILORED_DIR.mkdir(parents=True, exist_ok=True)

# ─── Step 1: Parse base resume text ──────────────────────────────────────────

def parse_base_resume(resume_path: str) -> str:
    """Extract raw text from PDF or DOCX resume."""
    path = Path(resume_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        if not HAS_PDFPLUMBER:
            raise RuntimeError("pdfplumber not installed. Run: pip install pdfplumber")
        import pdfplumber
        text_parts = []
        with pdfplumber.open(resume_path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text_parts.append(t)
        return "\n".join(text_parts)

    elif ext in (".docx", ".doc"):
        if not HAS_DOCX:
            raise RuntimeError("python-docx not installed. Run: pip install python-docx")
        import docx as docx_lib
        doc = docx_lib.Document(resume_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    else:
        raise ValueError(f"Unsupported resume format: {ext}")


# ─── Step 2: AI tailoring via Claude ─────────────────────────────────────────

TAILOR_SYSTEM_PROMPT = """You are an expert resume writer and ATS optimization specialist.
Your job is to tailor a candidate's resume specifically for a given job description.

Rules:
- Preserve ALL factual information (companies, dates, degrees, actual achievements)
- Never fabricate experience, skills, or credentials the candidate doesn't have
- Reorder and reword existing content to highlight the most relevant experience first
- Mirror keywords and phrases from the job description naturally
- Strengthen the professional summary to directly address the role
- Reorder skills to put the most JD-relevant ones first
- Keep bullet points concise and impact-focused (use numbers/metrics where present)
- Output ONLY valid JSON, no markdown, no preamble

Output this exact JSON structure:
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "location": "...",
  "linkedin": "...",
  "portfolio": "...",
  "summary": "2-3 sentence tailored professional summary",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Jan 2022 – Present",
      "bullets": ["Achievement 1", "Achievement 2", ...]
    }
  ],
  "education": [
    {
      "degree": "B.Tech Computer Science",
      "institution": "University Name",
      "year": "2020"
    }
  ],
  "certifications": ["Cert 1", "Cert 2"],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief tailored description"
    }
  ]
}
"""

async def tailor_with_ai(
    base_resume_text: str,
    job_description: str,
    profile: dict,
    api_key: str,
) -> dict:
    """Call Claude to produce a tailored resume as structured JSON."""

    client = anthropic.Anthropic(api_key=api_key)

    user_message = f"""Here is the candidate's current resume:

<resume>
{base_resume_text}
</resume>

Here is the job description they are applying for:

<job_description>
{job_description}
</job_description>

Candidate profile extras (use if not in resume):
- Skills: {', '.join(profile.get('skills', []))}
- Years of experience: {profile.get('experience_years', 0)}
- Summary hint: {profile.get('summary', '')}

Please produce a tailored resume JSON optimised for this specific role."""

    # Run sync Anthropic client in thread pool to keep async flow
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=TAILOR_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    )

    raw = response.content[0].text.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip().rstrip("```").strip()

    return json.loads(raw)


# ─── Step 3: Render tailored resume to PDF ────────────────────────────────────

def render_to_pdf(resume_data: dict, output_path: str) -> str:
    """Render the tailored resume JSON to a clean, ATS-friendly PDF."""
    if not HAS_REPORTLAB:
        raise RuntimeError("reportlab not installed. Run: pip install reportlab")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    # ── Styles ────────────────────────────────────────────────────────────────
    DARK   = colors.HexColor("#1a1a2e")
    ACCENT = colors.HexColor("#4f46e5")
    MID    = colors.HexColor("#374151")
    LIGHT  = colors.HexColor("#6b7280")

    styles = getSampleStyleSheet()

    name_style = ParagraphStyle(
        "Name", fontSize=22, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=2, alignment=TA_CENTER,
    )
    contact_style = ParagraphStyle(
        "Contact", fontSize=9, fontName="Helvetica",
        textColor=LIGHT, spaceAfter=10, alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "Section", fontSize=11, fontName="Helvetica-Bold",
        textColor=ACCENT, spaceBefore=10, spaceAfter=3,
    )
    body_style = ParagraphStyle(
        "Body", fontSize=9.5, fontName="Helvetica",
        textColor=MID, spaceAfter=3, leading=14,
    )
    job_title_style = ParagraphStyle(
        "JobTitle", fontSize=10, fontName="Helvetica-Bold",
        textColor=DARK, spaceAfter=1,
    )
    company_style = ParagraphStyle(
        "Company", fontSize=9, fontName="Helvetica",
        textColor=LIGHT, spaceAfter=3,
    )
    bullet_style = ParagraphStyle(
        "Bullet", fontSize=9.5, fontName="Helvetica",
        textColor=MID, leftIndent=12, spaceAfter=2, leading=13,
    )
    skills_style = ParagraphStyle(
        "Skills", fontSize=9.5, fontName="Helvetica",
        textColor=MID, spaceAfter=4, leading=14,
    )

    def hr():
        return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb"), spaceAfter=4, spaceBefore=2)

    def section(title):
        return [Paragraph(title.upper(), section_style), hr()]

    # ── Build story ───────────────────────────────────────────────────────────
    story = []

    # Header
    story.append(Paragraph(resume_data.get("name", ""), name_style))

    contact_parts = [
        resume_data.get("email", ""),
        resume_data.get("phone", ""),
        resume_data.get("location", ""),
        resume_data.get("linkedin", ""),
        resume_data.get("portfolio", ""),
    ]
    contact_line = "  ·  ".join(p for p in contact_parts if p)
    story.append(Paragraph(contact_line, contact_style))

    # Summary
    if resume_data.get("summary"):
        story.extend(section("Professional Summary"))
        story.append(Paragraph(resume_data["summary"], body_style))

    # Skills
    if resume_data.get("skills"):
        story.extend(section("Skills"))
        skills_text = "  ·  ".join(resume_data["skills"])
        story.append(Paragraph(skills_text, skills_style))

    # Experience
    if resume_data.get("experience"):
        story.extend(section("Experience"))
        for exp in resume_data["experience"]:
            story.append(Paragraph(exp.get("title", ""), job_title_style))
            story.append(Paragraph(
                f"{exp.get('company', '')}  |  {exp.get('duration', '')}",
                company_style
            ))
            for bullet in exp.get("bullets", []):
                story.append(Paragraph(f"• {bullet}", bullet_style))
            story.append(Spacer(1, 4))

    # Education
    if resume_data.get("education"):
        story.extend(section("Education"))
        for edu in resume_data["education"]:
            story.append(Paragraph(edu.get("degree", ""), job_title_style))
            story.append(Paragraph(
                f"{edu.get('institution', '')}  |  {edu.get('year', '')}",
                company_style
            ))

    # Projects
    if resume_data.get("projects"):
        story.extend(section("Projects"))
        for proj in resume_data["projects"]:
            story.append(Paragraph(proj.get("name", ""), job_title_style))
            story.append(Paragraph(proj.get("description", ""), bullet_style))
            story.append(Spacer(1, 3))

    # Certifications
    if resume_data.get("certifications"):
        story.extend(section("Certifications"))
        for cert in resume_data["certifications"]:
            story.append(Paragraph(f"• {cert}", bullet_style))

    doc.build(story)
    return output_path


# ─── Orchestrator ─────────────────────────────────────────────────────────────

async def tailor_resume(
    base_resume_path: str,
    job_description: str,
    profile: dict,
    api_key: str,
) -> str:
    """
    Full pipeline: parse → tailor with AI → render PDF.
    Returns the path to the tailored PDF (temp file).
    """
    # 1. Extract text from the user's resume
    base_text = parse_base_resume(base_resume_path)

    # 2. Ask Claude to tailor it
    tailored_data = await tailor_with_ai(base_text, job_description, profile, api_key)

    # 3. Render to PDF
    out_path = str(TAILORED_DIR / f"tailored_{uuid.uuid4().hex[:8]}.pdf")
    render_to_pdf(tailored_data, out_path)

    return out_path, tailored_data


def cleanup_tailored_resume(path: str):
    """Delete a temp tailored PDF after use."""
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
