use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingStatus {
    pub total: u32,
    pub completed: u32,
    pub failed: u32,
    pub in_progress: u32,
    pub queued: u32,
}

#[derive(Debug, Clone)]
pub struct QueueItem {
    pub id: String,
    pub job_id: String,
    pub resume_id: String,
    pub priority: i64,
    pub attempts: i64,
    pub max_attempts: i64,
    pub status: String,
}

pub fn enqueue_resume(conn: &Connection, job_id: &str, resume_id: &str) -> Result<String> {
    // Remove previous queue entry for this resume to prevent stale duplicates on retries/re-scoring
    conn.execute(
        "DELETE FROM processing_queue WHERE resume_id = ?1",
        params![resume_id],
    )?;

    let queue_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO processing_queue (id, job_id, resume_id, priority, attempts, max_attempts, status, queued_at)
         VALUES (?1, ?2, ?3, 0, 0, 3, 'queued', CURRENT_TIMESTAMP)",
        params![queue_id, job_id, resume_id],
    )?;
    Ok(queue_id)
}

pub fn update_queue_status(
    conn: &Connection,
    queue_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<()> {
    match status {
        "processing" => {
            conn.execute(
                "UPDATE processing_queue SET status = 'processing', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1 WHERE id = ?1",
                params![queue_id],
            )?;
        }
        "completed" => {
            conn.execute(
                "UPDATE processing_queue SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                params![queue_id],
            )?;
        }
        "failed" => {
            conn.execute(
                "UPDATE processing_queue SET status = 'failed', error_message = ?2, completed_at = CURRENT_TIMESTAMP WHERE id = ?1",
                params![queue_id, error_message],
            )?;
        }
        _ => {
            conn.execute(
                "UPDATE processing_queue SET status = ?1, error_message = ?2 WHERE id = ?3",
                params![status, error_message, queue_id],
            )?;
        }
    }
    Ok(())
}

pub fn get_processing_status(conn: &Connection, job_id: &str) -> Result<ProcessingStatus> {
    let mut stmt = conn.prepare(
        "SELECT 
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as failed,
            COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) as in_progress,
            COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) as queued
         FROM processing_queue
         WHERE job_id = ?1"
    )?;

    stmt.query_row(params![job_id], |row| {
        let total: u32 = row.get(0).unwrap_or(0);
        let completed: u32 = row.get(1).unwrap_or(0);
        let failed: u32 = row.get(2).unwrap_or(0);
        let in_progress: u32 = row.get(3).unwrap_or(0);
        let queued: u32 = row.get(4).unwrap_or(0);

        Ok(ProcessingStatus {
            total,
            completed,
            failed,
            in_progress,
            queued,
        })
    })
}

pub fn reset_interrupted_queue(conn: &Connection) -> Result<Vec<QueueItem>> {
    conn.execute(
        "UPDATE processing_queue SET status = 'queued' WHERE status = 'processing'",
        [],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, job_id, resume_id, priority, attempts, max_attempts, status
         FROM processing_queue
         WHERE status = 'queued'
         ORDER BY priority DESC, queued_at ASC"
    )?;

    let iter = stmt.query_map([], |row| {
        Ok(QueueItem {
            id: row.get(0)?,
            job_id: row.get(1)?,
            resume_id: row.get(2)?,
            priority: row.get(3)?,
            attempts: row.get(4)?,
            max_attempts: row.get(5)?,
            status: row.get(6)?,
        })
    })?;

    let mut items = Vec::new();
    for item in iter {
        items.push(item?);
    }
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::INITIAL_MIGRATION;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(INITIAL_MIGRATION).unwrap();
        conn.execute(
            "INSERT INTO jobs (id, title, description) VALUES ('job-1', 'Engineer', 'Desc')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO resumes (id, job_id, file_name, file_path, file_type, file_size)
             VALUES ('res-1', 'job-1', 'res1.pdf', '/path1', 'pdf', 1024)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO resumes (id, job_id, file_name, file_path, file_type, file_size)
             VALUES ('res-2', 'job-1', 'res2.pdf', '/path2', 'pdf', 2048)",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn test_enqueue_and_get_processing_status() {
        let conn = setup_test_db();

        // 1. Initial status with empty queue
        let status = get_processing_status(&conn, "job-1").unwrap();
        assert_eq!(status.total, 0);
        assert_eq!(status.completed, 0);
        assert_eq!(status.failed, 0);
        assert_eq!(status.in_progress, 0);
        assert_eq!(status.queued, 0);

        // 2. Enqueue two resumes
        let q1 = enqueue_resume(&conn, "job-1", "res-1").unwrap();
        let q2 = enqueue_resume(&conn, "job-1", "res-2").unwrap();

        let status = get_processing_status(&conn, "job-1").unwrap();
        assert_eq!(status.total, 2);
        assert_eq!(status.queued, 2);

        // 3. Mark q1 as processing
        update_queue_status(&conn, &q1, "processing", None).unwrap();
        let status = get_processing_status(&conn, "job-1").unwrap();
        assert_eq!(status.total, 2);
        assert_eq!(status.in_progress, 1);
        assert_eq!(status.queued, 1);

        // 4. Mark q1 as completed and q2 as failed
        update_queue_status(&conn, &q1, "completed", None).unwrap();
        update_queue_status(&conn, &q2, "failed", Some("Error reading PDF")).unwrap();

        let status = get_processing_status(&conn, "job-1").unwrap();
        assert_eq!(status.total, 2);
        assert_eq!(status.completed, 1);
        assert_eq!(status.failed, 1);
        assert_eq!(status.in_progress, 0);
        assert_eq!(status.queued, 0);

        // 5. Re-enqueue res-2 (retry). Should replace previous failed entry without increasing total count
        let q2_retry = enqueue_resume(&conn, "job-1", "res-2").unwrap();
        assert_ne!(q2, q2_retry);

        let status_retry = get_processing_status(&conn, "job-1").unwrap();
        assert_eq!(status_retry.total, 2);
        assert_eq!(status_retry.completed, 1);
        assert_eq!(status_retry.failed, 0);
        assert_eq!(status_retry.queued, 1);
    }
}

