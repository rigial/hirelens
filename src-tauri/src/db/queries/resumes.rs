use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Resume {
    pub id: String,
    pub candidate_id: Option<String>,
    pub job_id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: i64,
    pub status: String,
    pub error_message: Option<String>,
    pub uploaded_at: String,
    pub processed_at: Option<String>,
}

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

pub fn set_resume_text(conn: &Connection, resume_id: &str, raw_text: &str) -> Result<()> {
    conn.execute(
        "UPDATE resumes SET raw_text = ?1 WHERE id = ?2",
        params![raw_text, resume_id],
    )?;
    Ok(())
}

pub fn set_resume_candidate(conn: &Connection, resume_id: &str, candidate_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE resumes SET candidate_id = ?1 WHERE id = ?2",
        params![candidate_id, resume_id],
    )?;
    Ok(())
}

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

/// Retrieves the raw text associated with a resume.
///
/// # Examples
///
/// ```
/// let conn = rusqlite::Connection::open_in_memory().unwrap();
/// conn.execute(
///     "CREATE TABLE resumes (id TEXT PRIMARY KEY, raw_text TEXT)",
///     [],
/// ).unwrap();
/// conn.execute(
///     "INSERT INTO resumes (id, raw_text) VALUES (?1, ?2)",
///     ["resume-1", "Resume content"],
/// ).unwrap();
///
/// assert_eq!(
///     get_resume_raw_text(&conn, "resume-1").unwrap(),
///     Some("Resume content".to_string())
/// );
/// ```
pub fn get_resume_raw_text(conn: &Connection, resume_id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT raw_text FROM resumes WHERE id = ?1")?;
    stmt.query_row(params![resume_id], |row| row.get(0))
}

/// Finds the most recently uploaded resume matching a job, file name, and file size.
///
/// # Parameters
///
/// * `job_id` - Identifies the job associated with the resume.
/// * `file_name` - The resume's file name.
/// * `file_size` - The resume's file size in bytes.
///
/// # Returns
///
/// `Some(Resume)` for the latest matching resume, or `None` when no match exists.
///
/// # Examples
///
/// ```no_run
/// let conn = rusqlite::Connection::open("app.db")?;
/// let resume = find_resume_by_name_and_size(&conn, "job-123", "resume.pdf", 4096)?;
///
/// if let Some(resume) = resume {
///     println!("{}", resume.file_name);
/// }
/// # Ok::<(), rusqlite::Error>(())
/// ```
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
}

