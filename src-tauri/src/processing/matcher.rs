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

pub fn match_experience(required_years: Option<f64>, candidate_years: Option<f64>) -> f64 {
    let req = match required_years {
        Some(y) if y > 0.0 => y,
        _ => return 100.0,
    };

    let cand = match candidate_years {
        Some(y) => y,
        None => return 50.0,
    };

    if cand >= req {
        let over_ratio = (cand / req).min(1.5);
        (over_ratio * 90.0).min(100.0)
    } else {
        let ratio = cand / req;
        ratio * 70.0
    }
}
