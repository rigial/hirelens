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
| Frontend | **React + TypeScript** | Vite-based dev server |
| UI components | **Custom Radix/Tailwind components** | Radix UI primitives + Tailwind CSS |
| Styling | **Tailwind CSS v3** | Utility-first |
| State management | **Zustand** | Lightweight React state |
| Form validation | **Zod + React Hook Form** | Schema-validated forms |
| Backend/core | **Rust** | All Tauri commands, processing engine |
| Database | **SQLite via rusqlite** | Local-first, single file |
| ORM/Query | **rusqlite + raw SQL** | Direct query layer; no ORM overhead for v1 |
| Local LLM | **llama.cpp / local model runtime** | GGUF model format |
| Embeddings | **BGE-M3 / Semantic similarity** | Semantic similarity scoring |
| PDF parsing | **lopdf / pdf-extract (Rust crate)** | Local PDF text extraction |
| DOCX parsing | **zip + xml parser (Rust crate)** | Local DOCX text extraction |
| Package manager | **pnpm** | Workspace management |
| Build/bundle | **Tauri bundler** | Generates native installers |

---

## 6. Project Structure

```
hirelens/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── PRD.md
│
├── src/                         # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   │
│   ├── components/
│   │   ├── ui/                  # UI components
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
        │   ├── client.rs        # LLM session management
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
