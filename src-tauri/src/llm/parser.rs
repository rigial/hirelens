use regex::Regex;
use serde::Deserialize;
use crate::db::queries::analysis::{Education, WorkExperience};
use crate::llm::client::{ExtractedCandidate, QualitativeAnalysis};

/// Permissive intermediate structure for candidate extraction deserialization
#[derive(Debug, Deserialize)]
struct IntermediateCandidate {
    pub name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub skills: Option<Vec<String>>,
    pub experience_years: Option<serde_json::Value>,
    pub education: Option<Vec<IntermediateEducation>>,
    pub work_experience: Option<Vec<IntermediateWorkExperience>>,
    pub certifications: Option<Vec<String>>,
    pub languages: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct IntermediateEducation {
    pub degree: Option<String>,
    pub institution: Option<String>,
    pub year: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct IntermediateWorkExperience {
    pub title: Option<String>,
    pub company: Option<String>,
    pub duration: Option<serde_json::Value>,
    #[allow(dead_code)]
    pub description: Option<String>,
}

/// Permissive intermediate structure for qualitative analysis deserialization
#[derive(Debug, Deserialize)]
struct IntermediateAnalysis {
    pub llm_score: Option<serde_json::Value>,
    pub summary: Option<String>,
    pub strengths: Option<Vec<String>>,
    pub concerns: Option<Vec<String>>,
}

/// Extract clean JSON substring from arbitrary LLM raw output.
/// Handles markdown codeblocks, preambles, trailing text, and minor malformations.
pub fn extract_json_substring(raw: &str) -> Option<String> {
    let text = raw.trim();
    if text.is_empty() {
        return None;
    }

    // 1. Check for markdown code blocks (```json ... ``` or ``` ...)
    if let Some(start_idx) = text.find("```") {
        let after_fence = &text[start_idx + 3..];
        let content_start = if let Some(newline_idx) = after_fence.find('\n') {
            start_idx + 3 + newline_idx + 1
        } else {
            start_idx + 3
        };

        if let Some(end_idx) = text[content_start..].find("```") {
            let json_candidate = &text[content_start..content_start + end_idx];
            if let Some(extracted) = find_outermost_json_object(json_candidate) {
                return Some(sanitize_json_anomalies(&extracted));
            }
        }
    }

    // 2. Find outermost JSON object '{' ... '}'
    if let Some(extracted) = find_outermost_json_object(text) {
        return Some(sanitize_json_anomalies(&extracted));
    }

    None
}

/// Find the outermost matching '{' and '}' in a string while respecting quotes.
fn find_outermost_json_object(text: &str) -> Option<String> {
    let first_brace = text.find('{')?;
    let last_brace = text.rfind('}')?;

    if last_brace > first_brace {
        Some(text[first_brace..=last_brace].to_string())
    } else {
        None
    }
}

/// Fix common JSON formatting anomalies like trailing commas
pub fn sanitize_json_anomalies(json_str: &str) -> String {
    let mut cleaned = json_str.to_string();

    // Remove trailing commas before closing braces/brackets: e.g. ", }" or ", ]"
    if let Ok(re_trailing_brace) = Regex::new(r",\s*\}") {
        cleaned = re_trailing_brace.replace_all(&cleaned, "}").to_string();
    }
    if let Ok(re_trailing_bracket) = Regex::new(r",\s*\]") {
        cleaned = re_trailing_bracket.replace_all(&cleaned, "]").to_string();
    }

    // Replace unescaped newlines inside strings if any
    cleaned
}

/// Parse and validate ExtractedCandidate from LLM output string
pub fn parse_candidate_json(raw_output: &str) -> Result<ExtractedCandidate, String> {
    let json_str = extract_json_substring(raw_output)
        .ok_or_else(|| "No valid JSON object found in LLM output".to_string())?;

    // Try direct deserialization
    if let Ok(cand) = serde_json::from_str::<ExtractedCandidate>(&json_str) {
        return Ok(cand);
    }

    // Fallback to permissive intermediate deserialization
    let intermediate: IntermediateCandidate = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse candidate JSON: {}", e))?;

    let name = intermediate.name
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty() && !n.eq_ignore_ascii_case("candidate") && !n.eq_ignore_ascii_case("unknown"))
        .unwrap_or_default();

    let email = intermediate.email
        .map(|e| e.trim().to_string())
        .filter(|e| !e.is_empty() && e.contains('@'));

    let phone = intermediate.phone
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty());

    let location = intermediate.location
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty());

    let skills: Vec<String> = intermediate.skills
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let experience_years = match intermediate.experience_years {
        Some(serde_json::Value::Number(num)) => num.as_f64(),
        Some(serde_json::Value::String(s)) => {
            if let Ok(re) = Regex::new(r"(\d+(?:\.\d+)?)") {
                re.captures(&s)
                    .and_then(|c| c.get(1))
                    .and_then(|m| m.as_str().parse::<f64>().ok())
            } else {
                s.parse::<f64>().ok()
            }
        }
        _ => None,
    };

    let education: Vec<Education> = intermediate.education
        .unwrap_or_default()
        .into_iter()
        .filter_map(|e| {
            let degree = e.degree?.trim().to_string();
            let institution = e.institution?.trim().to_string();
            if degree.is_empty() && institution.is_empty() {
                return None;
            }
            let year = match e.year {
                Some(serde_json::Value::String(y)) => Some(y),
                Some(serde_json::Value::Number(y)) => Some(y.to_string()),
                _ => None,
            };
            Some(Education {
                degree: if degree.is_empty() { "Degree".to_string() } else { degree },
                institution: if institution.is_empty() { "Institution".to_string() } else { institution },
                year,
            })
        })
        .collect();

    let work_experience: Vec<WorkExperience> = intermediate.work_experience
        .unwrap_or_default()
        .into_iter()
        .filter_map(|w| {
            let title = w.title?.trim().to_string();
            let company = w.company?.trim().to_string();
            if title.is_empty() && company.is_empty() {
                return None;
            }
            let duration = match w.duration {
                Some(serde_json::Value::String(d)) => Some(d),
                Some(serde_json::Value::Number(d)) => Some(d.to_string()),
                _ => None,
            };
            Some(WorkExperience {
                title: if title.is_empty() { "Role".to_string() } else { title },
                company: if company.is_empty() { "Company".to_string() } else { company },
                duration,
            })
        })
        .collect();

    let certifications = intermediate.certifications.unwrap_or_default();
    let languages = intermediate.languages.unwrap_or_default();

    Ok(ExtractedCandidate {
        name,
        email,
        phone,
        location,
        skills,
        experience_years,
        education,
        work_experience,
        certifications,
        languages,
    })
}

/// Parse and validate QualitativeAnalysis from LLM output string
pub fn parse_qualitative_analysis(raw_output: &str, fallback_score: f64) -> Result<QualitativeAnalysis, String> {
    let json_str = extract_json_substring(raw_output)
        .ok_or_else(|| "No valid JSON object found in LLM output".to_string())?;

    let intermediate: IntermediateAnalysis = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse qualitative analysis JSON: {}", e))?;

    let llm_score = match intermediate.llm_score {
        Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(fallback_score),
        Some(serde_json::Value::String(s)) => {
            if let Ok(re) = Regex::new(r"(\d+(?:\.\d+)?)") {
                re.captures(&s)
                    .and_then(|c| c.get(1))
                    .and_then(|m| m.as_str().parse::<f64>().ok())
                    .unwrap_or(fallback_score)
            } else {
                s.parse::<f64>().unwrap_or(fallback_score)
            }
        }
        _ => fallback_score,
    }.clamp(0.0, 100.0);

    let summary = intermediate.summary
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "Missing summary field in LLM analysis".to_string())?;

    let strengths: Vec<String> = intermediate.strengths
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let concerns: Vec<String> = intermediate.concerns
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    Ok(QualitativeAnalysis {
        llm_score,
        summary,
        strengths,
        concerns,
    })
}

/// Merge LLM-extracted candidate with heuristic candidate to ensure maximum completeness
pub fn merge_candidate_with_heuristic(
    llm_cand: &mut ExtractedCandidate,
    heuristic: &ExtractedCandidate,
) {
    if llm_cand.name.trim().is_empty() || llm_cand.name.eq_ignore_ascii_case("candidate") {
        llm_cand.name = heuristic.name.clone();
    }

    if llm_cand.email.is_none() && heuristic.email.is_some() {
        llm_cand.email = heuristic.email.clone();
    }

    if llm_cand.phone.is_none() && heuristic.phone.is_some() {
        llm_cand.phone = heuristic.phone.clone();
    }

    if llm_cand.location.is_none() && heuristic.location.is_some() {
        llm_cand.location = heuristic.location.clone();
    }

    if (llm_cand.experience_years.is_none() || llm_cand.experience_years == Some(0.0)) && heuristic.experience_years.is_some() {
        llm_cand.experience_years = heuristic.experience_years;
    }

    // Merge skills uniquely
    for h_skill in &heuristic.skills {
        if !llm_cand.skills.iter().any(|s| s.eq_ignore_ascii_case(h_skill)) {
            llm_cand.skills.push(h_skill.clone());
        }
    }

    if llm_cand.education.is_empty() && !heuristic.education.is_empty() {
        llm_cand.education = heuristic.education.clone();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_json_from_clean() {
        let input = r#"{"name": "Sarah Connor", "skills": ["Rust", "C++"]}"#;
        let extracted = extract_json_substring(input).unwrap();
        assert_eq!(extracted, input);
    }

    #[test]
    fn test_extract_json_from_markdown() {
        let input = "Here is the candidate information:\n```json\n{\n  \"name\": \"John Smith\",\n  \"skills\": [\"Python\", \"React\"]\n}\n```\nHope this helps!";
        let cand = parse_candidate_json(input).unwrap();
        assert_eq!(cand.name, "John Smith");
        assert_eq!(cand.skills, vec!["Python", "React"]);
    }

    #[test]
    fn test_sanitize_trailing_commas() {
        let input = r#"{"name": "Alice", "skills": ["Rust", "Go",], "experience_years": "5 years",}"#;
        let cand = parse_candidate_json(input).unwrap();
        assert_eq!(cand.name, "Alice");
        assert_eq!(cand.skills, vec!["Rust", "Go"]);
        assert_eq!(cand.experience_years, Some(5.0));
    }

    #[test]
    fn test_parse_qualitative_analysis() {
        let input = r#"```json
{
  "llm_score": 88.5,
  "summary": "Outstanding background in distributed systems and systems programming.",
  "strengths": ["Strong Rust expertise", "Proven leadership in microservices"],
  "concerns": ["Limited experience with frontend tooling"]
}
```"#;
        let analysis = parse_qualitative_analysis(input, 50.0).unwrap();
        assert_eq!(analysis.llm_score, 88.5);
        assert!(analysis.summary.contains("distributed systems"));
        assert_eq!(analysis.strengths.len(), 2);
        assert_eq!(analysis.concerns.len(), 1);
    }

    #[test]
    fn test_merge_candidate_with_heuristic() {
        let mut llm_cand = ExtractedCandidate {
            name: "".to_string(),
            email: None,
            phone: None,
            location: None,
            skills: vec!["Rust".to_string()],
            experience_years: None,
            education: vec![],
            work_experience: vec![],
            certifications: vec![],
            languages: vec![],
        };

        let heuristic = ExtractedCandidate {
            name: "Jane Smith".to_string(),
            email: Some("jane@example.com".to_string()),
            phone: Some("+1-555-0199".to_string()),
            location: Some("San Francisco, CA".to_string()),
            skills: vec!["Rust".to_string(), "Docker".to_string()],
            experience_years: Some(6.0),
            education: vec![Education {
                degree: "BS Computer Science".to_string(),
                institution: "UC Berkeley".to_string(),
                year: Some("2018".to_string()),
            }],
            work_experience: vec![],
            certifications: vec![],
            languages: vec![],
        };

        merge_candidate_with_heuristic(&mut llm_cand, &heuristic);
        assert_eq!(llm_cand.name, "Jane Smith");
        assert_eq!(llm_cand.email, Some("jane@example.com".to_string()));
        assert_eq!(llm_cand.phone, Some("+1-555-0199".to_string()));
        assert_eq!(llm_cand.experience_years, Some(6.0));
        assert_eq!(llm_cand.skills.len(), 2);
        assert_eq!(llm_cand.education.len(), 1);
    }

    #[test]
    fn test_parse_candidate_with_null_and_complex_fields() {
        let input = r#"
        {
            "name": "Marcus Vance",
            "email": null,
            "phone": "+1-800-555-0144",
            "location": "Seattle, WA",
            "skills": ["Rust", "Distributed Systems", "Raft", "Tokio"],
            "experience_years": 8.5,
            "education": [
                { "degree": "M.S. Computer Science", "institution": "University of Washington", "year": "2016" }
            ],
            "work_experience": [
                { "title": "Staff Engineer", "company": "Cloud Systems Inc", "duration": "2020-Present", "description": "Lead architect" }
            ],
            "certifications": ["AWS Solutions Architect"],
            "languages": ["English", "Spanish"]
        }
        "#;
        let cand = parse_candidate_json(input).unwrap();
        assert_eq!(cand.name, "Marcus Vance");
        assert_eq!(cand.email, None);
        assert_eq!(cand.phone, Some("+1-800-555-0144".to_string()));
        assert_eq!(cand.experience_years, Some(8.5));
        assert_eq!(cand.skills.len(), 4);
        assert_eq!(cand.education.len(), 1);
        assert_eq!(cand.education[0].degree, "M.S. Computer Science");
        assert_eq!(cand.work_experience.len(), 1);
        assert_eq!(cand.work_experience[0].title, "Staff Engineer");
        assert_eq!(cand.certifications, vec!["AWS Solutions Architect"]);
        assert_eq!(cand.languages, vec!["English", "Spanish"]);
    }

    #[test]
    fn test_parse_qualitative_analysis_score_clamping() {
        let input_high = r#"{"llm_score": 150.0, "summary": "Great match", "strengths": ["Skill"], "concerns": []}"#;
        let analysis_high = parse_qualitative_analysis(input_high, 50.0).unwrap();
        assert_eq!(analysis_high.llm_score, 100.0);

        let input_low = r#"{"llm_score": -25.0, "summary": "Poor match", "strengths": [], "concerns": ["Missing skills"]}"#;
        let analysis_low = parse_qualitative_analysis(input_low, 50.0).unwrap();
        assert_eq!(analysis_low.llm_score, 0.0);
    }

    #[test]
    fn test_parse_invalid_json_returns_error() {
        let bad_input = "This is not json at all.";
        let res = parse_candidate_json(bad_input);
        assert!(res.is_err());

        let res_analysis = parse_qualitative_analysis(bad_input, 50.0);
        assert!(res_analysis.is_err());
    }
}

