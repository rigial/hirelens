use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

/// A resume record stored in SQLite representing an uploaded candidate resume.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resume {
    /// Unique UUID identifier for the resume record.
    pub id: String,
    /// Associated candidate ID once parsed and created, if any.
    pub candidate_id: Option<String>,
    /// Associated job opening UUID.
    pub job_id: String,
    /// Original file name of the resume (e.g. `john_doe_resume.pdf`).
    pub file_name: String,
    /// Stored local file path on disk.
    pub file_path: String,
    /// File extension / type (`pdf`, `doc`, `docx`).
    pub file_type: String,
    /// Size of the resume file in bytes.
    pub file_size: i64,
    /// Current processing status (`pending`, `queued`, `extracting`, `analyzing`, `completed`, `failed`).
    pub status: String,
    /// Error message if processing failed.
    pub error_message: Option<String>,
    /// ISO-8601 timestamp when the resume was uploaded.
    pub uploaded_at: String,
    /// ISO-8601 timestamp when processing completed or failed.
    pub processed_at: Option<String>,
}

/// Creates a new resume record with `pending` status in SQLite.
pub fn create_resume(
    conn: &Connection,
    id: &str,
    job_id: &str,
    file_name: &str,
    file_path: &str,
    file_type: &str,
    file_size: i64,
) -> Result<Resume> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO resumes (id, job_id, file_name, file_path, file_type, file_size, status, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7)",
        params![id, job_id, file_name, file_path, file_type, file_size, now],
    )?;

    Ok(Resume {
        id: id.to_string(),
        candidate_id: None,
        job_id: job_id.to_string(),
        file_name: file_name.to_string(),
        file_path: file_path.to_string(),
        file_type: file_type.to_string(),
        file_size,
        status: "pending".to_string(),
        error_message: None,
        uploaded_at: now,
        processed_at: None,
    })
}

/// Updates the processing status and optional error message of a resume.
pub fn update_resume_status(
    conn: &Connection,
    resume_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<()> {
    let processed_at = if status == "completed" || status == "failed" {
        Some(chrono::Utc::now().to_rfc3339())
    } else {
        None
    };

    conn.execute(
        "UPDATE resumes SET status = ?1, error_message = ?2, processed_at = COALESCE(?3, processed_at) WHERE id = ?4",
        params![status, error_message, processed_at, resume_id],
    )?;
    Ok(())
}

/// Sets the raw extracted text content of a resume.
pub fn set_resume_text(conn: &Connection, resume_id: &str, raw_text: &str) -> Result<()> {
    conn.execute(
        "UPDATE resumes SET raw_text = ?1 WHERE id = ?2",
        params![raw_text, resume_id],
    )?;
    Ok(())
}

/// Links a resume to a parsed candidate record.
pub fn set_resume_candidate(conn: &Connection, resume_id: &str, candidate_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE resumes SET candidate_id = ?1 WHERE id = ?2",
        params![candidate_id, resume_id],
    )?;
    Ok(())
}

/// Retrieves a resume record by its unique ID.
pub fn get_resume(conn: &Connection, resume_id: &str) -> Result<Resume> {
    let mut stmt = conn.prepare(
        "SELECT id, candidate_id, job_id, file_name, file_path, file_type, file_size, status, error_message, uploaded_at, processed_at
         FROM resumes WHERE id = ?1"
    )?;

    stmt.query_row(params![resume_id], |row| {
        Ok(Resume {
            id: row.get(0)?,
            candidate_id: row.get(1)?,
            job_id: row.get(2)?,
            file_name: row.get(3)?,
            file_path: row.get(4)?,
            file_type: row.get(5)?,
            file_size: row.get(6)?,
            status: row.get(7)?,
            error_message: row.get(8)?,
            uploaded_at: row.get(9)?,
            processed_at: row.get(10)?,
        })
    })
}

/// Retrieves the raw extracted text content of a resume by ID.
pub fn get_resume_raw_text(conn: &Connection, resume_id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT raw_text FROM resumes WHERE id = ?1")?;
    stmt.query_row(params![resume_id], |row| row.get(0))
}

/// Finds an existing resume in a specific job opening matching the exact file name and file size.
///
/// Returns the most recently uploaded matching resume, if any exists.
pub fn find_resume_by_name_and_size(
    conn: &Connection,
    job_id: &str,
    file_name: &str,
    file_size: i64,
) -> Result<Option<Resume>> {
    let mut stmt = conn.prepare(
        "SELECT id, candidate_id, job_id, file_name, file_path, file_type, file_size, status, error_message, uploaded_at, processed_at
         FROM resumes
         WHERE job_id = ?1 AND file_name = ?2 AND file_size = ?3
         ORDER BY uploaded_at DESC
         LIMIT 1"
    )?;

    let mut rows = stmt.query(params![job_id, file_name, file_size])?;
    if let Some(row) = rows.next()? {
        Ok(Some(Resume {
            id: row.get(0)?,
            candidate_id: row.get(1)?,
            job_id: row.get(2)?,
            file_name: row.get(3)?,
            file_path: row.get(4)?,
            file_type: row.get(5)?,
            file_size: row.get(6)?,
            status: row.get(7)?,
            error_message: row.get(8)?,
            uploaded_at: row.get(9)?,
            processed_at: row.get(10)?,
        }))
    } else {
        Ok(None)
    }
}

/// Deletes a resume record from SQLite and cleans up associated candidate if orphan.
/// Returns the deleted resume's local file path if found.
pub fn delete_resume_db(conn: &Connection, resume_id: &str) -> Result<Option<String>> {
    use rusqlite::OptionalExtension;

    let tx = conn.unchecked_transaction()?;

    let info: Option<(String, Option<String>, String)> = {
        let mut stmt = tx.prepare("SELECT file_path, candidate_id, job_id FROM resumes WHERE id = ?1")?;
        stmt.query_row(params![resume_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        }).optional()?
    };

    if let Some((file_path, candidate_id, _job_id)) = info {
        tx.execute("DELETE FROM processing_queue WHERE resume_id = ?1", params![resume_id])?;
        tx.execute("DELETE FROM embeddings WHERE resume_id = ?1", params![resume_id])?;
        tx.execute("DELETE FROM candidate_analysis WHERE resume_id = ?1", params![resume_id])?;
        tx.execute("DELETE FROM resumes WHERE id = ?1", params![resume_id])?;

        if let Some(ref cid) = candidate_id {
            let other_resumes: i64 = tx.query_row(
                "SELECT COUNT(*) FROM resumes WHERE candidate_id = ?1",
                params![cid],
                |r| r.get(0),
            )?;

            if other_resumes == 0 {
                tx.execute("DELETE FROM shortlists WHERE candidate_id = ?1", params![cid])?;
                tx.execute("DELETE FROM candidates WHERE id = ?1", params![cid])?;
            }
        }

        tx.commit()?;
        Ok(Some(file_path))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::migrations::INITIAL_MIGRATION;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(INITIAL_MIGRATION).unwrap();
        // Insert dummy job
        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES ('job-1', 'Engineer', 'Desc')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES ('job-2', 'Designer', 'Desc')",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn test_find_resume_by_name_and_size() {
        let conn = setup_test_db();

        let resume = create_resume(
            &conn,
            "res-1",
            "job-1",
            "john_doe_resume.pdf",
            "/path/to/res-1.pdf",
            "pdf",
            102400,
        ).unwrap();

        assert_eq!(resume.id, "res-1");

        // Exact match on job-1, same name and same size
        let found = find_resume_by_name_and_size(&conn, "job-1", "john_doe_resume.pdf", 102400).unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, "res-1");

        // Same name and size, but different job
        let not_found_job = find_resume_by_name_and_size(&conn, "job-2", "john_doe_resume.pdf", 102400).unwrap();
        assert!(not_found_job.is_none());

        // Same job, same name, different size
        let not_found_size = find_resume_by_name_and_size(&conn, "job-1", "john_doe_resume.pdf", 204800).unwrap();
        assert!(not_found_size.is_none());

        // Same job, different name, same size
        let not_found_name = find_resume_by_name_and_size(&conn, "job-1", "jane_doe_resume.pdf", 102400).unwrap();
        assert!(not_found_name.is_none());
    }

    #[test]
    fn test_delete_resume_db() {
        let conn = setup_test_db();

        let resume = create_resume(
            &conn,
            "res-del-1",
            "job-1",
            "test_delete.pdf",
            "/tmp/test_delete.pdf",
            "pdf",
            50000,
        ).unwrap();

        assert_eq!(resume.id, "res-del-1");

        let deleted_path = delete_resume_db(&conn, "res-del-1").unwrap();
        assert_eq!(deleted_path, Some("/tmp/test_delete.pdf".to_string()));

        let lookup = get_resume(&conn, "res-del-1");
        assert!(lookup.is_err());
    }
}

