use std::collections::HashSet;

pub fn compute_semantic_similarity(resume_text: &str, job_description: &str) -> f64 {
    if resume_text.trim().is_empty() || job_description.trim().is_empty() {
        return 50.0;
    }

    let tokenize = |text: &str| -> HashSet<String> {
        text.to_lowercase()
            .split(|c: char| !c.is_alphanumeric())
            .filter(|w| w.len() > 2)
            .map(|w| w.to_string())
            .collect()
    };

    let resume_tokens = tokenize(resume_text);
    let job_tokens = tokenize(job_description);

    if job_tokens.is_empty() {
        return 80.0;
    }

    let intersection_count = resume_tokens.intersection(&job_tokens).count();
    let overlap_ratio = intersection_count as f64 / job_tokens.len() as f64;

    // Scale overlap ratio to 0-100 with smooth sigmoid-like curve
    let score = (overlap_ratio * 120.0 + 30.0).clamp(20.0, 96.0);
    score
}
