use tauri::{AppHandle, State};
use crate::state::app_state::AppState;
use crate::workers::queue::ProcessingJob;
use crate::db::queries::candidates::{
    CandidateWithAnalysis, CandidateDetail,
    get_candidates as db_get_candidates,
    get_candidate_detail as db_get_candidate_detail,
    update_shortlist_status as db_update_shortlist_status,
};
use crate::db::queries::queue::enqueue_resume;
use crate::db::queries::resumes::update_resume_status;

#[tauri::command]
pub async fn get_candidates(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<Vec<CandidateWithAnalysis>, String> {
    let db = state.db.lock().await;
    db_get_candidates(&db, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_candidate_detail(
    state: State<'_, AppState>,
    candidate_id: String,
    job_id: String,
) -> Result<CandidateDetail, String> {
    let db = state.db.lock().await;
    db_get_candidate_detail(&db, &candidate_id, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_shortlist_status(
    state: State<'_, AppState>,
    job_id: String,
    candidate_id: String,
    status: String,
    notes: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db_update_shortlist_status(&db, &job_id, &candidate_id, &status, notes.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn retry_resume(
    _app: AppHandle,
    state: State<'_, AppState>,
    resume_id: String,
) -> Result<(), String> {
    let (job_id, queue_id) = {
        let db = state.db.lock().await;
        let mut stmt = db.prepare("SELECT job_id FROM resumes WHERE id = ?1").map_err(|e| e.to_string())?;
        let jid: String = stmt.query_row(rusqlite::params![resume_id], |r| r.get(0)).map_err(|e| e.to_string())?;
        update_resume_status(&db, &resume_id, "queued", None).map_err(|e| e.to_string())?;
        let qid = enqueue_resume(&db, &jid, &resume_id).map_err(|e| e.to_string())?;
        (jid, qid)
    };

    state.worker_pool.enqueue(ProcessingJob {
        queue_id,
        resume_id,
        job_id,
        attempt: 1,
    }).await?;

    Ok(())
}

#[tauri::command]
pub async fn reanalyze_job_candidates(
    _app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let resumes: Vec<String> = {
        let db = state.db.lock().await;
        let mut stmt = db.prepare("SELECT id FROM resumes WHERE job_id = ?1").map_err(|e| e.to_string())?;
        let iter = stmt.query_map(rusqlite::params![job_id], |r| r.get(0)).map_err(|e| e.to_string())?;
        iter.filter_map(|r| r.ok()).collect()
    };

    for resume_id in resumes {
        let queue_id = {
            let db = state.db.lock().await;
            update_resume_status(&db, &resume_id, "queued", None).map_err(|e| e.to_string())?;
            enqueue_resume(&db, &job_id, &resume_id).map_err(|e| e.to_string())?
        };

        state.worker_pool.enqueue(ProcessingJob {
            queue_id,
            resume_id,
            job_id: job_id.clone(),
            attempt: 1,
        }).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn search_candidates_semantic(
    state: State<'_, AppState>,
    job_id: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<(String, f64)>, String> {
    let query_vec = crate::processing::embedder::generate_embedding(&query);
    let db = state.db.lock().await;
    crate::db::queries::embeddings::find_similar_resumes_sqlite_vec(
        &db,
        &job_id,
        &query_vec,
        limit.unwrap_or(10),
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_resume(
    state: State<'_, AppState>,
    resume_id: String,
) -> Result<(), String> {
    let file_path = {
        let db = state.db.lock().await;
        crate::db::queries::resumes::delete_resume_db(&db, &resume_id)
            .map_err(|e| e.to_string())?
    };

    if let Some(path) = file_path {
        if let Err(e) = tokio::fs::remove_file(&path).await {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Failed to remove resume file {}: {}", path, e));
            }
        }
    }

    Ok(())
}


