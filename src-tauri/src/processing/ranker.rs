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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_final_score_weights() {
        // skills: 40%, exp: 25%, semantic: 20%, llm: 15%
        let scores = compute_final_score(100.0, 100.0, 100.0, 100.0);
        assert_eq!(scores.overall_score, 100.0);
        assert_eq!(scores.semantic_score, 100.0);

        let scores2 = compute_final_score(80.0, 60.0, 90.0, 70.0);
        // (80 * 0.40) + (60 * 0.25) + (90 * 0.20) + (70 * 0.15)
        // = 32.0 + 15.0 + 18.0 + 10.5 = 75.5
        assert_eq!(scores2.overall_score, 75.5);
        assert_eq!(scores2.skills_score, 80.0);
        assert_eq!(scores2.experience_score, 60.0);
        assert_eq!(scores2.semantic_score, 90.0);
        assert_eq!(scores2.llm_score, 70.0);
    }
}

