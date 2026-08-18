# HireLens — Privacy-First Local AI Hiring Assistant

**HireLens** is a cross-platform desktop application built with **Tauri 2**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Rust** that automates candidate resume screening locally on your machine.

---

## ✨ Features

- 🔒 **100% Privacy-First:** Resumes, embeddings, and candidate data never leave your local computer.
- 🤖 **On-Device AI Engine:** Resume parsing and qualitative fit analysis powered by local models.
- 📄 **Multi-Format Ingestion:** Drag-and-drop support for `.pdf` and `.docx` resumes.
- 🎯 **Configurable Job Criteria:** Define required and nice-to-have skills, years of experience, and role summaries.
- 📊 **Hybrid Explainable Scoring:** Transparent 0–100 match ratings combining deterministic skill matching (40%), experience level (25%), semantic relevance (20%), and AI evaluation (15%).
- ⚡ **Background Worker Queue:** Async concurrency pipeline ensuring the HR UI is never blocked during resume batch processing.
- 💾 **Local Relational Store:** Embedded SQLite database with automatic migrations and state reconciliation.

---

## 🛠 Tech Stack

- **Desktop Framework:** [Tauri v2](https://v2.tauri.app/)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Router DOM
- **Backend:** Rust (Tokio async runtime, Rusqlite, Lopdf, Quick-XML/Zip, Sysinfo)
- **Database:** SQLite (WAL mode, embedded SQL migrations)
- **Package Manager:** `pnpm`

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/)
- [Rust toolchain](https://rustup.rs/) (1.80+)

### Installation

```bash
# Clone the repository
git clone https://github.com/rigial/hirelens.git
cd hirelens

# Install frontend dependencies
pnpm install

# Run desktop development app
pnpm tauri dev

# Run web-only preview
pnpm dev
```

### Build Production Binary

```bash
# Build desktop installer
pnpm tauri build
```

---

## 📂 Project Structure

```
hirelens/
├── PRD.md                       # Comprehensive Product Requirements Document
├── src/                         # React frontend
│   ├── components/
│   │   ├── candidates/          # Candidate list, cards, score breakdowns, AI summaries
│   │   ├── jobs/                # Job cards, forms, skill tag inputs
│   │   ├── layout/              # Sidebar, header, app shell
│   │   ├── onboarding/          # First-launch model selection & download UI
│   │   ├── processing/          # Resume dropzone & live progress bars
│   │   ├── settings/            # Model tier selector & concurrency controls
│   │   └── ui/                  # Buttons, cards, badges, progress bars, inputs
│   ├── hooks/                   # useJobs, useCandidates, useProcessing, useModelStatus
│   ├── lib/                     # Typed Tauri IPC wrappers & utility helpers
│   ├── pages/                   # Dashboard, Jobs, JobDetail, CandidateDetail, Settings, Onboarding
│   ├── stores/                  # Zustand state stores (Job, Candidate, Processing, Settings)
│   └── types/                   # TypeScript domain models
└── src-tauri/                   # Rust backend
    ├── Cargo.toml
    ├── src/
    │   ├── commands/            # Tauri IPC command handlers (jobs, candidates, models, settings)
    │   ├── db/                  # SQLite connection, embedded migrations, raw queries
    │   ├── llm/                 # Model download manager, prompt templates, extraction engine
    │   ├── processing/          # PDF/DOCX parsers, deterministic matcher, semantic scorer, ranker
    │   ├── state/               # AppState
    │   └── workers/             # Async background worker pool
    └── tauri.conf.json
```

---

## 📜 License

MIT
