use crate::db::queries::analysis::ScoreBreakdown;

pub fn compute_final_score(
    skills_score: f64,
    experience_score: f64,
    semantic_score: f64,
    llm_score: f64,
) -> ScoreBreakdown {
    let overall = (skills_score * 0.40)
        + (experience_score * 0.25)
        + (semantic_score * 0.20)
        + (llm_score * 0.15);

    ScoreBreakdown {
        overall_score: (overall * 10.0).round() / 10.0,
        skills_score: (skills_score * 10.0).round() / 10.0,
        experience_score: (experience_score * 10.0).round() / 10.0,
        semantic_score: (semantic_score * 10.0).round() / 10.0,
        llm_score: (llm_score * 10.0).round() / 10.0,
    }
}
