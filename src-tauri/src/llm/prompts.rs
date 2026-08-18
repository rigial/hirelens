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
