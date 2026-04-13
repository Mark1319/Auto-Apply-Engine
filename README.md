# Auto-Apply-Engine
# 🤖 Auto Job Apply

A full-stack web dashboard to automatically apply to jobs on **LinkedIn**, **Indeed**, **Naukri**, and **Internshala** using browser automation.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Auto-apply** | Playwright-powered browser automation for 4 platforms |
| **Profile management** | Store your info used to auto-fill application forms |
| **Resume management** | Upload multiple resumes, set a default for auto-apply |
| **Job filters** | Keywords, locations, job types, salary range, experience level |
| **Application tracker** | Track all applied jobs with status (Applied → Interview → Offered) |
| **Dashboard** | Charts showing applications by platform and status |
| **Session control** | Start, monitor, and stop automation sessions in real time |

---

## 🗂 Project structure

```
auto-job-apply/
├── backend/
│   ├── main.py          # FastAPI REST API
│   ├── automation.py    # Playwright automation (LinkedIn, Indeed, Naukri, Internshala)
│   ├── requirements.txt
│   └── data/            # Local JSON DB + uploaded resumes (auto-created)
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Sidebar layout + routing
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx     # Stats + charts
│   │   │   ├── ProfilePage.jsx   # Edit your profile
│   │   │   ├── ResumesPage.jsx   # Upload & manage resumes
│   │   │   ├── FiltersPage.jsx   # Job search filters
│   │   │   ├── ApplicationsPage.jsx  # Track all applications
│   │   │   └── AutoApplyPage.jsx     # Launch automation
│   │   ├── components/
│   │   │   └── TagsInput.jsx     # Multi-tag input
│   │   ├── context/
│   │   │   └── ToastContext.jsx  # Toast notifications
│   │   └── utils/
│   │       └── api.js            # API client
│   └── package.json
├── setup.sh   # One-time install
└── start.sh   # Launch both servers
```

---

## ⚡ Quick start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### 1. Install dependencies (once)

```bash
chmod +x setup.sh start.sh
./setup.sh
```

This will:
- Create a Python virtual environment
- Install FastAPI, Playwright, and other backend packages
- Download Chromium for Playwright
- Install React + Vite frontend packages

### 2. Start the app

```bash
./start.sh
```

Opens:
- **Dashboard** → http://localhost:5173
- **API docs** → http://localhost:8000/docs

---

## 🚀 Usage

### Step 1 — Complete your profile
Go to **Profile** and fill in your name, email, phone, location, LinkedIn, skills, and summary. This is used to auto-fill forms.

### Step 2 — Upload your resume
Go to **Resumes** and upload your PDF/Word resume. Mark one as default.

### Step 3 — Set job filters
Go to **Job filters** and configure:
- Keywords (e.g. `React Developer`, `Python Engineer`)
- Locations (e.g. `Hyderabad`, `Remote`)
- Platforms, job types, salary range

### Step 4 — Run auto-apply
Go to **Auto apply**, choose platforms and max jobs per platform, then click **Start auto-apply**.

A browser window will open. Log in to each platform when prompted (first time only — cookies are saved). The bot will then search and apply automatically.

### Step 5 — Track applications
All applications land in the **Applications** tab. You can update statuses as you hear back (Applied → Interview → Offered / Rejected).

---

## 🔧 How the automation works

| Platform | Method |
|---|---|
| **LinkedIn** | Searches jobs with Easy Apply filter → clicks Easy Apply → auto-fills multi-step forms |
| **Indeed** | Searches jobs → clicks "Indeed Apply" button → handles apply flow |
| **Naukri** | Searches by keyword/location → clicks Apply on each listing |
| **Internshala** | Searches jobs → clicks Apply → fills cover letter using your summary |

All platforms use **human-like delays** and a **non-headless browser** to avoid bot detection.

---

## 🛡 Important notes

- **You must be logged in** to each platform (the bot will pause for manual login the first time)
- This tool applies to jobs that have **one-click or easy apply** available
- Use responsibly — excessive automated applications may trigger rate limits on platforms
- Your data is stored **locally** in `backend/data/` — nothing is sent to any cloud service

---

## 🔌 API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/profile` | Get or save profile |
| GET/POST | `/api/resumes` | List or upload resumes |
| DELETE | `/api/resumes/{id}` | Delete a resume |
| PATCH | `/api/resumes/{id}/set-default` | Set default resume |
| GET/POST | `/api/filters` | Get or save job filters |
| GET | `/api/applications` | List applications (filterable) |
| PATCH | `/api/applications/{id}` | Update application status |
| DELETE | `/api/applications/{id}` | Delete application |
| GET | `/api/applications/stats` | Get stats for dashboard |
| POST | `/api/auto-apply/start` | Start an automation session |
| GET | `/api/auto-apply/status/{id}` | Poll session progress |
| POST | `/api/auto-apply/stop/{id}` | Stop a running session |

Full interactive docs at http://localhost:8000/docs

---

## 🛠 Extending

To add a new job platform:

1. Add a new `apply_<platform>` async method to `backend/automation.py`
2. Register it in the `apply_jobs` dispatcher dict
3. Add the platform option to `frontend/src/pages/AutoApplyPage.jsx` and `FiltersPage.jsx`

---

## 📄 License

MIT — use freely, contribute back!
