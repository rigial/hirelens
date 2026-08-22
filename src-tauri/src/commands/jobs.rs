use tauri::State;
use crate::state::app_state::AppState;
use crate::db::queries::jobs::{
    Job, JobSummary, CreateJobPayload, UpdateJobPayload,
    create_job as db_create_job,
    get_jobs as db_get_jobs,
    get_job as db_get_job,
    update_job as db_update_job,
    archive_job as db_archive_job,
};

#[tauri::command]
pub async fn create_job(
    state: State<'_, AppState>,
    payload: CreateJobPayload,
) -> Result<Job, String> {
    let db = state.db.lock().await;
    db_create_job(&db, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_jobs(
    state: State<'_, AppState>,
) -> Result<Vec<JobSummary>, String> {
    let db = state.db.lock().await;
    db_get_jobs(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<Job, String> {
    let db = state.db.lock().await;
    db_get_job(&db, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_job(
    state: State<'_, AppState>,
    job_id: String,
    payload: UpdateJobPayload,
) -> Result<Job, String> {
    let db = state.db.lock().await;
    db_update_job(&db, &job_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db_archive_job(&db, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_job(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let resume_paths = {
        let db = state.db.lock().await;
        crate::db::queries::jobs::delete_job_db(&db, &job_id).map_err(|e| e.to_string())?
    };

    for path in resume_paths {
        tokio::fs::remove_file(&path).await.ok();
    }

    let job_dir = state.app_data_dir.join("resumes").join(&job_id);
    tokio::fs::remove_dir_all(&job_dir).await.ok();

    Ok(())
}

