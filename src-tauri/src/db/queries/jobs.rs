use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillPayload {
    pub skill: String,
    pub importance: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub id: String,
    pub skill: String,
    pub importance: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobPayload {
    pub title: String,
    pub description: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub experience_required_years: Option<f64>,
    pub min_experience_years: Option<f64>,
    pub max_experience_years: Option<f64>,
    pub skills: Vec<SkillPayload>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobPayload {
    pub title: String,
    pub description: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub experience_required_years: Option<f64>,
    pub min_experience_years: Option<f64>,
    pub max_experience_years: Option<f64>,
    pub skills: Vec<SkillPayload>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    pub title: String,
    pub description: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub experience_required_years: Option<f64>,
    pub min_experience_years: Option<f64>,
    pub max_experience_years: Option<f64>,
    pub status: String,
    pub skills: Vec<Skill>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JobSummary {
    pub id: String,
    pub title: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub experience_required_years: Option<f64>,
    pub min_experience_years: Option<f64>,
    pub max_experience_years: Option<f64>,
    pub status: String,
    pub candidate_count: i64,
    pub shortlisted_count: i64,
    pub processing_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn create_job(conn: &Connection, payload: CreateJobPayload) -> Result<Job> {
    let job_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let min_exp = payload.min_experience_years.or(payload.experience_required_years);
    let max_exp = payload.max_experience_years;
    let legacy_exp = min_exp;

    conn.execute(
        "INSERT INTO jobs (id, title, description, location, employment_type, experience_required_years, min_experience_years, max_experience_years, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'active', ?9, ?9)",
        params![
            job_id,
            payload.title,
            payload.description,
            payload.location,
            payload.employment_type,
            legacy_exp,
            min_exp,
            max_exp,
            now
        ],
    )?;

    let mut saved_skills = Vec::new();
    for s in payload.skills {
        let skill_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO job_skills (id, job_id, skill, importance) VALUES (?1, ?2, ?3, ?4)",
            params![skill_id, job_id, s.skill, s.importance],
        )?;
        saved_skills.push(Skill {
            id: skill_id,
            skill: s.skill,
            importance: s.importance,
        });
    }

    Ok(Job {
        id: job_id,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        employment_type: payload.employment_type,
        experience_required_years: legacy_exp,
        min_experience_years: min_exp,
        max_experience_years: max_exp,
        status: "active".to_string(),
        skills: saved_skills,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_jobs(conn: &Connection) -> Result<Vec<JobSummary>> {
    let mut stmt = conn.prepare(
        "SELECT j.id, j.title, j.location, j.employment_type, j.experience_required_years, j.min_experience_years, j.max_experience_years, j.status, j.created_at, j.updated_at,
                (SELECT COUNT(*) FROM resumes r WHERE r.job_id = j.id) as candidate_count,
                (SELECT COUNT(*) FROM shortlists s WHERE s.job_id = j.id AND s.status = 'shortlisted') as shortlisted_count,
                (SELECT COUNT(*) FROM resumes r WHERE r.job_id = j.id AND r.status IN ('pending', 'queued', 'extracting', 'analyzing')) as processing_count
         FROM jobs j
         WHERE j.status != 'archived'
         ORDER BY j.updated_at DESC"
    )?;

    let job_iter = stmt.query_map([], |row| {
        let exp_req: Option<f64> = row.get(4)?;
        let min_exp: Option<f64> = row.get(5)?;
        let max_exp: Option<f64> = row.get(6)?;

        Ok(JobSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            location: row.get(2)?,
            employment_type: row.get(3)?,
            experience_required_years: exp_req.or(min_exp),
            min_experience_years: min_exp.or(exp_req),
            max_experience_years: max_exp,
            status: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            candidate_count: row.get(10)?,
            shortlisted_count: row.get(11)?,
            processing_count: row.get(12)?,
        })
    })?;

    let mut jobs = Vec::new();
    for job in job_iter {
        jobs.push(job?);
    }
    Ok(jobs)
}

pub fn get_job(conn: &Connection, job_id: &str) -> Result<Job> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, location, employment_type, experience_required_years, min_experience_years, max_experience_years, status, created_at, updated_at
         FROM jobs WHERE id = ?1"
    )?;

    let mut job = stmt.query_row(params![job_id], |row| {
        let exp_req: Option<f64> = row.get(5)?;
        let min_exp: Option<f64> = row.get(6)?;
        let max_exp: Option<f64> = row.get(7)?;

        Ok(Job {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            location: row.get(3)?,
            employment_type: row.get(4)?,
            experience_required_years: exp_req.or(min_exp),
            min_experience_years: min_exp.or(exp_req),
            max_experience_years: max_exp,
            status: row.get(8)?,
            skills: Vec::new(),
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    let mut skill_stmt = conn.prepare("SELECT id, skill, importance FROM job_skills WHERE job_id = ?1")?;
    let skill_iter = skill_stmt.query_map(params![job_id], |row| {
        Ok(Skill {
            id: row.get(0)?,
            skill: row.get(1)?,
            importance: row.get(2)?,
        })
    })?;

    for skill in skill_iter {
        job.skills.push(skill?);
    }

    Ok(job)
}

pub fn update_job(conn: &Connection, job_id: &str, payload: UpdateJobPayload) -> Result<Job> {
    let now = chrono::Utc::now().to_rfc3339();

    let min_exp = payload.min_experience_years.or(payload.experience_required_years);
    let max_exp = payload.max_experience_years;
    let legacy_exp = min_exp;

    conn.execute(
        "UPDATE jobs SET title = ?1, description = ?2, location = ?3, employment_type = ?4, experience_required_years = ?5, min_experience_years = ?6, max_experience_years = ?7, updated_at = ?8
         WHERE id = ?9",
        params![
            payload.title,
            payload.description,
            payload.location,
            payload.employment_type,
            legacy_exp,
            min_exp,
            max_exp,
            now,
            job_id
        ],
    )?;

    conn.execute("DELETE FROM job_skills WHERE job_id = ?1", params![job_id])?;
    conn.execute("DELETE FROM job_embeddings WHERE job_id = ?1", params![job_id]).ok();

    let mut saved_skills = Vec::new();
    for s in payload.skills {
        let skill_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO job_skills (id, job_id, skill, importance) VALUES (?1, ?2, ?3, ?4)",
            params![skill_id, job_id, s.skill, s.importance],
        )?;
        saved_skills.push(Skill {
            id: skill_id,
            skill: s.skill,
            importance: s.importance,
        });
    }

    get_job(conn, job_id)
}

pub fn archive_job(conn: &Connection, job_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE jobs SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![job_id],
    )?;
    Ok(())
}

/// Deletes a job and all associated database records (skills, resumes, analysis, embeddings, queue).
/// Returns all deleted resume file paths so physical files can be removed from disk.
pub fn delete_job_db(conn: &Connection, job_id: &str) -> Result<Vec<String>> {
    let tx = conn.unchecked_transaction()?;

    let mut resume_paths = Vec::new();
    let mut candidate_ids = Vec::new();

    {
        let mut stmt = tx.prepare("SELECT file_path, candidate_id FROM resumes WHERE job_id = ?1")?;
        let rows = stmt.query_map(params![job_id], |r| {
            let path: String = r.get(0)?;
            let cid: Option<String> = r.get(1)?;
            Ok((path, cid))
        })?;

        for row in rows {
            let (path, cid) = row?;
            resume_paths.push(path);
            if let Some(c) = cid {
                candidate_ids.push(c);
            }
        }
    }

    tx.execute("DELETE FROM processing_queue WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM embeddings WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM job_embeddings WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM candidate_analysis WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM shortlists WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM resumes WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM job_skills WHERE job_id = ?1", params![job_id])?;
    tx.execute("DELETE FROM jobs WHERE id = ?1", params![job_id])?;

    for cid in &candidate_ids {
        let remaining_resumes: i64 = tx.query_row(
            "SELECT COUNT(*) FROM resumes WHERE candidate_id = ?1",
            params![cid],
            |r| r.get(0),
        )?;

        if remaining_resumes == 0 {
            tx.execute("DELETE FROM shortlists WHERE candidate_id = ?1", params![cid])?;
            tx.execute("DELETE FROM candidates WHERE id = ?1", params![cid])?;
        }
    }

    tx.commit()?;

    Ok(resume_paths)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use crate::db::migrations::INITIAL_MIGRATION;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(INITIAL_MIGRATION).unwrap();
        conn
    }

    #[test]
    fn test_create_and_delete_job_db() {
        let conn = setup_test_db();
        let payload = CreateJobPayload {
            title: "Rust Architect".to_string(),
            description: "Build high-throughput backends".to_string(),
            location: Some("Remote".to_string()),
            employment_type: Some("Full-time".to_string()),
            experience_required_years: None,
            min_experience_years: Some(2.0),
            max_experience_years: Some(4.0),
            skills: vec![
                SkillPayload { skill: "Rust".to_string(), importance: "required".to_string() },
                SkillPayload { skill: "Tokio".to_string(), importance: "preferred".to_string() },
            ],
        };

        let job = create_job(&conn, payload).unwrap();
        assert_eq!(job.title, "Rust Architect");
        assert_eq!(job.min_experience_years, Some(2.0));
        assert_eq!(job.max_experience_years, Some(4.0));

        let fetched = get_job(&conn, &job.id).unwrap();
        assert_eq!(fetched.skills.len(), 2);
        assert_eq!(fetched.min_experience_years, Some(2.0));
        assert_eq!(fetched.max_experience_years, Some(4.0));

        // Update with modified range
        let update_payload = UpdateJobPayload {
            title: "Staff Rust Architect".to_string(),
            description: "Lead distributed teams".to_string(),
            location: Some("Remote".to_string()),
            employment_type: Some("Full-time".to_string()),
            experience_required_years: None,
            min_experience_years: Some(5.0),
            max_experience_years: Some(8.0),
            skills: vec![
                SkillPayload { skill: "Rust".to_string(), importance: "required".to_string() },
            ],
        };
        let updated = update_job(&conn, &job.id, update_payload).unwrap();
        assert_eq!(updated.title, "Staff Rust Architect");
        assert_eq!(updated.min_experience_years, Some(5.0));
        assert_eq!(updated.max_experience_years, Some(8.0));

        // Delete job
        let deleted_paths = delete_job_db(&conn, &job.id).unwrap();
        assert_eq!(deleted_paths.len(), 0);

        let lookup = get_job(&conn, &job.id);
        assert!(lookup.is_err());
    }

    #[test]
    fn test_delete_job_db_with_resumes_and_orphans() {
        let conn = setup_test_db();
        let payload = CreateJobPayload {
            title: "Frontend Lead".to_string(),
            description: "React and TypeScript".to_string(),
            location: None,
            employment_type: None,
            experience_required_years: None,
            min_experience_years: None,
            max_experience_years: None,
            skills: vec![],
        };
        let job = create_job(&conn, payload).unwrap();

        // Insert candidate and resume for this job
        conn.execute(
            "INSERT INTO candidates (id, name, email) VALUES ('cand-1', 'Alice', 'alice@test.com')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO resumes (id, candidate_id, job_id, file_name, file_path, file_type, file_size) VALUES ('res-1', 'cand-1', ?1, 'alice.pdf', '/path/to/alice.pdf', 'pdf', 50000)",
            params![job.id],
        ).unwrap();

        let paths = delete_job_db(&conn, &job.id).unwrap();
        assert_eq!(paths, vec!["/path/to/alice.pdf".to_string()]);

        // Candidate should also be deleted since they had no other resumes
        let cand_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM candidates WHERE id = 'cand-1'",
            [],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(cand_count, 0);
    }
}


