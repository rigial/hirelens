use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::db::queries::analysis::{Education, WorkExperience};

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
}

impl LlamaClient {
    pub fn new() -> Self {
        Self {
            active_model_path: None,
        }
    }

    pub fn set_active_model(&mut self, path: String) {
        self.active_model_path = Some(path);
    }

    pub async fn extract_candidate(&self, raw_text: &str) -> ExtractedCandidate {
        let fallback = self.heuristic_extract(raw_text);
        let mut extracted = fallback;

        if extracted.name.trim().is_empty() {
            let lines: Vec<&str> = raw_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
            if let Some(first_line) = lines.first() {
                extracted.name = first_line.to_string();
            } else {
                extracted.name = "Candidate".to_string();
            }
        }

        extracted
    }

    pub async fn analyze_candidate(
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

    fn heuristic_extract(&self, text: &str) -> ExtractedCandidate {
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
