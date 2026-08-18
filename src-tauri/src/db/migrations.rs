pub const INITIAL_MIGRATION: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS models (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  tier          TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  download_url  TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  file_path     TEXT,
  status        TEXT DEFAULT 'available',
  is_active     INTEGER DEFAULT 0,
  downloaded_at DATETIME
);

CREATE TABLE IF NOT EXISTS jobs (
  id                        TEXT PRIMARY KEY,
  title                     TEXT NOT NULL,
  description               TEXT NOT NULL,
  location                  TEXT,
  employment_type           TEXT,
  experience_required_years REAL,
  status                    TEXT DEFAULT 'active',
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_skills (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  importance  TEXT DEFAULT 'required'
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
  file_path     TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  raw_text      TEXT,
  status        TEXT DEFAULT 'pending',
  error_message TEXT,
  uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at  DATETIME
);

CREATE TABLE IF NOT EXISTS candidate_analysis (
  id                  TEXT PRIMARY KEY,
  candidate_id        TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id              TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id           TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  overall_score       REAL,
  skills_score        REAL,
  experience_score    REAL,
  semantic_score      REAL,
  llm_score           REAL,
  rank                INTEGER,
  extracted_skills    TEXT,
  matched_skills      TEXT,
  missing_skills      TEXT,
  experience_years    REAL,
  education           TEXT,
  previous_roles      TEXT,
  ai_summary          TEXT,
  strengths           TEXT,
  concerns            TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resume_id, job_id)
);

CREATE TABLE IF NOT EXISTS shortlists (
  id           TEXT PRIMARY KEY,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',
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
  status        TEXT DEFAULT 'queued',
  error_message TEXT,
  queued_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at    DATETIME,
  completed_at  DATETIME
);

CREATE TABLE IF NOT EXISTS embeddings (
  id           TEXT PRIMARY KEY,
  resume_id    TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  embedding    BLOB NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resumes_job_id ON resumes(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_analysis_job_id ON candidate_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_score ON candidate_analysis(job_id, overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_shortlists_job_id ON shortlists(job_id);
"#;
