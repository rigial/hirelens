use std::path::Path;
use tauri::{AppHandle, State, Emitter};
use uuid::Uuid;

use serde::{Deserialize, Serialize};

use crate::state::app_state::AppState;
use crate::workers::queue::ProcessingJob;
use crate::db::queries::resumes::{Resume, create_resume, find_resume_by_name_and_size};
use crate::db::queries::queue::{ProcessingStatus, enqueue_resume, get_processing_status as db_get_processing_status};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateResumeInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
    pub is_duplicate: bool,
    pub existing_resume_id: Option<String>,
    pub existing_uploaded_at: Option<String>,
    pub existing_status: Option<String>,
}

#[tauri::command]
pub async fn check_duplicate_resumes(
    state: State<'_, AppState>,
    job_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<DuplicateResumeInfo>, String> {
    let db = state.db.lock().await;
    let mut results = Vec::new();

    for src_path_str in file_paths {
        let src_path = Path::new(&src_path_str);
        let file_name = src_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("resume")
            .to_string();

        let file_size = if src_path.exists() {
            std::fs::metadata(src_path)
                .map(|m| m.len() as i64)
                .unwrap_or(0)
        } else {
            0
        };

        let existing = find_resume_by_name_and_size(&db, &job_id, &file_name, file_size)
            .map_err(|e| format!("Failed to check duplicate resume: {}", e))?;

        if let Some(existing_resume) = existing {
            results.push(DuplicateResumeInfo {
                file_path: src_path_str,
                file_name,
                file_size,
                is_duplicate: true,
                existing_resume_id: Some(existing_resume.id),
                existing_uploaded_at: Some(existing_resume.uploaded_at),
                existing_status: Some(existing_resume.status),
            });
        } else {
            results.push(DuplicateResumeInfo {
                file_path: src_path_str,
                file_name,
                file_size,
                is_duplicate: false,
                existing_resume_id: None,
                existing_uploaded_at: None,
                existing_status: None,
            });
        }
    }

    Ok(results)
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::migrations::INITIAL_MIGRATION;
    use std::io::Write;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(INITIAL_MIGRATION).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES ('job-1', 'Backend Eng', 'Desc')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES ('job-2', 'Frontend Eng', 'Desc')",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn test_duplicate_resume_detection_with_files() {
        let conn = setup_test_db();
        let temp_dir = std::env::temp_dir().join(format!("hirelens_test_{}", Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).unwrap();

        // Create temporary test files
        let file1_path = temp_dir.join("candidate_alice.pdf");
        {
            let mut f = std::fs::File::create(&file1_path).unwrap();
            f.write_all(b"Alice Resume Content - 1234567890").unwrap();
        }
        let file1_size = std::fs::metadata(&file1_path).unwrap().len() as i64;

        let file2_path = temp_dir.join("candidate_bob.pdf");
        {
            let mut f = std::fs::File::create(&file2_path).unwrap();
            f.write_all(b"Bob Resume Content - Different Data").unwrap();
        }
        let file2_size = std::fs::metadata(&file2_path).unwrap().len() as i64;

        // Initially no resumes in DB for job-1
        let dup_check_1 = find_resume_by_name_and_size(&conn, "job-1", "candidate_alice.pdf", file1_size).unwrap();
        assert!(dup_check_1.is_none());

        // Insert resume 1 for job-1
        create_resume(
            &conn,
            "res-alice-1",
            "job-1",
            "candidate_alice.pdf",
            file1_path.to_str().unwrap(),
            "pdf",
            file1_size,
        ).unwrap();

        // Now checking candidate_alice for job-1 should detect duplicate
        let dup_check_alice = find_resume_by_name_and_size(&conn, "job-1", "candidate_alice.pdf", file1_size).unwrap();
        assert!(dup_check_alice.is_some());
        let matched = dup_check_alice.unwrap();
        assert_eq!(matched.id, "res-alice-1");
        assert_eq!(matched.file_name, "candidate_alice.pdf");
        assert_eq!(matched.file_size, file1_size);

        // Checking candidate_bob for job-1 should NOT detect duplicate
        let dup_check_bob = find_resume_by_name_and_size(&conn, "job-1", "candidate_bob.pdf", file2_size).unwrap();
        assert!(dup_check_bob.is_none());

        // Checking candidate_alice for job-2 (different job) should NOT detect duplicate
        let dup_check_job2 = find_resume_by_name_and_size(&conn, "job-2", "candidate_alice.pdf", file1_size).unwrap();
        assert!(dup_check_job2.is_none());

        // Checking candidate_alice for job-1 with different size should NOT detect duplicate
        let dup_check_diff_size = find_resume_by_name_and_size(&conn, "job-1", "candidate_alice.pdf", file1_size + 10).unwrap();
        assert!(dup_check_diff_size.is_none());

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}


