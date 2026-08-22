use std::sync::Arc;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::db::queries::jobs::get_job;
use crate::db::queries::resumes::{get_resume, update_resume_status, set_resume_text, set_resume_candidate};
use crate::db::queries::candidates::upsert_candidate;
use crate::db::queries::analysis::upsert_analysis;
use crate::db::queries::queue::update_queue_status;
use crate::db::queries::embeddings::{upsert_resume_embedding, upsert_job_embedding, get_job_embedding};
use crate::llm::client::LlamaClient;
use crate::ocr::create_default_ocr_provider;
use crate::processing::parser::extract_text_from_file_with_ocr;
use crate::processing::matcher::{match_skills, match_experience};
use crate::processing::embedder::{generate_embedding, compute_semantic_similarity_from_vectors};
use crate::processing::ranker::compute_final_score;

pub async fn run_processing_pipeline(
    app: &AppHandle,
    conn: Arc<tokio::sync::Mutex<Connection>>,
    llm: Arc<tokio::sync::Mutex<LlamaClient>>,
    queue_id: &str,
    resume_id: &str,
    job_id: &str,
) -> Result<(), String> {
    app.emit("resume-processing-started", serde_json::json!({
        "resume_id": resume_id,
        "job_id": job_id
    })).ok();

    // 1. Fetch Resume and Job metadata
    let (resume, job) = {
        let db = conn.lock().await;
        let r = get_resume(&db, resume_id).map_err(|e| format!("Failed to find resume: {}", e))?;
        let j = get_job(&db, job_id).map_err(|e| format!("Failed to find job: {}", e))?;
        (r, j)
    };

    // Update queue & resume status: extracting
    {
        let db = conn.lock().await;
        update_queue_status(&db, queue_id, "processing", None).ok();
        update_resume_status(&db, resume_id, "extracting", None).ok();
    }
    app.emit("resume-processing-step", serde_json::json!({
        "resume_id": resume_id,
        "step": "extracting"
    })).ok();

    // STEP 1 — Document Parsing (PDF with Hybrid OCR Fallback / DOCX)
    let ocr_provider = create_default_ocr_provider();
    let extraction = match extract_text_from_file_with_ocr(&resume.file_path, &*ocr_provider).await {
        Ok(res) => res,
        Err(err) => {
            let db = conn.lock().await;
            update_resume_status(&db, resume_id, "failed", Some(&err)).ok();
            update_queue_status(&db, queue_id, "failed", Some(&err)).ok();
            app.emit("resume-processing-failed", serde_json::json!({
                "resume_id": resume_id,
                "job_id": job_id,
                "error": err
            })).ok();
            return Err(err);
        }
    };

    let raw_text = extraction.text;

    // Emit extraction completed telemetry event (FR-13)
    if let Some(meta) = &extraction.pdf_metadata {
        app.emit("resume-extraction-completed", serde_json::json!({
            "resume_id": resume_id,
            "job_id": job_id,
            "pages": meta.total_pages,
            "text_pages": meta.text_pages,
            "ocr_pages": meta.ocr_pages,
            "method": meta.method,
            "duration_ms": meta.total_duration_ms
        })).ok();
    }

    // Save extracted raw text
    {
        let db = conn.lock().await;
        set_resume_text(&db, resume_id, &raw_text).ok();
    }

    // STEP 2 — LLM Structured Extraction
    let extracted_cand = {
        let mut client = llm.lock().await;
        client.extract_candidate(&raw_text).await
    };

    let candidate_id = {
        let db = conn.lock().await;
        let cid = upsert_candidate(
            &db,
            &extracted_cand.name,
            extracted_cand.email.as_deref(),
            extracted_cand.phone.as_deref(),
            extracted_cand.location.as_deref(),
        ).map_err(|e| format!("Failed to upsert candidate: {}", e))?;
        set_resume_candidate(&db, resume_id, &cid).ok();
        cid
    };

    // STEP 3 — Embedding / Semantic Relevance (Dense Vector & sqlite-vec Integration)
    let semantic_score = {
        // 1. Get or generate cached job description embedding (384d)
        let job_vec = {
            let db = conn.lock().await;
            if let Ok(Some(cached_vec)) = get_job_embedding(&db, job_id) {
                cached_vec
            } else {
                let generated_job_vec = generate_embedding(&job.description);
                upsert_job_embedding(&db, job_id, &generated_job_vec).ok();
                generated_job_vec
            }
        };

        // 2. Generate resume dense embedding vector (384d)
        let resume_vec = generate_embedding(&raw_text);

        // 3. Persist resume embedding BLOB in embeddings table
        {
            let db = conn.lock().await;
            upsert_resume_embedding(&db, resume_id, job_id, &resume_vec).ok();
        }

        // 4. Compute cosine similarity between resume and job vectors -> semantic_score
        compute_semantic_similarity_from_vectors(&resume_vec, &job_vec)
    };

    // STEP 4 — Deterministic Skill and Experience Scoring
    {
        let db = conn.lock().await;
        update_resume_status(&db, resume_id, "analyzing", None).ok();
    }
    app.emit("resume-processing-step", serde_json::json!({
        "resume_id": resume_id,
        "step": "analyzing"
    })).ok();

    let skill_result = match_skills(&job.skills, &extracted_cand.skills);
    let min_exp = job.min_experience_years.or(job.experience_required_years);
    let max_exp = job.max_experience_years;
    let experience_score = match_experience(min_exp, max_exp, extracted_cand.experience_years);
    let deterministic_score = (skill_result.skills_score * 0.6 + experience_score * 0.4).clamp(0.0, 100.0);

    // STEP 5 — LLM Qualitative Analysis
    let job_skills_names: Vec<String> = job.skills.iter().map(|s| s.skill.clone()).collect();
    let qualitative = {
        let mut client = llm.lock().await;
        client.analyze_candidate(
            &extracted_cand,
            &job.title,
            &job_skills_names,
            min_exp,
            max_exp,
            &job.description,
            deterministic_score,
        ).await
    };

    // STEP 6 — Final Score & Storage
    let scores = compute_final_score(
        skill_result.skills_score,
        experience_score,
        semantic_score,
        qualitative.llm_score,
    );

    let analysis_id = Uuid::new_v4().to_string();
    {
        let db = conn.lock().await;
        upsert_analysis(
            &db,
            &analysis_id,
            &candidate_id,
            job_id,
            resume_id,
            &scores,
            &extracted_cand.skills,
            &skill_result.matched_skills,
            &skill_result.missing_skills,
            extracted_cand.experience_years,
            &extracted_cand.education,
            &extracted_cand.work_experience,
            Some(&qualitative.summary),
            &qualitative.strengths,
            &qualitative.concerns,
        ).map_err(|e| format!("Failed to record analysis: {}", e))?;

        update_resume_status(&db, resume_id, "completed", None).ok();
        update_queue_status(&db, queue_id, "completed", None).ok();
    }

    app.emit("candidate-analysis-complete", serde_json::json!({
        "resume_id": resume_id,
        "job_id": job_id,
        "candidate_id": candidate_id,
        "overall_score": scores.overall_score
    })).ok();

    Ok(())
}
