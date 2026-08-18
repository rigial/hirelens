# HireLens — Product Requirements Document

**Version:** 1.0  
**Status:** Ready for Development  
**Package Manager:** pnpm

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Core Principles](#4-core-principles)
5. [Tech Stack](#5-tech-stack)
6. [Project Structure](#6-project-structure)
7. [Application Screens & User Flows](#7-application-screens--user-flows)
8. [Functional Requirements](#8-functional-requirements)
9. [Database Schema](#9-database-schema)
10. [Tauri IPC Command Reference](#10-tauri-ipc-command-reference)
11. [TypeScript Types](#11-typescript-types)
12. [Resume Processing Pipeline](#12-resume-processing-pipeline)
13. [Scoring & Ranking Algorithm](#13-scoring--ranking-algorithm)
14. [LLM Prompt Templates](#14-llm-prompt-templates)
15. [Background Worker System](#15-background-worker-system)
16. [Frontend Architecture](#16-frontend-architecture)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Implementation Phases](#18-implementation-phases)
19. [Known Challenges & Mitigations](#19-known-challenges--mitigations)
20. [Out of Scope (v1)](#20-out-of-scope-v1)

---

## 1. Product Overview

**HireLens** is a privacy-first, AI-powered desktop application that automates candidate screening for HR teams. It runs entirely on the user's machine — no resume or candidate data ever leaves the device.

HR professionals can create job openings, define required skills, upload multiple resumes, and receive AI-assisted rankings and qualitative analysis — all powered by a locally running LLM.

> **One-line pitch:** HireLens is a privacy-first local AI hiring assistant that helps HR teams analyze, compare, rank, and shortlist candidates faster.

---

## 2. Problem Statement

Manually reviewing large volumes of resumes is:

- **Time-consuming** — HR teams spend hours reading resumes before they can shortlist.
- **Inconsistent** — Different reviewers apply different standards.
- **Error-prone** — Qualified candidates are missed due to reviewer fatigue.
- **Privacy-risky** — Most SaaS solutions send resumes to external servers.

HireLens solves this by automating the initial screening step locally, giving HR teams a ranked, explainable candidate shortlist without sacrificing data privacy.

---

## 3. Goals & Non-Goals

### Goals (v1)
- Cross-platform desktop app (macOS, Windows, Linux)
- Local LLM model download and management
- PDF and DOCX resume parsing
- Job creation with skills and requirements
- Automated candidate analysis and hybrid scoring
- Explainable score breakdown (not just a percentage)
- Candidate shortlisting by HR
- Background processing queue with concurrency management
- All data stored locally in SQLite

### Non-Goals (v1)
- Cloud sync or multi-user collaboration
- Email or calendar integrations
- Automated rejection emails to candidates
- Applicant Tracking System (ATS) replacement
- Interview scheduling
- Real-time job board scraping

---

## 4. Core Principles

1. **Privacy-first** — No data leaves the machine. Ever.
2. **AI-assisted, not AI-decided** — The AI ranks and explains; the HR team decides.
3. **Explainability** — Every score must show *why*, not just *what*.
4. **Performance-aware** — The app must adapt to different hardware (GPU vs. CPU-only machines).
5. **Resilience** — Failed resume processing must not block other resumes in the queue.

---

## 5. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Desktop framework | **Tauri 2** | macOS + Windows + Linux; lightweight binary |
| Frontend | **React 18 + TypeScript** | Vite-based dev server |
| UI components | **shadcn/ui** | Radix UI primitives + Tailwind CSS |
| Styling | **Tailwind CSS v3** | Utility-first |
| State management | **Zustand** | Lightweight React state |
| Form validation | **Zod + React Hook Form** | Schema-validated forms |
| Backend/core | **Rust** | All Tauri commands, processing engine |
| Database | **SQLite via rusqlite** | Local-first, single file |
| ORM/Query | **rusqlite + raw SQL** | Direct query layer; no ORM overhead for v1 |
| Local LLM | **llama.cpp (via llama-rs or candle)** | GGUF model format |
| Embeddings | **BGE-M3 or Nomic Embed (GGUF)** | Semantic similarity scoring |
| Vector search | **sqlite-vec extension** | Keeps vector data alongside relational data |
| PDF parsing | **pdfium-render (Rust crate)** | Local PDF text extraction |
| DOCX parsing | **docx-rs (Rust crate)** | Local DOCX text extraction |
| Package manager | **pnpm** | Workspace management |
| Build/bundle | **Tauri bundler** | Generates native installers |

---

## 6. Project Structure

```
hirelens/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json              # shadcn/ui config
│
├── src/                         # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn/ui generated components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── AppShell.tsx
│   │   ├── onboarding/
│   │   │   ├── WelcomeStep.tsx
│   │   │   └── ModelDownloadStep.tsx
│   │   ├── jobs/
│   │   │   ├── JobCard.tsx
│   │   │   ├── JobForm.tsx
│   │   │   ├── JobList.tsx
│   │   │   └── SkillsInput.tsx
│   │   ├── candidates/
│   │   │   ├── CandidateList.tsx
│   │   │   ├── CandidateCard.tsx
│   │   │   ├── CandidateDetail.tsx
│   │   │   ├── ScoreBreakdown.tsx
│   │   │   ├── SkillMatchBadge.tsx
│   │   │   └── AISummary.tsx
│   │   ├── processing/
│   │   │   ├── DropZone.tsx
│   │   │   ├── ProcessingQueue.tsx
│   │   │   └── ProcessingStatusBar.tsx
│   │   └── settings/
│   │       ├── ModelSelector.tsx
│   │       └── ConcurrencySettings.tsx
│   │
│   ├── pages/
│   │   ├── Onboarding.tsx
│   │   ├── Dashboard.tsx
│   │   ├── JobsPage.tsx
│   │   ├── JobDetailPage.tsx
│   │   ├── CandidateDetailPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── stores/
│   │   ├── useJobStore.ts
│   │   ├── useCandidateStore.ts
│   │   ├── useProcessingStore.ts
│   │   └── useSettingsStore.ts
│   │
│   ├── hooks/
│   │   ├── useJobs.ts
│   │   ├── useCandidates.ts
│   │   ├── useProcessing.ts
│   │   └── useModelStatus.ts
│   │
│   ├── lib/
│   │   ├── tauri.ts             # Typed wrappers for invoke()
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   └── types/
│       ├── job.ts
│       ├── candidate.ts
│       ├── processing.ts
│       └── settings.ts
│
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/
    │   └── default.json
    ├── icons/
    └── src/
        ├── main.rs              # Tauri app entry point
        ├── lib.rs               # Command registration
        │
        ├── commands/            # Tauri IPC command handlers
        │   ├── mod.rs
        │   ├── jobs.rs
        │   ├── candidates.rs
        │   ├── processing.rs
        │   ├── models.rs
        │   └── settings.rs
        │
        ├── db/
        │   ├── mod.rs
        │   ├── connection.rs    # DB connection pool setup
        │   ├── migrations.rs    # Embedded SQL migrations
        │   └── queries/
        │       ├── mod.rs
        │       ├── jobs.rs
        │       ├── candidates.rs
        │       ├── resumes.rs
        │       ├── analysis.rs
        │       └── queue.rs
        │
        ├── processing/
        │   ├── mod.rs
        │   ├── pipeline.rs      # Main orchestration
        │   ├── parser/
        │   │   ├── mod.rs
        │   │   ├── pdf.rs
        │   │   └── docx.rs
        │   ├── extractor.rs     # Calls LLM to extract structured JSON from raw text
        │   ├── matcher.rs       # Deterministic skill/experience matching
        │   ├── embedder.rs      # Generate and compare embeddings
        │   └── ranker.rs        # Compute final hybrid score and ranking
        │
        ├── llm/
        │   ├── mod.rs
        │   ├── client.rs        # llama.cpp session management
        │   ├── prompts.rs       # Prompt template strings
        │   └── model_manager.rs # Download, verify, activate models
        │
        ├── workers/
        │   ├── mod.rs
        │   ├── queue.rs         # SQLite-backed job queue
        │   └── pool.rs          # Async worker pool with concurrency limits
        │
        └── state/
            └── app_state.rs     # Global Tauri app state (DB pool, LLM client, worker pool)
```

---

## 7. Application Screens & User Flows

### 7.1 Onboarding (First Launch Only)

**Trigger:** The `settings` table has no row with `key = 'onboarding_completed'`.

**Screen 1 — Welcome**
- App logo and name
- Headline: *"Your hiring data stays on your machine."*
- Brief 3-point feature list (local AI, local storage, no uploads)
- Button: **"Get Started"** → go to Screen 2

**Screen 2 — Download AI Model**
- Headline: *"Choose your AI model"*
- Three model tiers displayed as radio cards:

| Tier | Label | Model | Size | Notes |
|---|---|---|---|---|
| Fast | "Fast" | Qwen3-4B-Q4_K_M.gguf | ~2.5 GB | Good for low-RAM machines |
| Balanced *(default)* | "Balanced" | Qwen3-8B-Q4_K_M.gguf | ~5 GB | Recommended |
| Quality | "Quality" | Qwen3-14B-Q4_K_M.gguf | ~9 GB | Best accuracy |

- System RAM is detected and the recommended tier is pre-selected automatically:
  - < 8 GB RAM → select "Fast"
  - 8–16 GB RAM → select "Balanced"
  - > 16 GB RAM → select "Quality"
- Button: **"Download Model"**
- Progress bar and MB/s indicator shown during download
- On completion: Button changes to **"Start Using HireLens"**
- Write `onboarding_completed = true` to settings table
- Navigate to Dashboard

---

### 7.2 Dashboard

**Route:** `/`

**Content:**
- Header: *"Welcome back"* + current date
- Stats row: Total Jobs | Total Candidates | Shortlisted | Processing
- Section: *"Active Jobs"* — shows up to 5 most recently updated jobs as cards
- Section: *"Recent Activity"* — last 10 processing events (resume uploaded, analysis complete, candidate shortlisted)
- Empty state when no jobs exist: prompt to create first job

---

### 7.3 Job Management

#### Job List Page
**Route:** `/jobs`

- Toolbar: Search input + **"New Job"** button
- Jobs shown as cards, sorted by `updated_at DESC`
- Each job card shows: title, location, candidate count, processing status badge, created date
- Click a card → Job Detail Page

#### Create / Edit Job
**Route:** `/jobs/new` or `/jobs/:jobId/edit`

**Form fields:**
1. **Job Title** — text input, required, max 100 chars
2. **Job Description** — textarea, required, min 50 chars; support markdown rendering preview
3. **Location** — text input, optional (e.g. "Bangalore" or "Remote")
4. **Employment Type** — single select: Full-time | Part-time | Contract | Internship
5. **Experience Required** — number input (years), optional (0 = any)
6. **Required Skills** — tag input (SkillsInput component):
   - Type a skill name → press Enter or comma to add
   - Each tag has a remove button
   - Each skill can be marked as "Required" (default) or "Nice to have" via toggle
7. Submit button: **"Create Job"** / **"Update Job"**

On submit: call `create_job` or `update_job` Tauri command, then navigate to Job Detail Page.

---

### 7.4 Job Detail Page

**Route:** `/jobs/:jobId`

**Layout:** Two-column layout.

**Left column (30%):**
- Job title, location, employment type, experience required
- Skills chips (color-coded: blue = required, grey = nice-to-have)
- Job description (expandable)
- Buttons: Edit Job | Archive Job
- Resume Upload Zone (DropZone component):
  - Drag-and-drop area or click-to-browse
  - Accepts `.pdf`, `.doc`, `.docx`
  - Multiple file selection supported
  - Shows upload progress per file
  - On file(s) added → call `upload_resumes` command → files are queued

**Right column (70%):**
- Toolbar: Sort by (Score, Name, Date Added) | Filter by (All, Shortlisted, Rejected, Pending Review) | Search by name
- Processing status bar (ProcessingStatusBar component) — shows `X of Y resumes processed` with a progress bar, visible only when processing is active
- Candidate list (CandidateList component) — sorted by `overall_score DESC` by default

---

### 7.5 Candidate List Row

Each candidate row shows:
- Rank number (e.g. `#1`)
- Candidate name
- Overall match score (large, colored: green ≥ 75%, amber 50–74%, red < 50%)
- Mini skill chip row: up to 5 matched skills (green tick), then `+N more`
- Experience match (e.g. "5.2 yrs / 4 yrs required")
- Status badge: Pending Review | Shortlisted | Rejected
- **Shortlist** and **Reject** action buttons (visible on hover)
- Click row → Candidate Detail Page (slide-over panel or full page)

---

### 7.6 Candidate Detail Page

**Route:** `/jobs/:jobId/candidates/:candidateId`

**Sections:**

**Header:**
- Candidate name, email, phone, location
- Overall score (large circular progress)
- Status badge + Shortlist / Reject buttons

**Score Breakdown (ScoreBreakdown component):**
```
Overall Match              92%
─────────────────────────────
Skills Match         95%  [████████████████░]
Experience Match     90%  [███████████████░░]
Semantic Relevance   94%  [████████████████░]
AI Evaluation        88%  [███████████████░░]
```

**Skills Analysis:**
```
Matched Skills (Required)
  ✓ React Native
  ✓ TypeScript
  ✓ Redux
  ✓ REST API

Matched Skills (Nice-to-have)
  ✓ GraphQL

Missing Skills
  ✗ AWS
  ✗ Jest
```

**Experience:**
- Required: 4 years
- Candidate: 5.2 years → ✓ Exceeds requirement

**AI Summary (collapsible):**
- 2–3 sentence qualitative summary from LLM
- Strengths (bulleted)
- Concerns (bulleted)

**Resume Preview:**
- Embedded text view of the parsed resume (not the raw PDF for v1)
- Link to open original file with system viewer

---

### 7.7 Settings Page

**Route:** `/settings`

**Sections:**

**AI Model:**
- Currently active model name and size
- **"Change Model"** button → opens same model selector from onboarding
- Shows model file path on disk

**Processing:**
- Concurrency level: slider (1–8), labeled "Max concurrent resume analyses"
- Shows auto-detected recommendation (GPU: up to 4; CPU-only: 1–2)

**Storage:**
- Database location (read-only text)
- **"Open in Finder / Explorer"** button
- Total database size

**About:**
- App version
- Acknowledgements

---

## 8. Functional Requirements

### 8.1 Model Management

| # | Requirement |
|---|---|
| M-1 | On first launch, detect system RAM and pre-select a model tier. |
| M-2 | Download GGUF model file to the Tauri app data directory (`$APPDATA/hirelens/models/`). |
| M-3 | Show download progress (bytes downloaded / total bytes, percentage, speed in MB/s). |
| M-4 | Verify model file integrity via SHA-256 checksum after download. |
| M-5 | Allow only one model to be "active" at a time. |
| M-6 | Allow changing the model from Settings (downloads new model if not present; swaps active model). |
| M-7 | Detect if a CUDA-capable GPU or Apple Silicon GPU is available and set default concurrency accordingly. |

---

### 8.2 Job Management

| # | Requirement |
|---|---|
| J-1 | HR can create a job with: title, description, location, employment type, experience required, and a list of skills (each skill tagged as required or nice-to-have). |
| J-2 | HR can edit any field of an existing job at any time. |
| J-3 | Editing skills on an existing job does NOT automatically re-analyze already-processed candidates (v1). Show a banner: *"Skills changed — re-analyze candidates to update scores."* with a **"Re-analyze All"** button. |
| J-4 | HR can archive a job (soft delete — data retained, job hidden from the main list by default). |
| J-5 | Jobs list supports text search (case-insensitive) on title and description. |
| J-6 | Job detail page shows a real-time count of candidates by status (total, shortlisted, rejected, pending). |

---

### 8.3 Resume Upload & Processing

| # | Requirement |
|---|---|
| R-1 | HR can upload resumes via drag-and-drop or file picker on the Job Detail page. |
| R-2 | Accepted formats: `.pdf`, `.doc`, `.docx`. Any other format is rejected with a clear error message. |
| R-3 | Multiple files can be uploaded at once (batch upload). |
| R-4 | Each uploaded file is immediately copied to `$APPDATA/hirelens/resumes/<job_id>/` and a `resumes` row is created with `status = 'pending'`. |
| R-5 | Each resume is added to the `processing_queue` table with `status = 'queued'`. |
| R-6 | Processing begins automatically as soon as a resume is queued (no manual start button required). |
| R-7 | The HR workflow is never blocked by processing — the UI remains fully interactive while processing runs in the background. |
| R-8 | The Job Detail page shows a live processing status bar: "Analyzing X of Y resumes…" — updated via Tauri events emitted from the Rust backend. |
| R-9 | If a resume fails to process (e.g. corrupt PDF, unreadable format), its status is set to `failed` and the HR sees an error icon with a tooltip explaining the reason. A "Retry" button is shown. |
| R-10 | Duplicate file detection: if a file with the same name and file size already exists for this job, show a warning and ask the user to confirm before re-adding. |

---

### 8.4 Candidate Analysis & Ranking

| # | Requirement |
|---|---|
| A-1 | After text extraction, run the LLM extraction prompt to produce structured candidate JSON. |
| A-2 | After extraction, run deterministic skill matching (see Section 13). |
| A-3 | After extraction, generate embeddings for the candidate's resume text and compare cosine similarity against a pre-generated embedding of the job description. |
| A-4 | Run LLM qualitative analysis to produce an AI summary, strengths list, and concerns list. |
| A-5 | Compute the final hybrid score (see Section 13). |
| A-6 | Store all scores and structured data in `candidate_analysis`. |
| A-7 | After each candidate is analyzed, recalculate ranks for all candidates within that job (rank by `overall_score DESC`). |
| A-8 | Emit a Tauri event `candidate-analysis-complete` with the candidate_id and job_id whenever analysis finishes, so the frontend updates immediately without polling. |

---

### 8.5 Shortlisting

| # | Requirement |
|---|---|
| S-1 | HR can mark a candidate as **Shortlisted** or **Rejected** from the candidate list or candidate detail view. |
| S-2 | HR can add optional free-text notes when shortlisting or rejecting. |
| S-3 | Status changes are instant (no re-processing required). |
| S-4 | Shortlist status does not affect the AI score or rank — it is purely a manual HR action. |
| S-5 | The candidate list can be filtered by status: All | Shortlisted | Rejected | Pending Review. |
| S-6 | HR can undo a shortlist/reject decision by clicking the action again to reset to "Pending Review". |

---

## 9. Database Schema

All migrations are run automatically on app startup. Use embedded SQL in `src-tauri/src/db/migrations.rs`.

```sql
-- MIGRATION 001: initial schema

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
  id            TEXT PRIMARY KEY,           -- e.g. "qwen3-8b-q4"
  display_name  TEXT NOT NULL,              -- e.g. "Qwen3 8B (Balanced)"
  tier          TEXT NOT NULL,              -- "fast" | "balanced" | "quality"
  file_name     TEXT NOT NULL,              -- e.g. "Qwen3-8B-Q4_K_M.gguf"
  download_url  TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  file_path     TEXT,                       -- null until downloaded
  status        TEXT DEFAULT 'available',   -- "available"|"downloading"|"downloaded"|"error"
  is_active     INTEGER DEFAULT 0,          -- boolean
  downloaded_at DATETIME
);

CREATE TABLE IF NOT EXISTS jobs (
  id                      TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  description             TEXT NOT NULL,
  location                TEXT,
  employment_type         TEXT,             -- "full-time"|"part-time"|"contract"|"internship"
  experience_required_years REAL,           -- 0 = any
  status                  TEXT DEFAULT 'active',  -- "active"|"archived"
  created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_skills (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  importance  TEXT DEFAULT 'required'       -- "required"|"nice-to-have"
);

CREATE TABLE IF NOT EXISTS candidates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  location   TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resumes (
  id            TEXT PRIMARY KEY,
  candidate_id  TEXT REFERENCES candidates(id) ON DELETE SET NULL,
  job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_path     TEXT NOT NULL,              -- absolute path on disk
  file_type     TEXT NOT NULL,              -- "pdf"|"doc"|"docx"
  file_size     INTEGER NOT NULL,           -- bytes
  raw_text      TEXT,                       -- extracted plain text
  status        TEXT DEFAULT 'pending',     -- "pending"|"queued"|"extracting"|"analyzing"|"completed"|"failed"
  error_message TEXT,
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at  DATETIME
);

CREATE TABLE IF NOT EXISTS candidate_analysis (
  id                  TEXT PRIMARY KEY,
  candidate_id        TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id              TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id           TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  -- Final hybrid score (0.0–100.0)
  overall_score       REAL,
  -- Component scores (0.0–100.0 each)
  skills_score        REAL,
  experience_score    REAL,
  semantic_score      REAL,
  llm_score           REAL,
  -- Rank within the job (1 = best)
  rank                INTEGER,
  -- Extracted structured data (JSON text)
  extracted_skills    TEXT,                 -- JSON: string[]
  matched_skills      TEXT,                 -- JSON: { skill: string, importance: string }[]
  missing_skills      TEXT,                 -- JSON: { skill: string, importance: string }[]
  experience_years    REAL,
  education           TEXT,                 -- JSON: { degree, institution, year }[]
  previous_roles      TEXT,                 -- JSON: { title, company, duration }[]
  -- LLM qualitative output
  ai_summary          TEXT,
  strengths           TEXT,                 -- JSON: string[]
  concerns            TEXT,                 -- JSON: string[]
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resume_id, job_id)
);

CREATE TABLE IF NOT EXISTS shortlists (
  id           TEXT PRIMARY KEY,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',      -- "pending"|"shortlisted"|"rejected"
  notes        TEXT,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS processing_queue (
  id            TEXT PRIMARY KEY,
  job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id     TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  priority      INTEGER DEFAULT 0,
  attempts      INTEGER DEFAULT 0,
  max_attempts  INTEGER DEFAULT 3,
  status        TEXT DEFAULT 'queued',      -- "queued"|"processing"|"completed"|"failed"
  error_message TEXT,
  queued_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at    DATETIME,
  completed_at  DATETIME
);

CREATE TABLE IF NOT EXISTS embeddings (
  id           TEXT PRIMARY KEY,
  resume_id    TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  embedding    BLOB NOT NULL               -- raw f32 vector bytes
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resumes_job_id ON resumes(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_analysis_job_id ON candidate_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_score ON candidate_analysis(job_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_shortlists_job_id ON shortlists(job_id);
```

---

## 10. Tauri IPC Command Reference

All commands are defined in `src-tauri/src/commands/` and registered in `lib.rs` via `tauri::Builder::invoke_handler`.

### Settings & Model Commands

```rust
// Get all settings as a key-value map
#[tauri::command]
async fn get_settings(state: State<'_, AppState>) -> Result<HashMap<String, String>, String>

// Save a single setting
#[tauri::command]
async fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String>

// List all models with their status
#[tauri::command]
async fn get_models(state: State<'_, AppState>) -> Result<Vec<Model>, String>

// Begin downloading a model (emits "model-download-progress" events)
#[tauri::command]
async fn download_model(
  app: AppHandle,
  state: State<'_, AppState>,
  model_id: String
) -> Result<(), String>

// Cancel an in-progress download
#[tauri::command]
async fn cancel_model_download(state: State<'_, AppState>, model_id: String) -> Result<(), String>

// Activate a downloaded model (loads it into the LLM client)
#[tauri::command]
async fn set_active_model(state: State<'_, AppState>, model_id: String) -> Result<(), String>

// Detect system capabilities
#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String>
// Returns: { ram_gb: f32, has_gpu: bool, gpu_type: Option<String>, recommended_model_tier: String }
```

### Job Commands

```rust
#[tauri::command]
async fn create_job(
  state: State<'_, AppState>,
  payload: CreateJobPayload   // { title, description, location, employment_type, experience_required_years, skills: [{skill, importance}] }
) -> Result<Job, String>

#[tauri::command]
async fn get_jobs(state: State<'_, AppState>) -> Result<Vec<JobSummary>, String>
// JobSummary includes candidate_count, shortlisted_count, processing_count

#[tauri::command]
async fn get_job(state: State<'_, AppState>, job_id: String) -> Result<JobDetail, String>
// JobDetail includes full fields + skills

#[tauri::command]
async fn update_job(
  state: State<'_, AppState>,
  job_id: String,
  payload: UpdateJobPayload
) -> Result<Job, String>

#[tauri::command]
async fn archive_job(state: State<'_, AppState>, job_id: String) -> Result<(), String>
```

### Resume & Candidate Commands

```rust
// Upload one or more resume files for a job
// Copies files to app data dir, creates DB rows, enqueues processing
#[tauri::command]
async fn upload_resumes(
  app: AppHandle,
  state: State<'_, AppState>,
  job_id: String,
  file_paths: Vec<String>    // absolute paths selected by user
) -> Result<Vec<Resume>, String>

// Get all candidates for a job with their analysis and shortlist status
#[tauri::command]
async fn get_candidates(
  state: State<'_, AppState>,
  job_id: String
) -> Result<Vec<CandidateWithAnalysis>, String>

// Get full candidate detail
#[tauri::command]
async fn get_candidate_detail(
  state: State<'_, AppState>,
  candidate_id: String,
  job_id: String
) -> Result<CandidateDetail, String>

// Update shortlist status
#[tauri::command]
async fn update_shortlist_status(
  state: State<'_, AppState>,
  job_id: String,
  candidate_id: String,
  status: String,            // "shortlisted" | "rejected" | "pending"
  notes: Option<String>
) -> Result<(), String>

// Retry a failed resume
#[tauri::command]
async fn retry_resume(
  app: AppHandle,
  state: State<'_, AppState>,
  resume_id: String
) -> Result<(), String>

// Re-analyze all candidates for a job (after job skills change)
#[tauri::command]
async fn reanalyze_job_candidates(
  app: AppHandle,
  state: State<'_, AppState>,
  job_id: String
) -> Result<(), String>

// Get processing queue status for a job
#[tauri::command]
async fn get_processing_status(
  state: State<'_, AppState>,
  job_id: String
) -> Result<ProcessingStatus, String>
// Returns: { total: u32, completed: u32, failed: u32, in_progress: u32, queued: u32 }
```

### Tauri Events Emitted from Rust → Frontend

| Event Name | Payload | Description |
|---|---|---|
| `model-download-progress` | `{ model_id, downloaded_bytes, total_bytes, speed_bps }` | Emitted during model download |
| `model-download-complete` | `{ model_id }` | Model downloaded and verified |
| `model-download-error` | `{ model_id, error }` | Download failed |
| `resume-queued` | `{ resume_id, job_id }` | Resume added to queue |
| `resume-processing-started` | `{ resume_id, job_id }` | Worker picked up resume |
| `resume-processing-step` | `{ resume_id, step }` | Step in pipeline (extracting, analyzing, scoring) |
| `candidate-analysis-complete` | `{ resume_id, job_id, candidate_id, overall_score }` | Analysis done — refresh candidate list |
| `resume-processing-failed` | `{ resume_id, job_id, error }` | Processing failed |
| `job-processing-complete` | `{ job_id }` | All resumes in a job are done |

---

## 11. TypeScript Types

Define these in `src/types/`.

```typescript
// types/job.ts
export interface Skill {
  id: string;
  skill: string;
  importance: 'required' | 'nice-to-have';
}

export interface Job {
  id: string;
  title: string;
  description: string;
  location: string | null;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'internship' | null;
  experienceRequiredYears: number | null;
  status: 'active' | 'archived';
  skills: Skill[];
  createdAt: string;
  updatedAt: string;
}

export interface JobSummary extends Omit<Job, 'description' | 'skills'> {
  candidateCount: number;
  shortlistedCount: number;
  processingCount: number;
}

// types/candidate.ts
export interface MatchedSkill {
  skill: string;
  importance: 'required' | 'nice-to-have';
}

export interface ScoreBreakdown {
  overallScore: number;
  skillsScore: number;
  experienceScore: number;
  semanticScore: number;
  llmScore: number;
}

export interface Education {
  degree: string;
  institution: string;
  year: string | null;
}

export interface WorkExperience {
  title: string;
  company: string;
  duration: string | null;
}

export interface CandidateAnalysis {
  id: string;
  candidateId: string;
  jobId: string;
  resumeId: string;
  scores: ScoreBreakdown;
  rank: number;
  extractedSkills: string[];
  matchedSkills: MatchedSkill[];
  missingSkills: MatchedSkill[];
  experienceYears: number | null;
  education: Education[];
  previousRoles: WorkExperience[];
  aiSummary: string | null;
  strengths: string[];
  concerns: string[];
}

export interface Candidate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface CandidateWithAnalysis extends Candidate {
  resumeId: string;
  resumeStatus: ResumeStatus;
  resumeError: string | null;
  analysis: CandidateAnalysis | null;
  shortlistStatus: 'pending' | 'shortlisted' | 'rejected';
  shortlistNotes: string | null;
}

// types/processing.ts
export type ResumeStatus =
  | 'pending'
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'completed'
  | 'failed';

export interface ProcessingStatus {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  queued: number;
}

export interface Resume {
  id: string;
  candidateId: string | null;
  jobId: string;
  fileName: string;
  filePath: string;
  fileType: 'pdf' | 'doc' | 'docx';
  status: ResumeStatus;
  errorMessage: string | null;
  uploadedAt: string;
}

// types/settings.ts
export type ModelTier = 'fast' | 'balanced' | 'quality';
export type ModelStatus = 'available' | 'downloading' | 'downloaded' | 'error';

export interface Model {
  id: string;
  displayName: string;
  tier: ModelTier;
  fileName: string;
  sizeBytes: number;
  status: ModelStatus;
  isActive: boolean;
  downloadedAt: string | null;
}

export interface SystemInfo {
  ramGb: number;
  hasGpu: boolean;
  gpuType: string | null;
  recommendedModelTier: ModelTier;
}
```

---

## 12. Resume Processing Pipeline

Each resume passes through this pipeline sequentially. The Rust `pipeline.rs` module orchestrates these steps and updates the `resumes.status` column at each stage.

```
Upload
  ↓
[status: pending]
Copy file to $APPDATA/hirelens/resumes/<job_id>/<uuid>.<ext>
Create resumes row
Create processing_queue row
  ↓
[status: queued]
Worker pool picks up queue item
  ↓
[status: extracting]
STEP 1 — Document Parsing (Rust, no LLM)
  ├── .pdf → pdfium-render: extract text page by page, join with newlines
  ├── .docx → docx-rs: extract paragraph text in document order
  └── .doc → attempt docx-rs; fallback: error with message "Legacy .doc format not supported; please convert to .docx"
Store raw_text in resumes table
  ↓
STEP 2 — LLM Structured Extraction (llama.cpp)
  Call LLM with EXTRACTION_PROMPT (see Section 14)
  Parse response JSON → ExtractedCandidate struct
  If JSON parsing fails → retry once with a follow-up prompt; if still failing → log error and use partial data
  Create/update candidates row (upsert by email; if no email → always create new)
  ↓
STEP 3 — Embedding Generation (embedding model)
  Generate embedding vector for raw_text (chunked if > 512 tokens; average pooling)
  Generate embedding vector for job.description (cached per job — only generate once)
  Calculate cosine similarity → semantic_score (0–100)
  Store in embeddings table
  ↓
[status: analyzing]
STEP 4 — Deterministic Scoring (Rust, no LLM)
  Run skill matching (see Section 13)
  Run experience matching (see Section 13)
  ↓
STEP 5 — LLM Qualitative Analysis (llama.cpp)
  Call LLM with ANALYSIS_PROMPT (see Section 14)
  Parse response JSON → llm_score, ai_summary, strengths, concerns
  ↓
STEP 6 — Final Score & Ranking
  Compute overall_score = (skills_score * 0.40) + (experience_score * 0.25) + (semantic_score * 0.20) + (llm_score * 0.15)
  Insert/update candidate_analysis row
  Update ranks for ALL candidates in the job (ORDER BY overall_score DESC, assign rank 1..N)
  Update resumes.status = 'completed'
  Update processing_queue.status = 'completed'
  Emit 'candidate-analysis-complete' Tauri event
  ↓
[status: completed]
```

**Error Handling in the Pipeline:**
- Any step can fail. Catch the error, set `resumes.status = 'failed'`, set `resumes.error_message`, increment `processing_queue.attempts`.
- If `attempts < max_attempts` (3), re-queue with a 5-second delay.
- After 3 failures, mark `processing_queue.status = 'failed'` and emit `resume-processing-failed` event.

---

## 13. Scoring & Ranking Algorithm

### Component 1: Skills Score (weight: 40%)

```
required_skills = job.skills.filter(importance == "required")
nice_to_have_skills = job.skills.filter(importance == "nice-to-have")
candidate_skills = extracted_candidate.skills  // normalized to lowercase

For each required skill:
  if candidate_skills contains exact match → score += 1.0
  else if candidate_skills contains substring match (≥ 80% of skill words present) → score += 0.6
  else → score += 0.0

required_raw = sum of required skill scores
required_max = count of required skills

For each nice-to-have skill:
  if candidate_skills contains exact or close match → score += 0.5
  else → score += 0.0

niice_raw = sum of nice-to-have scores
nice_max = count of nice-to-have skills * 0.5

skills_score = ((required_raw + nice_raw) / (required_max + nice_max)) * 100

Edge case: if no skills defined on job, skills_score = 100 (no penalty)
```

### Component 2: Experience Score (weight: 25%)

```
required_years = job.experience_required_years (0 = any)
candidate_years = extracted_candidate.experience_years

if required_years == 0 or required_years is null:
  experience_score = 100

elif candidate_years is null:
  experience_score = 50  // unknown — neutral score

elif candidate_years >= required_years:
  // Meets or exceeds — bonus up to 5 years over requirement
  over_ratio = min(candidate_years / required_years, 1.5)
  experience_score = min(over_ratio * 90, 100)

else:
  // Below requirement
  ratio = candidate_years / required_years
  experience_score = ratio * 70  // max 70 points if below requirement
```

### Component 3: Semantic Score (weight: 20%)

```
Already calculated in STEP 3 of the pipeline.
cosine_similarity ∈ [-1, 1]
semantic_score = ((cosine_similarity + 1) / 2) * 100  // normalize to [0, 100]
```

### Component 4: LLM Score (weight: 15%)

```
LLM is asked to return a score 0–100 in the JSON response.
This score is used directly as llm_score.
```

### Final Score

```
overall_score = (skills_score * 0.40)
              + (experience_score * 0.25)
              + (semantic_score * 0.20)
              + (llm_score * 0.15)

Clamp to [0.0, 100.0]
```

### Ranking

After each candidate analysis completes, re-run the following query:
```sql
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY job_id ORDER BY overall_score DESC) AS new_rank
  FROM candidate_analysis
  WHERE job_id = ?
)
UPDATE candidate_analysis
SET rank = ranked.new_rank
FROM ranked
WHERE candidate_analysis.id = ranked.id;
```

---

## 14. LLM Prompt Templates

Defined as static `&str` constants in `src-tauri/src/llm/prompts.rs`.

### EXTRACTION_PROMPT

```
You are a precise resume parser. Extract information from the resume text below.

Return ONLY a valid JSON object — no explanation, no markdown, no extra text.

JSON schema (use null for missing fields):
{
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "location": "string | null",
  "skills": ["string"],
  "experience_years": "number | null",
  "education": [
    { "degree": "string", "institution": "string", "year": "string | null" }
  ],
  "work_experience": [
    { "title": "string", "company": "string", "duration": "string | null", "description": "string | null" }
  ],
  "projects": [
    { "name": "string", "description": "string | null", "technologies": ["string"] }
  ],
  "certifications": ["string"],
  "languages": ["string"]
}

Resume text:
---
{raw_text}
---
```

### ANALYSIS_PROMPT

```
You are an expert HR analyst evaluating a candidate for a job role.

Job Title: {job_title}
Required Skills: {required_skills}
Experience Required: {experience_required} years
Job Description Summary: {job_description_first_500_chars}

Candidate Name: {candidate_name}
Candidate Skills: {candidate_skills}
Experience: {candidate_experience} years
Education: {candidate_education}
Previous Roles: {candidate_roles}
Deterministic Match Score: {deterministic_score}/100

Evaluate this candidate's qualitative fit for the role.
Return ONLY valid JSON — no markdown, no explanation:
{
  "llm_score": "number (0–100)",
  "summary": "string (2–3 sentences, professional tone)",
  "strengths": ["string (up to 4 items)"],
  "concerns": ["string (up to 3 items, or empty array if none)"]
}
```

**Important:** After generating a response, validate the JSON. If the model returns malformed JSON, strip any markdown fences, then retry the parse. If still failing, use safe fallback values: `{ "llm_score": 50, "summary": "Analysis unavailable.", "strengths": [], "concerns": [] }`.

---

## 15. Background Worker System

Implemented in `src-tauri/src/workers/`.

### Architecture

```
AppState holds:
  - processing_tx: Sender<ProcessingJob>  // channel to submit jobs
  - worker_handles: Vec<JoinHandle>        // held for graceful shutdown

On app start:
  1. Detect GPU → set concurrency: GPU=4, CPU=2 (configurable via settings)
  2. Spawn N worker tasks (async Tokio tasks)
  3. Each worker loops:
       while let Ok(job) = rx.recv().await {
           process_resume(job).await;
       }

Processing queue reconciliation on startup:
  - Query all rows in processing_queue where status IN ('queued', 'processing')
  - For 'processing' rows: reset to 'queued' (app crashed mid-process)
  - Re-submit all 'queued' rows to the channel
```

### Queue Item

```rust
pub struct ProcessingJob {
    pub queue_id: String,
    pub resume_id: String,
    pub job_id: String,
    pub attempt: u32,
}
```

### Concurrency Settings

- Default: detect GPU at startup; if CUDA or Metal GPU found → 4 workers; else → 2 workers
- User can override in Settings (slider: 1–8)
- Max is capped at: `min(user_setting, cpu_cores / 2)` to avoid overloading
- LLM client is shared with a `Mutex<LlamaClient>` — only one LLM inference runs at a time, but PDF parsing and DB writes can be concurrent

---

## 16. Frontend Architecture

### Routing

Use `react-router-dom v6` with `MemoryRouter` (Tauri apps don't have a real server).

```typescript
<MemoryRouter initialEntries={['/']}>
  <Routes>
    <Route path="/onboarding" element={<Onboarding />} />
    <Route element={<AppShell />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/new" element={<JobForm />} />
      <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      <Route path="/jobs/:jobId/edit" element={<JobForm />} />
      <Route path="/jobs/:jobId/candidates/:candidateId" element={<CandidateDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
  </Routes>
</MemoryRouter>
```

On initial load: check `get_settings()` for `onboarding_completed`. If not set → redirect to `/onboarding`.

### State Management (Zustand)

**`useJobStore`**
```typescript
interface JobStore {
  jobs: JobSummary[];
  activeJob: JobDetail | null;
  isLoading: boolean;
  fetchJobs: () => Promise<void>;
  fetchJob: (jobId: string) => Promise<void>;
  createJob: (payload: CreateJobPayload) => Promise<Job>;
  updateJob: (jobId: string, payload: UpdateJobPayload) => Promise<Job>;
  archiveJob: (jobId: string) => Promise<void>;
}
```

**`useCandidateStore`**
```typescript
interface CandidateStore {
  candidates: CandidateWithAnalysis[];
  processingStatus: ProcessingStatus | null;
  isLoading: boolean;
  fetchCandidates: (jobId: string) => Promise<void>;
  updateShortlistStatus: (jobId: string, candidateId: string, status: string, notes?: string) => Promise<void>;
  handleAnalysisComplete: (event: CandidateAnalysisCompleteEvent) => void;
}
```

**`useProcessingStore`**
```typescript
interface ProcessingStore {
  activeUploads: Map<string, number>; // resumeId → % progress
  addUpload: (resumeId: string) => void;
  updateUpload: (resumeId: string, progress: number) => void;
  removeUpload: (resumeId: string) => void;
}
```

### Tauri Event Listeners

Set up in `App.tsx` on mount using `listen()` from `@tauri-apps/api/event`. Each listener updates the relevant Zustand store.

```typescript
// Example:
listen('candidate-analysis-complete', (event) => {
  const { jobId, candidateId, overallScore } = event.payload;
  useCandidateStore.getState().handleAnalysisComplete(event.payload);
});
```

### Tauri Invoke Wrappers (`src/lib/tauri.ts`)

Wrap every `invoke()` call with proper typing:

```typescript
import { invoke } from '@tauri-apps/api/core';

export const api = {
  jobs: {
    list: () => invoke<JobSummary[]>('get_jobs'),
    get: (jobId: string) => invoke<JobDetail>('get_job', { jobId }),
    create: (payload: CreateJobPayload) => invoke<Job>('create_job', { payload }),
    update: (jobId: string, payload: UpdateJobPayload) => invoke<Job>('update_job', { jobId, payload }),
    archive: (jobId: string) => invoke<void>('archive_job', { jobId }),
  },
  candidates: {
    list: (jobId: string) => invoke<CandidateWithAnalysis[]>('get_candidates', { jobId }),
    detail: (candidateId: string, jobId: string) => invoke<CandidateDetail>('get_candidate_detail', { candidateId, jobId }),
    updateStatus: (jobId: string, candidateId: string, status: string, notes?: string) =>
      invoke<void>('update_shortlist_status', { jobId, candidateId, status, notes }),
  },
  resumes: {
    upload: (jobId: string, filePaths: string[]) => invoke<Resume[]>('upload_resumes', { jobId, filePaths }),
    retry: (resumeId: string) => invoke<void>('retry_resume', { resumeId }),
    getStatus: (jobId: string) => invoke<ProcessingStatus>('get_processing_status', { jobId }),
  },
  models: {
    list: () => invoke<Model[]>('get_models'),
    download: (modelId: string) => invoke<void>('download_model', { modelId }),
    cancelDownload: (modelId: string) => invoke<void>('cancel_model_download', { modelId }),
    setActive: (modelId: string) => invoke<void>('set_active_model', { modelId }),
  },
  system: {
    getInfo: () => invoke<SystemInfo>('get_system_info'),
  },
  settings: {
    getAll: () => invoke<Record<string, string>>('get_settings'),
    set: (key: string, value: string) => invoke<void>('set_setting', { key, value }),
  },
};
```

---

## 17. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Privacy** | No network requests are made during normal app operation (only during model download). All data stays in `$APPDATA/hirelens/`. |
| **Performance** | Processing a single resume (extraction + analysis) should complete within 60 seconds on a mid-range machine (Apple M1, 8 GB RAM). |
| **Reliability** | The app must resume incomplete processing queue after a crash or restart. |
| **Disk usage** | Resume files are stored by the app. Warn the user if disk space < 2 GB. |
| **Startup time** | App should render the main window within 2 seconds of launch. LLM model is loaded lazily (not at startup). |
| **Accessibility** | All interactive elements must have ARIA labels. Color is never the only way to convey information (e.g., score color + icon). |
| **Error messages** | All error states (failed processing, model load error, DB error) must show a human-readable message and a suggested action. |
| **Concurrency safety** | The SQLite connection must be wrapped in a connection pool or Mutex. Never write to the same row from two workers simultaneously. |

---

## 18. Implementation Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Tauri 2 project scaffold with React + TypeScript + Tailwind + shadcn/ui
- [ ] SQLite integration with all migrations
- [ ] AppState setup (DB connection pool, placeholder LLM client)
- [ ] Onboarding screens (Welcome + Model Download UI, no real download yet)
- [ ] Job CRUD (create, list, detail, edit, archive)
- [ ] Sidebar + routing

### Phase 2 — Resume Upload & Parsing (Week 3)
- [ ] DropZone component with drag-and-drop
- [ ] PDF parsing via pdfium-render (raw text extraction)
- [ ] DOCX parsing via docx-rs
- [ ] File copy to app data dir
- [ ] DB rows creation on upload
- [ ] Processing queue table + basic worker pool (no LLM yet — just extraction step)
- [ ] Tauri events wired up to frontend
- [ ] ProcessingStatusBar component

### Phase 3 — LLM Integration (Week 4–5)
- [ ] llama.cpp integration (choose Rust binding: `llm`, `llama-cpp-rs`, or shell out to `llama-server`)
- [ ] Model download with progress events
- [ ] EXTRACTION_PROMPT implementation + JSON parsing
- [ ] ANALYSIS_PROMPT implementation + JSON parsing
- [ ] Full pipeline (extract → analyze → score → store)
- [ ] Embedding model setup + cosine similarity

### Phase 4 — Scoring, Ranking & Review UI (Week 6)
- [ ] Deterministic skill matching (Rust)
- [ ] Hybrid score calculation
- [ ] Ranking update query
- [ ] CandidateList with sorting/filtering
- [ ] CandidateDetail with ScoreBreakdown and SkillMatchBadge
- [ ] Shortlist / Reject actions

### Phase 5 — Polish & Edge Cases (Week 7–8)
- [ ] Settings page (model switcher, concurrency slider)
- [ ] Dashboard with stats
- [ ] Re-analyze on job skill edit
- [ ] Error states, retry logic, empty states
- [ ] System RAM detection + model tier recommendation
- [ ] Concurrency cap based on GPU detection
- [ ] Basic accessibility review (ARIA labels, keyboard nav)
- [ ] macOS / Windows / Linux smoke testing

---

## 19. Known Challenges & Mitigations

| Challenge | Mitigation |
|---|---|
| **Messy PDF layouts** (two-column, tables, scanned) | Use pdfium-render for text layer extraction. For scanned PDFs (image-only), detect the absence of text and show a warning: *"This PDF appears to be a scanned image. Text extraction may be limited."* |
| **LLM returns invalid JSON** | Strip markdown fences, attempt JSON parse, retry once with a correction prompt, then fall back to safe defaults. Never let a JSON parse failure crash the worker. |
| **Model too large for user's RAM** | During onboarding, detect RAM and recommend the appropriate tier. Warn if the user tries to download a model larger than 80% of available RAM. |
| **Long resumes exceeding context window** | Chunk the resume text: use the first 3,000 tokens for the extraction prompt. For analysis, use a 500-char job description summary and 1,500 tokens of resume. |
| **Skill matching false negatives** | Normalize all skills to lowercase, strip punctuation. Use substring matching with word boundary checks (e.g. "react" should match "React Native" job skill "React Native" but not "reactive"). |
| **Duplicate candidates across jobs** | A candidate is identified per-job by their resume file. Do not attempt global deduplication in v1 — each job's candidate list is independent. |
| **App crash mid-processing** | On startup, reset any `processing` queue items to `queued` and re-add to the channel. This ensures at-least-once processing. |

---

## 20. Out of Scope (v1)

- Cloud backup or sync of jobs/candidates
- Multi-user support (the app is single-user)
- Sending emails to candidates
- Integration with external ATS (Greenhouse, Lever, etc.)
- Resume parsing for formats other than PDF and DOCX
- AI-generated interview questions
- Cover letter analysis
- Video or portfolio link evaluation
- Any analytics dashboard (charts, conversion rates, etc.)
- Dark mode (default system theme via Tailwind; full dark mode is a v2 feature)

---

*End of PRD — HireLens v1.0*
