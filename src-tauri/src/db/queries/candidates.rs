use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::db::queries::analysis::{CandidateAnalysis, ScoreBreakdown};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateWithAnalysis {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub resume_id: String,
    pub resume_status: String,
    pub resume_error: Option<String>,
    pub analysis: Option<CandidateAnalysis>,
    pub shortlist_status: String,
    pub shortlist_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateDetail {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub resume_id: String,
    pub resume_status: String,
    pub resume_error: Option<String>,
    pub file_name: String,
    pub file_path: String,
    pub raw_text: Option<String>,
    pub analysis: Option<CandidateAnalysis>,
    pub shortlist_status: String,
    pub shortlist_notes: Option<String>,
}

pub fn upsert_candidate(
    conn: &Connection,
    name: &str,
    email: Option<&str>,
    phone: Option<&str>,
    location: Option<&str>,
) -> Result<String> {
    if let Some(e) = email {
        if !e.trim().is_empty() {
            let mut stmt = conn.prepare("SELECT id FROM candidates WHERE LOWER(email) = LOWER(?1) LIMIT 1")?;
            let existing_id: Option<String> = stmt.query_row(params![e.trim()], |row| row.get(0)).ok();
            if let Some(id) = existing_id {
                conn.execute(
                    "UPDATE candidates SET name = ?1, phone = COALESCE(?2, phone), location = COALESCE(?3, location) WHERE id = ?4",
                    params![name, phone, location, id],
                )?;
                return Ok(id);
            }
        }
    }

    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO candidates (id, name, email, phone, location) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, email, phone, location],
    )?;
    Ok(id)
}

pub fn get_candidates(conn: &Connection, job_id: &str) -> Result<Vec<CandidateWithAnalysis>> {
    let mut stmt = conn.prepare(
        "SELECT 
            COALESCE(c.id, r.id) AS id,
            COALESCE(c.name, r.file_name) AS name,
            c.email,
            c.phone,
            c.location,
            r.id AS resume_id,
            r.status AS resume_status,
            r.error_message AS resume_error,
            s.status AS shortlist_status,
            s.notes AS shortlist_notes,
            ca.id, ca.overall_score, ca.skills_score, ca.experience_score, ca.semantic_score, ca.llm_score,
            ca.rank, ca.extracted_skills, ca.matched_skills, ca.missing_skills, ca.experience_years,
            ca.education, ca.previous_roles, ca.ai_summary, ca.strengths, ca.concerns
         FROM resumes r
         LEFT JOIN candidates c ON r.candidate_id = c.id
         LEFT JOIN candidate_analysis ca ON ca.resume_id = r.id AND ca.job_id = r.job_id
         LEFT JOIN shortlists s ON s.job_id = r.job_id AND (s.candidate_id = c.id OR s.candidate_id = r.id)
         WHERE r.job_id = ?1
         ORDER BY 
            CASE WHEN ca.overall_score IS NOT NULL THEN 0 ELSE 1 END,
            ca.overall_score DESC,
            r.uploaded_at DESC"
    )?;

    let iter = stmt.query_map(params![job_id], |row| {
        let analysis_id: Option<String> = row.get(10)?;
        let analysis = if let Some(aid) = analysis_id {
            let overall: f64 = row.get(11)?;
            let skills: f64 = row.get(12)?;
            let experience: f64 = row.get(13)?;
            let semantic: f64 = row.get(14)?;
            let llm: f64 = row.get(15)?;
            let rank: i64 = row.get(16)?;
            let ext_skills_str: Option<String> = row.get(17)?;
            let matched_skills_str: Option<String> = row.get(18)?;
            let missing_skills_str: Option<String> = row.get(19)?;
            let exp_years: Option<f64> = row.get(20)?;
            let edu_str: Option<String> = row.get(21)?;
            let roles_str: Option<String> = row.get(22)?;
            let ai_sum: Option<String> = row.get(23)?;
            let strengths_str: Option<String> = row.get(24)?;
            let concerns_str: Option<String> = row.get(25)?;

            Some(CandidateAnalysis {
                id: aid,
                candidate_id: row.get(0)?,
                job_id: job_id.to_string(),
                resume_id: row.get(5)?,
                scores: ScoreBreakdown {
                    overall_score: overall,
                    skills_score: skills,
                    experience_score: experience,
                    semantic_score: semantic,
                    llm_score: llm,
                },
                rank,
                extracted_skills: ext_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                matched_skills: matched_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                missing_skills: missing_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                experience_years: exp_years,
                education: edu_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                previous_roles: roles_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                ai_summary: ai_sum,
                strengths: strengths_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                concerns: concerns_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
            })
        } else {
            None
        };

        Ok(CandidateWithAnalysis {
            id: row.get(0)?,
            name: row.get(1)?,
            email: row.get(2)?,
            phone: row.get(3)?,
            location: row.get(4)?,
            resume_id: row.get(5)?,
            resume_status: row.get(6)?,
            resume_error: row.get(7)?,
            shortlist_status: row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "pending".to_string()),
            shortlist_notes: row.get(9)?,
            analysis,
        })
    })?;

    let mut list = Vec::new();
    for item in iter {
        list.push(item?);
    }
    Ok(list)
}

pub fn get_candidate_detail(conn: &Connection, candidate_id: &str, job_id: &str) -> Result<CandidateDetail> {
    let mut stmt = conn.prepare(
        "SELECT 
            COALESCE(c.id, r.id) AS id,
            COALESCE(c.name, r.file_name) AS name,
            c.email,
            c.phone,
            c.location,
            r.id AS resume_id,
            r.status AS resume_status,
            r.error_message AS resume_error,
            r.file_name,
            r.file_path,
            r.raw_text,
            s.status AS shortlist_status,
            s.notes AS shortlist_notes,
            ca.id, ca.overall_score, ca.skills_score, ca.experience_score, ca.semantic_score, ca.llm_score,
            ca.rank, ca.extracted_skills, ca.matched_skills, ca.missing_skills, ca.experience_years,
            ca.education, ca.previous_roles, ca.ai_summary, ca.strengths, ca.concerns
         FROM resumes r
         LEFT JOIN candidates c ON r.candidate_id = c.id
         LEFT JOIN candidate_analysis ca ON ca.resume_id = r.id AND ca.job_id = r.job_id
         LEFT JOIN shortlists s ON s.job_id = r.job_id AND (s.candidate_id = c.id OR s.candidate_id = r.id)
         WHERE r.job_id = ?1 AND (c.id = ?2 OR r.id = ?2)
         LIMIT 1"
    )?;

    stmt.query_row(params![job_id, candidate_id], |row| {
        let analysis_id: Option<String> = row.get(13)?;
        let analysis = if let Some(aid) = analysis_id {
            let overall: f64 = row.get(14)?;
            let skills: f64 = row.get(15)?;
            let experience: f64 = row.get(16)?;
            let semantic: f64 = row.get(17)?;
            let llm: f64 = row.get(18)?;
            let rank: i64 = row.get(19)?;
            let ext_skills_str: Option<String> = row.get(20)?;
            let matched_skills_str: Option<String> = row.get(21)?;
            let missing_skills_str: Option<String> = row.get(22)?;
            let exp_years: Option<f64> = row.get(23)?;
            let edu_str: Option<String> = row.get(24)?;
            let roles_str: Option<String> = row.get(25)?;
            let ai_sum: Option<String> = row.get(26)?;
            let strengths_str: Option<String> = row.get(27)?;
            let concerns_str: Option<String> = row.get(28)?;

            Some(CandidateAnalysis {
                id: aid,
                candidate_id: row.get(0)?,
                job_id: job_id.to_string(),
                resume_id: row.get(5)?,
                scores: ScoreBreakdown {
                    overall_score: overall,
                    skills_score: skills,
                    experience_score: experience,
                    semantic_score: semantic,
                    llm_score: llm,
                },
                rank,
                extracted_skills: ext_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                matched_skills: matched_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                missing_skills: missing_skills_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                experience_years: exp_years,
                education: edu_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                previous_roles: roles_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                ai_summary: ai_sum,
                strengths: strengths_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
                concerns: concerns_str.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default(),
            })
        } else {
            None
        };

        Ok(CandidateDetail {
            id: row.get(0)?,
            name: row.get(1)?,
            email: row.get(2)?,
            phone: row.get(3)?,
            location: row.get(4)?,
            resume_id: row.get(5)?,
            resume_status: row.get(6)?,
            resume_error: row.get(7)?,
            file_name: row.get(8)?,
            file_path: row.get(9)?,
            raw_text: row.get(10)?,
            shortlist_status: row.get::<_, Option<String>>(11)?.unwrap_or_else(|| "pending".to_string()),
            shortlist_notes: row.get(12)?,
            analysis,
        })
    })
}

pub fn update_shortlist_status(
    conn: &Connection,
    job_id: &str,
    candidate_id: &str,
    status: &str,
    notes: Option<&str>,
) -> Result<()> {
    let shortlist_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO shortlists (id, job_id, candidate_id, status, notes, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
         ON CONFLICT(job_id, candidate_id) DO UPDATE SET
            status = excluded.status,
            notes = COALESCE(excluded.notes, shortlists.notes),
            updated_at = CURRENT_TIMESTAMP",
        params![shortlist_id, job_id, candidate_id, status, notes],
    )?;
    Ok(())
}
