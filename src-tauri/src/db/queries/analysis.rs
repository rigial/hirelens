use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MatchedSkill {
    pub skill: String,
    pub importance: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    pub overall_score: f64,
    pub skills_score: f64,
    pub experience_score: f64,
    pub semantic_score: f64,
    pub llm_score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Education {
    pub degree: String,
    pub institution: String,
    pub year: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkExperience {
    pub title: String,
    pub company: String,
    pub duration: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CandidateAnalysis {
    pub id: String,
    pub candidate_id: String,
    pub job_id: String,
    pub resume_id: String,
    pub scores: ScoreBreakdown,
    pub rank: i64,
    pub extracted_skills: Vec<String>,
    pub matched_skills: Vec<MatchedSkill>,
    pub missing_skills: Vec<MatchedSkill>,
    pub experience_years: Option<f64>,
    pub education: Vec<Education>,
    pub previous_roles: Vec<WorkExperience>,
    pub ai_summary: Option<String>,
    pub strengths: Vec<String>,
    pub concerns: Vec<String>,
}

#[allow(clippy::too_many_arguments)]
pub fn upsert_analysis(
    conn: &Connection,
    analysis_id: &str,
    candidate_id: &str,
    job_id: &str,
    resume_id: &str,
    scores: &ScoreBreakdown,
    extracted_skills: &[String],
    matched_skills: &[MatchedSkill],
    missing_skills: &[MatchedSkill],
    experience_years: Option<f64>,
    education: &[Education],
    previous_roles: &[WorkExperience],
    ai_summary: Option<&str>,
    strengths: &[String],
    concerns: &[String],
) -> Result<()> {
    let extracted_skills_json = serde_json::to_string(extracted_skills).unwrap_or_else(|_| "[]".to_string());
    let matched_skills_json = serde_json::to_string(matched_skills).unwrap_or_else(|_| "[]".to_string());
    let missing_skills_json = serde_json::to_string(missing_skills).unwrap_or_else(|_| "[]".to_string());
    let education_json = serde_json::to_string(education).unwrap_or_else(|_| "[]".to_string());
    let previous_roles_json = serde_json::to_string(previous_roles).unwrap_or_else(|_| "[]".to_string());
    let strengths_json = serde_json::to_string(strengths).unwrap_or_else(|_| "[]".to_string());
    let concerns_json = serde_json::to_string(concerns).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "INSERT INTO candidate_analysis (
            id, candidate_id, job_id, resume_id, overall_score, skills_score, experience_score,
            semantic_score, llm_score, extracted_skills, matched_skills, missing_skills,
            experience_years, education, previous_roles, ai_summary, strengths, concerns
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
        )
        ON CONFLICT(resume_id, job_id) DO UPDATE SET
            candidate_id = excluded.candidate_id,
            overall_score = excluded.overall_score,
            skills_score = excluded.skills_score,
            experience_score = excluded.experience_score,
            semantic_score = excluded.semantic_score,
            llm_score = excluded.llm_score,
            extracted_skills = excluded.extracted_skills,
            matched_skills = excluded.matched_skills,
            missing_skills = excluded.missing_skills,
            experience_years = excluded.experience_years,
            education = excluded.education,
            previous_roles = excluded.previous_roles,
            ai_summary = excluded.ai_summary,
            strengths = excluded.strengths,
            concerns = excluded.concerns,
            updated_at = CURRENT_TIMESTAMP",
        params![
            analysis_id,
            candidate_id,
            job_id,
            resume_id,
            scores.overall_score,
            scores.skills_score,
            scores.experience_score,
            scores.semantic_score,
            scores.llm_score,
            extracted_skills_json,
            matched_skills_json,
            missing_skills_json,
            experience_years,
            education_json,
            previous_roles_json,
            ai_summary,
            strengths_json,
            concerns_json,
        ],
    )?;

    // Recalculate ranks for the job
    recalculate_ranks(conn, job_id)?;

    Ok(())
}

pub fn recalculate_ranks(conn: &Connection, job_id: &str) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT id FROM candidate_analysis WHERE job_id = ?1 ORDER BY overall_score DESC"
    )?;

    let ids: Vec<String> = stmt
        .query_map(params![job_id], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    for (index, id) in ids.iter().enumerate() {
        let rank = (index + 1) as i64;
        conn.execute(
            "UPDATE candidate_analysis SET rank = ?1 WHERE id = ?2",
            params![rank, id],
        )?;
    }

    Ok(())
}
