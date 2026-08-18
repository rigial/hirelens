use std::path::Path;
use tauri::{AppHandle, State, Emitter};
use uuid::Uuid;

use serde::{Deserialize, Serialize};

use crate::state::app_state::AppState;
use crate::workers::queue::ProcessingJob;
use crate::db::queries::resumes::{Resume, create_resume, find_resume_by_name_and_size};
use crate::db::queries::queue::{ProcessingStatus, enqueue_resume, get_processing_status as db_get_processing_status};

/// Information about a resume file candidate evaluated for duplicate upload detection.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateResumeInfo {
    /// The absolute local file path of the resume file to be uploaded.
    pub file_path: String,
    /// The base file name of the resume file (e.g. `candidate.pdf`).
    pub file_name: String,
    /// The size of the file in bytes.
    pub file_size: i64,
    /// True if an existing resume with matching file name and size already exists for this job.
    pub is_duplicate: bool,
    /// The UUID identifier of the existing matching resume record, if found.
    pub existing_resume_id: Option<String>,
    /// The ISO-8601 upload timestamp of the existing resume record, if found.
    pub existing_uploaded_at: Option<String>,
    /// The processing status of the existing resume record, if found.
    pub existing_status: Option<String>,
}

/// Checks an individual resume file path against the database for duplicates within a specific job opening.
///
/// Reads file metadata directly from the filesystem, extracts the file name and size, and searches
/// for an existing resume record in the database for the given `job_id`.
///
/// # Errors
/// Returns an error if file metadata cannot be read from the filesystem or if the database query fails.
pub fn check_file_duplicate(
    conn: &rusqlite::Connection,
    job_id: &str,
    src_path_str: &str,
) -> Result<DuplicateResumeInfo, String> {
    let src_path = Path::new(src_path_str);
    let file_name = src_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("resume")
        .to_string();

    let metadata = std::fs::metadata(src_path)
        .map_err(|e| format!("Failed to read resume file {}: {}", src_path.display(), e))?;

    let file_size = i64::try_from(metadata.len())
        .map_err(|_| format!("Resume file is too large: {}", src_path.display()))?;

    let existing = find_resume_by_name_and_size(conn, job_id, &file_name, file_size)
        .map_err(|e| format!("Failed to check duplicate resume: {}", e))?;

    if let Some(existing_resume) = existing {
        Ok(DuplicateResumeInfo {
            file_path: src_path_str.to_string(),
            file_name,
            file_size,
            is_duplicate: true,
            existing_resume_id: Some(existing_resume.id),
            existing_uploaded_at: Some(existing_resume.uploaded_at),
            existing_status: Some(existing_resume.status),
        })
    } else {
        Ok(DuplicateResumeInfo {
            file_path: src_path_str.to_string(),
            file_name,
            file_size,
            is_duplicate: false,
            existing_resume_id: None,
            existing_uploaded_at: None,
            existing_status: None,
        })
    }
}

/// Tauri command to check a batch of candidate resume file paths for duplicate uploads in a job opening.
///
/// For each path, inspects filesystem metadata and matches against existing resumes in the database.
///
/// # Errors
/// Returns an error if any file cannot be read or if database queries encounter an error.
#[tauri::command]
pub async fn check_duplicate_resumes(
    state: State<'_, AppState>,
    job_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<DuplicateResumeInfo>, String> {
    let db = state.db.lock().await;
    let mut results = Vec::with_capacity(file_paths.len());

    for src_path_str in file_paths {
        let info = check_file_duplicate(&db, &job_id, &src_path_str)?;
        results.push(info);
    }

    Ok(results)
}

/// Tauri command to upload and enqueue a batch of resume files for processing in a job opening.
///
/// Copies files into the application storage directory, creates database resume records, and
/// schedules extraction/analysis jobs on the background worker pool.
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

/// Tauri command to fetch the current processing statistics and queue status for a job opening.
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
        let file1_str = file1_path.to_str().unwrap().to_string();
        let file1_size = std::fs::metadata(&file1_path).unwrap().len() as i64;

        let file2_path = temp_dir.join("candidate_bob.pdf");
        {
            let mut f = std::fs::File::create(&file2_path).unwrap();
            f.write_all(b"Bob Resume Content - Different Data").unwrap();
        }
        let file2_str = file2_path.to_str().unwrap().to_string();
        let file2_size = std::fs::metadata(&file2_path).unwrap().len() as i64;

        // 1. Initial check - candidate_alice is NOT a duplicate yet
        let res1 = check_file_duplicate(&conn, "job-1", &file1_str).unwrap();
        assert_eq!(res1.file_path, file1_str);
        assert_eq!(res1.file_name, "candidate_alice.pdf");
        assert_eq!(res1.file_size, file1_size);
        assert!(!res1.is_duplicate);
        assert!(res1.existing_resume_id.is_none());
        assert!(res1.existing_uploaded_at.is_none());
        assert!(res1.existing_status.is_none());

        // 2. Insert candidate_alice into database for job-1
        create_resume(
            &conn,
            "res-alice-1",
            "job-1",
            "candidate_alice.pdf",
            &file1_str,
            "pdf",
            file1_size,
        ).unwrap();

        // 3. Re-check candidate_alice for job-1 - should now be detected as duplicate
        let res_alice_dup = check_file_duplicate(&conn, "job-1", &file1_str).unwrap();
        assert!(res_alice_dup.is_duplicate);
        assert_eq!(res_alice_dup.file_name, "candidate_alice.pdf");
        assert_eq!(res_alice_dup.file_size, file1_size);
        assert_eq!(res_alice_dup.existing_resume_id, Some("res-alice-1".to_string()));
        assert_eq!(res_alice_dup.existing_status, Some("pending".to_string()));
        assert!(res_alice_dup.existing_uploaded_at.is_some());

        // 4. Verify JSON serialization matches camelCase schema
        let json_val = serde_json::to_value(&res_alice_dup).unwrap();
        assert_eq!(json_val["filePath"], file1_str);
        assert_eq!(json_val["fileName"], "candidate_alice.pdf");
        assert_eq!(json_val["fileSize"], file1_size);
        assert_eq!(json_val["isDuplicate"], true);
        assert_eq!(json_val["existingResumeId"], "res-alice-1");
        assert_eq!(json_val["existingStatus"], "pending");

        // 5. Checking candidate_bob for job-1 - should NOT be detected as duplicate
        let res_bob = check_file_duplicate(&conn, "job-1", &file2_str).unwrap();
        assert!(!res_bob.is_duplicate);
        assert_eq!(res_bob.file_name, "candidate_bob.pdf");
        assert_eq!(res_bob.file_size, file2_size);
        assert!(res_bob.existing_resume_id.is_none());

        // 6. Checking candidate_alice for job-2 (different job) - should NOT detect duplicate
        let res_job2 = check_file_duplicate(&conn, "job-2", &file1_str).unwrap();
        assert!(!res_job2.is_duplicate);
        assert_eq!(res_job2.file_name, "candidate_alice.pdf");

        // 7. Checking an unreadable/non-existent path - should propagate error from metadata
        let invalid_path = temp_dir.join("non_existent_file.pdf").to_str().unwrap().to_string();
        let err_res = check_file_duplicate(&conn, "job-1", &invalid_path);
        assert!(err_res.is_err());
        assert!(err_res.unwrap_err().contains("Failed to read resume file"));

        // Cleanup
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}


