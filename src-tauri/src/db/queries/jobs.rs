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

    conn.execute(
        "INSERT INTO jobs (id, title, description, location, employment_type, experience_required_years, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?7)",
        params![
            job_id,
            payload.title,
            payload.description,
            payload.location,
            payload.employment_type,
            payload.experience_required_years,
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
        experience_required_years: payload.experience_required_years,
        status: "active".to_string(),
        skills: saved_skills,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_jobs(conn: &Connection) -> Result<Vec<JobSummary>> {
    let mut stmt = conn.prepare(
        "SELECT j.id, j.title, j.location, j.employment_type, j.experience_required_years, j.status, j.created_at, j.updated_at,
                (SELECT COUNT(*) FROM resumes r WHERE r.job_id = j.id) as candidate_count,
                (SELECT COUNT(*) FROM shortlists s WHERE s.job_id = j.id AND s.status = 'shortlisted') as shortlisted_count,
                (SELECT COUNT(*) FROM resumes r WHERE r.job_id = j.id AND r.status IN ('pending', 'queued', 'extracting', 'analyzing')) as processing_count
         FROM jobs j
         WHERE j.status != 'archived'
         ORDER BY j.updated_at DESC"
    )?;

    let job_iter = stmt.query_map([], |row| {
        Ok(JobSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            location: row.get(2)?,
            employment_type: row.get(3)?,
            experience_required_years: row.get(4)?,
            status: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
            candidate_count: row.get(8)?,
            shortlisted_count: row.get(9)?,
            processing_count: row.get(10)?,
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
        "SELECT id, title, description, location, employment_type, experience_required_years, status, created_at, updated_at
         FROM jobs WHERE id = ?1"
    )?;

    let mut job = stmt.query_row(params![job_id], |row| {
        Ok(Job {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            location: row.get(3)?,
            employment_type: row.get(4)?,
            experience_required_years: row.get(5)?,
            status: row.get(6)?,
            skills: Vec::new(),
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
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

    conn.execute(
        "UPDATE jobs SET title = ?1, description = ?2, location = ?3, employment_type = ?4, experience_required_years = ?5, updated_at = ?6
         WHERE id = ?7",
        params![
            payload.title,
            payload.description,
            payload.location,
            payload.employment_type,
            payload.experience_required_years,
            now,
            job_id
        ],
    )?;

    conn.execute("DELETE FROM job_skills WHERE job_id = ?1", params![job_id])?;

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
