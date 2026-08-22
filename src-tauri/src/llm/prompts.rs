use crate::db::queries::analysis::{Education, WorkExperience};

pub const EXTRACTION_PROMPT: &str = r#"You are a precise resume parser. Extract information from the resume text below.

Return ONLY a valid JSON object — no explanation, no markdown, no extra text.

JSON schema (use null for missing fields):
{
  "name": "string",
  "email": "string | null",
  "phone": "string | null",
  "location": "string | null",
  "skills": ["string"],
  "experience_years": 0.0,
  "education": [
    { "degree": "string", "institution": "string", "year": "string | null" }
  ],
  "work_experience": [
    { "title": "string", "company": "string", "duration": "string | null", "description": "string | null" }
  ],
  "projects": [
    { "name": "string", "description": "string | null", "technologies": ["string"] }
  ],
  "certifications": ["string"],
  "languages": ["string"]
}

Resume text:
---
{raw_text}
---"#;

pub const ANALYSIS_PROMPT: &str = r#"You are an expert HR analyst evaluating a candidate for a job role.

Job Title: {job_title}
Required Skills: {required_skills}
Experience Required: {experience_required} years
Job Description Summary: {job_description_first_500_chars}

Candidate Name: {candidate_name}
Candidate Skills: {candidate_skills}
Experience: {candidate_experience} years
Education: {candidate_education}
Previous Roles: {candidate_roles}
Deterministic Match Score: {deterministic_score}/100

Evaluate this candidate's qualitative fit for the role.
Return ONLY valid JSON — no markdown, no explanation:
{
  "llm_score": 85.0,
  "summary": "string (2–3 sentences, professional tone)",
  "strengths": ["string (up to 4 items)"],
  "concerns": ["string (up to 3 items, or empty array if none)"]
}"#;

pub const EXTRACTION_SCHEMA_HINT: &str = r#"{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "location": "City, Country",
  "skills": ["Skill 1", "Skill 2"],
  "experience_years": 5.0,
  "education": [{"degree": "Degree", "institution": "University", "year": "2020"}],
  "work_experience": [{"title": "Role", "company": "Company", "duration": "2020-Present"}]
}"#;

pub const ANALYSIS_SCHEMA_HINT: &str = r#"{
  "llm_score": 85.0,
  "summary": "Brief 2-3 sentence assessment.",
  "strengths": ["Strength 1", "Strength 2"],
  "concerns": ["Concern 1"]
}"#;

pub fn build_extraction_prompt(raw_text: &str) -> String {
    // Truncate raw text to 6000 chars to avoid exceeding model context limits
    let truncated_text: String = raw_text.chars().take(6000).collect();
    EXTRACTION_PROMPT.replace("{raw_text}", &truncated_text)
}

pub fn build_extraction_retry_prompt(bad_output: &str, raw_text: &str) -> String {
    let truncated_text: String = raw_text.chars().take(4000).collect();
    let truncated_bad: String = bad_output.chars().take(1000).collect();
    format!(
        "Your previous response was not valid JSON:\n{}\n\nRe-parse the resume below and return ONLY valid JSON matching this schema:\n{}\n\nResume text:\n{}",
        truncated_bad, EXTRACTION_SCHEMA_HINT, truncated_text
    )
}

#[allow(clippy::too_many_arguments)]
pub fn build_analysis_prompt(
    job_title: &str,
    required_skills: &[String],
    min_experience_required: Option<f64>,
    max_experience_required: Option<f64>,
    job_description: &str,
    candidate_name: &str,
    candidate_skills: &[String],
    candidate_experience: Option<f64>,
    candidate_education: &[Education],
    candidate_roles: &[WorkExperience],
    deterministic_score: f64,
) -> String {
    let req_skills_str = if required_skills.is_empty() {
        "None specified".to_string()
    } else {
        required_skills.join(", ")
    };

    let exp_req_str = match (min_experience_required, max_experience_required) {
        (Some(min), Some(max)) if min > 0.0 && max > 0.0 => {
            if (min - max).abs() < 1e-4 {
                format!("{:.1}", min).replace(".0", "") + " years"
            } else {
                format!("{:.1} - {:.1} years", min, max).replace(".0", "")
            }
        }
        (Some(min), _) if min > 0.0 => format!("{:.1}+ years", min).replace(".0", ""),
        (_, Some(max)) if max > 0.0 => format!("Up to {:.1} years", max).replace(".0", ""),
        _ => "Not specified".to_string(),
    };

    let job_desc_summary: String = job_description.chars().take(500).collect();

    let cand_skills_str = if candidate_skills.is_empty() {
        "None extracted".to_string()
    } else {
        candidate_skills.join(", ")
    };

    let cand_exp_str = candidate_experience
        .map(|e| format!("{:.1}", e))
        .unwrap_or_else(|| "Not specified".to_string());

    let cand_edu_str = if candidate_education.is_empty() {
        "None listed".to_string()
    } else {
        candidate_education
            .iter()
            .map(|e| format!("{} ({})", e.degree, e.institution))
            .collect::<Vec<_>>()
            .join("; ")
    };

    let cand_roles_str = if candidate_roles.is_empty() {
        "None listed".to_string()
    } else {
        candidate_roles
            .iter()
            .map(|r| format!("{} at {}", r.title, r.company))
            .collect::<Vec<_>>()
            .join("; ")
    };

    ANALYSIS_PROMPT
        .replace("{job_title}", job_title)
        .replace("{required_skills}", &req_skills_str)
        .replace("{experience_required}", &exp_req_str)
        .replace("{job_description_first_500_chars}", &job_desc_summary)
        .replace("{candidate_name}", candidate_name)
        .replace("{candidate_skills}", &cand_skills_str)
        .replace("{candidate_experience}", &cand_exp_str)
        .replace("{candidate_education}", &cand_edu_str)
        .replace("{candidate_roles}", &cand_roles_str)
        .replace("{deterministic_score}", &format!("{:.1}", deterministic_score))
}

pub fn build_analysis_retry_prompt(bad_output: &str) -> String {
    let truncated_bad: String = bad_output.chars().take(1000).collect();
    format!(
        "Your previous response was not valid JSON:\n{}\n\nPlease return ONLY valid JSON matching this exact structure:\n{}",
        truncated_bad, ANALYSIS_SCHEMA_HINT
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_extraction_prompt() {
        let resume_text = "Jane Doe\nRust Developer with 5 years experience.";
        let prompt = build_extraction_prompt(resume_text);
        assert!(prompt.contains("Jane Doe"));
        assert!(prompt.contains("Rust Developer"));
        assert!(prompt.contains("JSON schema"));
    }

    #[test]
    fn test_build_analysis_prompt() {
        let prompt = build_analysis_prompt(
            "Rust Backend Engineer",
            &["Rust".to_string(), "PostgreSQL".to_string()],
            Some(2.0),
            Some(4.0),
            "Building high performance microservices.",
            "Alex Smith",
            &["Rust".to_string(), "gRPC".to_string()],
            Some(5.0),
            &[Education {
                degree: "BS CS".to_string(),
                institution: "Stanford".to_string(),
                year: Some("2019".to_string()),
            }],
            &[WorkExperience {
                title: "Software Engineer".to_string(),
                company: "Tech Co".to_string(),
                duration: Some("2019-2024".to_string()),
            }],
            85.0,
        );

        assert!(prompt.contains("Job Title: Rust Backend Engineer"));
        assert!(prompt.contains("Required Skills: Rust, PostgreSQL"));
        assert!(prompt.contains("Experience Required: 2 - 4 years"));
        assert!(prompt.contains("Candidate Name: Alex Smith"));
        assert!(prompt.contains("Candidate Skills: Rust, gRPC"));
        assert!(prompt.contains("BS CS (Stanford)"));
        assert!(prompt.contains("Software Engineer at Tech Co"));
        assert!(prompt.contains("Deterministic Match Score: 85.0/100"));
    }

    #[test]
    fn test_build_retry_prompts() {
        let ext_retry = build_extraction_retry_prompt("{ invalid json }", "Sample Resume");
        assert!(ext_retry.contains("{ invalid json }"));
        assert!(ext_retry.contains("Sample Resume"));

        let ana_retry = build_analysis_retry_prompt("Malformed response");
        assert!(ana_retry.contains("Malformed response"));
        assert!(ana_retry.contains("llm_score"));
    }
}
