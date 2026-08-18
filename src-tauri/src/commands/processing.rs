use std::path::Path;
use tauri::{AppHandle, State, Emitter};
use uuid::Uuid;

use crate::state::app_state::AppState;
use crate::workers::queue::ProcessingJob;
use crate::db::queries::resumes::{Resume, create_resume};
use crate::db::queries::queue::{ProcessingStatus, enqueue_resume, get_processing_status as db_get_processing_status};

#[tauri::command]
pub async fn upload_resumes(
    app: AppHandle,
    state: State<'_, AppState>,
    job_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<Resume>, String> {
    let mut uploaded_resumes = Vec::new();
    let dest_dir = state.app_data_dir.join("resumes").join(&job_id);
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("Failed to create resume destination dir: {}", e))?;

    for src_path_str in file_paths {
        let src_path = Path::new(&src_path_str);
        if !src_path.exists() {
            continue;
        }

        let file_name = src_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("resume")
            .to_string();

        let ext = src_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| "pdf".to_string());

        let file_size = std::fs::metadata(src_path)
            .map(|m| m.len() as i64)
            .unwrap_or(0);

        let resume_id = Uuid::new_v4().to_string();
        let target_file_name = format!("{}.{}", resume_id, ext);
        let dest_file_path = dest_dir.join(&target_file_name);

        // Copy file to app data directory
        std::fs::copy(src_path, &dest_file_path).map_err(|e| {
            format!("Failed to copy file {} to app data: {}", file_name, e)
        })?;

        let dest_path_str = dest_file_path.to_string_lossy().to_string();

        // Create resume and queue entry in DB
        let (resume, queue_id) = {
            let db = state.db.lock().await;
            let res = create_resume(
                &db,
                &resume_id,
                &job_id,
                &file_name,
                &dest_path_str,
                &ext,
                file_size,
            ).map_err(|e| e.to_string())?;

            let qid = enqueue_resume(&db, &job_id, &resume_id).map_err(|e| e.to_string())?;
            (res, qid)
        };

        app.emit("resume-queued", serde_json::json!({
            "resume_id": &resume_id,
            "job_id": &job_id,
        })).ok();

        // Enqueue to background worker
        state.worker_pool.enqueue(ProcessingJob {
            queue_id,
            resume_id: resume_id.clone(),
            job_id: job_id.clone(),
            attempt: 0,
        }).await?;

        uploaded_resumes.push(resume);
    }

    Ok(uploaded_resumes)
}

#[tauri::command]
pub async fn get_processing_status(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<ProcessingStatus, String> {
    let db = state.db.lock().await;
    db_get_processing_status(&db, &job_id).map_err(|e| e.to_string())
}
