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
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued
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
