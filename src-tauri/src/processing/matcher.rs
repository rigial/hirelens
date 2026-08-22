use crate::db::queries::jobs::Skill;
use crate::db::queries::analysis::MatchedSkill;

#[derive(Debug, Clone)]
pub struct SkillMatchResult {
    pub skills_score: f64,
    pub matched_skills: Vec<MatchedSkill>,
    pub missing_skills: Vec<MatchedSkill>,
}

pub fn match_skills(job_skills: &[Skill], candidate_skills: &[String]) -> SkillMatchResult {
    if job_skills.is_empty() {
        return SkillMatchResult {
            skills_score: 100.0,
            matched_skills: Vec::new(),
            missing_skills: Vec::new(),
        };
    }

    let cand_skills_clean: Vec<String> = candidate_skills
        .iter()
        .map(|s| s.to_lowercase().trim().to_string())
        .collect();

    let mut required_raw = 0.0_f64;
    let mut required_max = 0.0_f64;
    let mut nice_raw = 0.0_f64;
    let mut nice_max = 0.0_f64;

    let mut matched_skills = Vec::new();
    let mut missing_skills = Vec::new();

    for skill in job_skills {
        let skill_clean = skill.skill.to_lowercase().trim().to_string();
        let is_required = skill.importance == "required";

        if is_required {
            required_max += 1.0;
        } else {
            nice_max += 0.5;
        }

        // Check exact match or close match
        let is_exact = cand_skills_clean.iter().any(|c| c == &skill_clean);
        let is_partial = !is_exact && cand_skills_clean.iter().any(|c| {
            c.contains(&skill_clean) || skill_clean.contains(c)
        });

        if is_exact {
            if is_required {
                required_raw += 1.0;
            } else {
                nice_raw += 0.5;
            }
            matched_skills.push(MatchedSkill {
                skill: skill.skill.clone(),
                importance: skill.importance.clone(),
            });
        } else if is_partial {
            if is_required {
                required_raw += 0.6;
            } else {
                nice_raw += 0.5;
            }
            matched_skills.push(MatchedSkill {
                skill: skill.skill.clone(),
                importance: skill.importance.clone(),
            });
        } else {
            missing_skills.push(MatchedSkill {
                skill: skill.skill.clone(),
                importance: skill.importance.clone(),
            });
        }
    }

    let total_max = required_max + nice_max;
    let skills_score: f64 = if total_max > 0.0 {
        ((required_raw + nice_raw) / total_max) * 100.0
    } else {
        100.0
    };

    SkillMatchResult {
        skills_score: skills_score.clamp(0.0_f64, 100.0_f64),
        matched_skills,
        missing_skills,
    }
}

pub fn match_experience(
    min_years: Option<f64>,
    max_years: Option<f64>,
    candidate_years: Option<f64>,
) -> f64 {
    let min_req = min_years.unwrap_or(0.0).max(0.0);
    let max_req = max_years.unwrap_or(0.0).max(0.0);

    // If neither min nor max is specified (or both are <= 0), any experience is acceptable
    if min_req <= 0.0 && max_req <= 0.0 {
        return 100.0;
    }

    let cand = match candidate_years {
        Some(y) if y >= 0.0 => y,
        _ => return 50.0, // unknown candidate experience gets neutral score
    };

    // Case 1: Both min and max are specified (e.g. 2 to 5 years)
    if min_req > 0.0 && max_req > 0.0 && max_req >= min_req {
        if cand >= min_req && cand <= max_req {
            return 100.0; // Perfect fit in range
        } else if cand < min_req {
            let ratio = cand / min_req;
            return (ratio * 75.0).clamp(0.0, 75.0);
        } else {
            // cand > max_req: candidate has more experience than upper limit
            // overqualified candidates still get high score with soft tapering
            let over = cand - max_req;
            let penalty = (over * 2.0).min(10.0);
            return (100.0 - penalty).clamp(85.0, 100.0);
        }
    }

    // Case 2: Only min is specified (e.g. 3+ years)
    if min_req > 0.0 {
        if cand >= min_req {
            let over_ratio = (cand / min_req).min(1.5);
            return (over_ratio * 90.0).min(100.0);
        } else {
            let ratio = cand / min_req;
            return ratio * 70.0;
        }
    }

    // Case 3: Only max is specified (e.g. up to 4 years)
    if max_req > 0.0 {
        if cand <= max_req {
            return 100.0;
        } else {
            let over = (cand - max_req).min(5.0);
            return (100.0 - over * 6.0).max(60.0);
        }
    }

    100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_experience_range() {
        // Range 2.0 to 4.0 years
        let min = Some(2.0);
        let max = Some(4.0);

        // Within range: perfect 100%
        assert_eq!(match_experience(min, max, Some(2.0)), 100.0);
        assert_eq!(match_experience(min, max, Some(3.0)), 100.0);
        assert_eq!(match_experience(min, max, Some(4.0)), 100.0);

        // Below min: scaled down
        let score_1yr = match_experience(min, max, Some(1.0));
        assert!((score_1yr - 37.5).abs() < 1e-4);
        assert_eq!(match_experience(min, max, Some(0.0)), 0.0);

        // Above max: slight soft tapering
        let score_5yr = match_experience(min, max, Some(5.0));
        assert_eq!(score_5yr, 98.0);
        let score_10yr = match_experience(min, max, Some(10.0));
        assert_eq!(score_10yr, 90.0);

        // Unknown candidate experience: neutral 50%
        assert_eq!(match_experience(min, max, None), 50.0);
    }

    #[test]
    fn test_match_experience_min_only() {
        let min = Some(3.0);
        assert_eq!(match_experience(min, None, Some(3.0)), 90.0);
        assert_eq!(match_experience(min, None, Some(5.0)), 100.0);
        assert_eq!(match_experience(min, None, Some(1.5)), 35.0);
    }

    #[test]
    fn test_match_experience_no_requirement() {
        assert_eq!(match_experience(None, None, Some(5.0)), 100.0);
        assert_eq!(match_experience(Some(0.0), Some(0.0), Some(5.0)), 100.0);
    }
}
