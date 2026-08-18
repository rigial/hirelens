use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::db::queries::analysis::{Education, WorkExperience};
use crate::llm::engine::{GenerationConfig, GgufEngine};
use crate::llm::parser::{
    merge_candidate_with_heuristic, parse_candidate_json, parse_qualitative_analysis,
};
use crate::llm::prompts::{
    build_analysis_prompt, build_analysis_retry_prompt, build_extraction_prompt,
    build_extraction_retry_prompt,
};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ExtractedCandidate {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub location: Option<String>,
    pub skills: Vec<String>,
    pub experience_years: Option<f64>,
    pub education: Vec<Education>,
    pub work_experience: Vec<WorkExperience>,
    #[serde(default)]
    pub certifications: Vec<String>,
    #[serde(default)]
    pub languages: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QualitativeAnalysis {
    pub llm_score: f64,
    pub summary: String,
    pub strengths: Vec<String>,
    pub concerns: Vec<String>,
}

pub struct LlamaClient {
    pub active_model_path: Option<String>,
    engine: Option<GgufEngine>,
}

impl LlamaClient {
    pub fn new() -> Self {
        Self {
            active_model_path: None,
            engine: None,
        }
    }

    pub fn is_model_loaded(&self) -> bool {
        self.engine.is_some()
    }

    pub fn set_active_model(&mut self, path: String) {
        if let Some(ref current_path) = self.active_model_path {
            if current_path == &path && self.engine.is_some() {
                return;
            }
        }

        if !std::path::Path::new(&path).exists() {
            eprintln!("Model file not found at: {}", path);
            self.active_model_path = Some(path);
            self.engine = None;
            return;
        }

        println!("Loading on-device GGUF model from: {}", path);
        match GgufEngine::load(&path) {
            Ok(eng) => {
                println!("Successfully loaded GGUF model: {}", path);
                self.engine = Some(eng);
                self.active_model_path = Some(path);
            }
            Err(err) => {
                eprintln!("Failed to load GGUF model {}: {}", path, err);
                self.active_model_path = Some(path);
                self.engine = None;
            }
        }
    }

    pub fn unload_active_model(&mut self) {
        self.engine = None;
        self.active_model_path = None;
    }

    pub async fn extract_candidate(&mut self, raw_text: &str) -> ExtractedCandidate {
        let mut fallback = self.heuristic_extract(raw_text);

        if fallback.name.trim().is_empty() {
            let lines: Vec<&str> = raw_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
            if let Some(first_line) = lines.first() {
                fallback.name = first_line.to_string();
            } else {
                fallback.name = "Candidate".to_string();
            }
        }

        if let Some(ref mut engine) = self.engine {
            let prompt = build_extraction_prompt(raw_text);
            let config = GenerationConfig {
                temperature: 0.1,
                top_p: 0.9,
                max_tokens: 1024,
                repeat_penalty: 1.1,
                repeat_last_n: 64,
            };

            let inference_result = engine.generate(&prompt, &config);
            match inference_result {
                Ok(raw_output) => {
                    let parse_result = parse_candidate_json(&raw_output);
                    match parse_result {
                        Ok(mut candidate) => {
                            merge_candidate_with_heuristic(&mut candidate, &fallback);
                            return candidate;
                        }
                        Err(parse_err) => {
                            eprintln!("Initial LLM JSON parsing failed: {}. Retrying with schema feedback...", parse_err);
                            let retry_prompt = build_extraction_retry_prompt(&raw_output, raw_text);
                            if let Ok(retry_output) = engine.generate(&retry_prompt, &config) {
                                if let Ok(mut retry_cand) = parse_candidate_json(&retry_output) {
                                    merge_candidate_with_heuristic(&mut retry_cand, &fallback);
                                    return retry_cand;
                                }
                            }
                        }
                    }
                }
                Err(err) => {
                    eprintln!("GGUF candidate extraction generation failed: {}. Falling back to heuristic extractor.", err);
                }
            }
        }

        fallback
    }

    pub async fn analyze_candidate(
        &mut self,
        candidate: &ExtractedCandidate,
        job_title: &str,
        job_skills: &[String],
        experience_required: Option<f64>,
        job_desc: &str,
        deterministic_score: f64,
    ) -> QualitativeAnalysis {
        let fallback = self.heuristic_analyze(
            candidate,
            job_title,
            job_skills,
            experience_required,
            job_desc,
            deterministic_score,
        );

        if let Some(ref mut engine) = self.engine {
            let prompt = build_analysis_prompt(
                job_title,
                job_skills,
                experience_required,
                job_desc,
                &candidate.name,
                &candidate.skills,
                candidate.experience_years,
                &candidate.education,
                &candidate.work_experience,
                deterministic_score,
            );

            let config = GenerationConfig {
                temperature: 0.2,
                top_p: 0.9,
                max_tokens: 512,
                repeat_penalty: 1.15,
                repeat_last_n: 64,
            };

            let inference_result = engine.generate(&prompt, &config);
            match inference_result {
                Ok(raw_output) => {
                    let parse_result = parse_qualitative_analysis(&raw_output, deterministic_score);
                    match parse_result {
                        Ok(analysis) => return analysis,
                        Err(parse_err) => {
                            eprintln!("Initial LLM analysis JSON parsing failed: {}. Retrying...", parse_err);
                            let retry_prompt = build_analysis_retry_prompt(&raw_output);
                            if let Ok(retry_output) = engine.generate(&retry_prompt, &config) {
                                if let Ok(retry_analysis) = parse_qualitative_analysis(&retry_output, deterministic_score) {
                                    return retry_analysis;
                                }
                            }
                        }
                    }
                }
                Err(err) => {
                    eprintln!("GGUF qualitative analysis generation failed: {}. Falling back to rule-based analysis.", err);
                }
            }
        }

        fallback
    }

    pub fn heuristic_analyze(
        &self,
        candidate: &ExtractedCandidate,
        job_title: &str,
        job_skills: &[String],
        experience_required: Option<f64>,
        _job_desc: &str,
        deterministic_score: f64,
    ) -> QualitativeAnalysis {
        let mut strengths = Vec::new();
        let mut concerns = Vec::new();

        let matched_skills_count = candidate.skills.iter().filter(|s| {
            job_skills.iter().any(|js| js.to_lowercase().contains(&s.to_lowercase()) || s.to_lowercase().contains(&js.to_lowercase()))
        }).count();

        if matched_skills_count > 0 {
            strengths.push(format!("Demonstrated proficiency across {} relevant technical competencies", matched_skills_count));
        }

        if let Some(cand_exp) = candidate.experience_years {
            if let Some(req_exp) = experience_required {
                if cand_exp >= req_exp {
                    strengths.push(format!("Meets or exceeds experience requirement with {:.1} years in the field", cand_exp));
                } else {
                    concerns.push(format!("Has {:.1} years of experience vs {:.1} years specified for this position", cand_exp, req_exp));
                }
            } else {
                strengths.push(format!("Brings {:.1} years of professional background", cand_exp));
            }
        }

        if !candidate.education.is_empty() {
            if let Some(edu) = candidate.education.first() {
                strengths.push(format!("Educational credential: {} from {}", edu.degree, edu.institution));
            }
        }

        if matched_skills_count == 0 && !job_skills.is_empty() {
            concerns.push("Key required tech stack keywords not explicitly highlighted in resume".to_string());
        }

        let summary = format!(
            "{} presents a profile for the {} position with a baseline deterministic match of {:.0}%. Demonstrates experience in {} with notable background across relevant projects.",
            candidate.name,
            job_title,
            deterministic_score,
            if !candidate.skills.is_empty() { candidate.skills.iter().take(3).cloned().collect::<Vec<_>>().join(", ") } else { "core engineering disciplines".to_string() }
        );

        let llm_score = (deterministic_score * 0.7 + 25.0).clamp(10.0, 98.0);

        QualitativeAnalysis {
            llm_score,
            summary,
            strengths,
            concerns,
        }
    }

    pub fn heuristic_extract(&self, text: &str) -> ExtractedCandidate {
        let mut name = String::new();
        let mut email = None;
        let mut phone = None;
        let location = None;
        let mut skills = Vec::new();
        let mut experience_years = None;
        let mut education = Vec::new();
        let work_experience = Vec::new();

        // 1. Email Regex
        if let Ok(email_re) = Regex::new(r"(?i)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}") {
            if let Some(mat) = email_re.find(text) {
                email = Some(mat.as_str().to_string());
            }
        }

        // 2. Phone Regex
        if let Ok(phone_re) = Regex::new(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}") {
            if let Some(mat) = phone_re.find(text) {
                phone = Some(mat.as_str().to_string());
            }
        }

        // 3. Name heuristic
        for line in text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()) {
            if !line.contains('@') && !line.contains("http") && !line.contains(".com") && line.len() < 50 && line.split_whitespace().count() >= 2 && line.split_whitespace().count() <= 4 {
                name = line.to_string();
                break;
            }
        }

        // 4. Skills extraction against comprehensive tech catalog
        let tech_dictionary = [
            "Rust", "Python", "JavaScript", "TypeScript", "React", "React Native", "Next.js", "Vue", "Angular",
            "Node.js", "Express", "Django", "FastAPI", "Flask", "Go", "Golang", "C++", "C#", ".NET", "Java",
            "Spring Boot", "Kotlin", "Swift", "Flutter", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis",
            "SQLite", "GraphQL", "REST API", "Docker", "Kubernetes", "AWS", "GCP", "Azure", "CI/CD", "Git",
            "Linux", "Terraform", "Tailwind CSS", "Redux", "Zustand", "Jest", "PyTest", "Machine Learning",
            "PyTorch", "TensorFlow", "Pandas", "NumPy", "Scikit-Learn", "NLP", "LLM", "Kafka", "RabbitMQ"
        ];

        let text_lower = text.to_lowercase();
        for tech in tech_dictionary {
            let pattern = format!(r"(?i)\b{}\b", regex::escape(tech));
            if let Ok(re) = Regex::new(&pattern) {
                if re.is_match(&text_lower) {
                    skills.push(tech.to_string());
                }
            }
        }

        // 5. Experience years estimation
        if let Ok(exp_re) = Regex::new(r"(?i)(\d+(?:\.\d+)?)\+?\s*(?:years|yrs|year)\s*(?:of)?\s*(?:experience|exp)?") {
            if let Some(caps) = exp_re.captures(text) {
                if let Some(m) = caps.get(1) {
                    if let Ok(val) = m.as_str().parse::<f64>() {
                        if val > 0.0 && val < 40.0 {
                            experience_years = Some(val);
                        }
                    }
                }
            }
        }

        // 6. Education heuristic
        let degrees = ["Bachelor", "B.Tech", "B.E.", "B.S.", "BS", "Master", "M.Tech", "M.S.", "MS", "Ph.D", "PhD", "Associate Degree"];
        for line in text.lines() {
            for deg in degrees {
                if line.to_lowercase().contains(&deg.to_lowercase()) {
                    education.push(Education {
                        degree: deg.to_string(),
                        institution: line.trim().to_string(),
                        year: None,
                    });
                    break;
                }
            }
            if education.len() >= 2 {
                break;
            }
        }

        ExtractedCandidate {
            name,
            email,
            phone,
            location,
            skills,
            experience_years,
            education,
            work_experience,
            certifications: Vec::new(),
            languages: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_llama_client_fallback_extraction() {
        let mut client = LlamaClient::new();
        assert!(!client.is_model_loaded());

        let resume_text = r#"
John Doe
johndoe@example.com
+1 (555) 123-4567

Summary:
Experienced Software Engineer with 7 years of experience in backend development.

Skills:
Rust, Python, Docker, PostgreSQL, AWS, Git

Education:
Bachelor of Science in Computer Science, Stanford University
        "#;

        let candidate = client.extract_candidate(resume_text).await;
        assert_eq!(candidate.name, "John Doe");
        assert_eq!(candidate.email, Some("johndoe@example.com".to_string()));
        assert!(candidate.skills.contains(&"Rust".to_string()));
        assert!(candidate.skills.contains(&"Docker".to_string()));
        assert_eq!(candidate.experience_years, Some(7.0));
        assert!(!candidate.education.is_empty());
    }

    #[tokio::test]
    async fn test_llama_client_fallback_analysis() {
        let mut client = LlamaClient::new();
        let candidate = ExtractedCandidate {
            name: "Jane Smith".to_string(),
            email: Some("jane@example.com".to_string()),
            phone: None,
            location: None,
            skills: vec!["Rust".to_string(), "PostgreSQL".to_string(), "Docker".to_string()],
            experience_years: Some(5.0),
            education: vec![Education {
                degree: "BS Computer Science".to_string(),
                institution: "MIT".to_string(),
                year: Some("2019".to_string()),
            }],
            work_experience: vec![],
            certifications: vec![],
            languages: vec![],
        };

        let job_skills = vec!["Rust".to_string(), "PostgreSQL".to_string(), "Kubernetes".to_string()];
        let analysis = client.analyze_candidate(
            &candidate,
            "Senior Rust Engineer",
            &job_skills,
            Some(4.0),
            "We are looking for a Senior Rust Engineer...",
            80.0,
        ).await;

        assert!(analysis.llm_score >= 10.0 && analysis.llm_score <= 98.0);
        assert!(!analysis.summary.is_empty());
        assert!(!analysis.strengths.is_empty());
    }
}
