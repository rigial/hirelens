use std::sync::Arc;
use rusqlite::Connection;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::db::queries::jobs::get_job;
use crate::db::queries::resumes::{get_resume, update_resume_status, set_resume_text, set_resume_candidate};
use crate::db::queries::candidates::upsert_candidate;
use crate::db::queries::analysis::upsert_analysis;
use crate::db::queries::queue::update_queue_status;
use crate::llm::client::LlamaClient;
use crate::processing::parser::extract_text_from_file;
use crate::processing::matcher::{match_skills, match_experience};
use crate::processing::embedder::compute_semantic_similarity;
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

    // STEP 1 — Document Parsing (PDF / DOCX)
    let raw_text = match extract_text_from_file(&resume.file_path) {
        Ok(text) => text,
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

    // Save extracted raw text
    {
        let db = conn.lock().await;
        set_resume_text(&db, resume_id, &raw_text).ok();
    }

    // STEP 2 — LLM Structured Extraction
    let extracted_cand = {
        let client = llm.lock().await;
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

    // STEP 3 — Embedding / Semantic Relevance
    let semantic_score = compute_semantic_similarity(&raw_text, &job.description);

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
    let experience_score = match_experience(job.experience_required_years, extracted_cand.experience_years);
    let deterministic_score = (skill_result.skills_score * 0.6 + experience_score * 0.4).clamp(0.0, 100.0);

    // STEP 5 — LLM Qualitative Analysis
    let job_skills_names: Vec<String> = job.skills.iter().map(|s| s.skill.clone()).collect();
    let qualitative = {
        let client = llm.lock().await;
        client.analyze_candidate(
            &extracted_cand,
            &job.title,
            &job_skills_names,
            job.experience_required_years,
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
