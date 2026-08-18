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

pub fn get_resume_raw_text(conn: &Connection, resume_id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT raw_text FROM resumes WHERE id = ?1")?;
    stmt.query_row(params![resume_id], |row| row.get(0))
}
