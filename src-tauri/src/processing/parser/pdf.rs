use std::path::Path;

/// Normalizes raw extracted PDF text, reconstructing fragmented words and artificial line breaks
/// into clean paragraphs, distinct section headers, and formatted bullet points.
pub fn normalize_extracted_text(raw: &str) -> String {
    let tokens: Vec<&str> = raw.split_whitespace().collect();
    if tokens.is_empty() {
        return String::new();
    }

    const MULTI_WORD_SECTIONS: &[&str] = &[
        "PROFESSIONAL SUMMARY",
        "EXECUTIVE SUMMARY",
        "TECHNICAL SKILLS",
        "SKILLS & ABILITIES",
        "CORE COMPETENCIES",
        "PROFESSIONAL EXPERIENCE",
        "WORK EXPERIENCE",
        "EMPLOYMENT HISTORY",
        "CAREER HISTORY",
        "KEY PROJECTS",
        "PERSONAL PROJECTS",
        "ACADEMIC BACKGROUND",
        "CERTIFICATIONS & LICENSES",
    ];

    const SINGLE_WORD_SECTIONS: &[&str] = &[
        "SUMMARY",
        "PROFILE",
        "SKILLS",
        "EXPERIENCE",
        "PROJECTS",
        "EDUCATION",
        "CERTIFICATIONS",
        "ACHIEVEMENTS",
        "AWARDS",
        "PUBLICATIONS",
        "LANGUAGES",
        "INTERESTS",
        "VOLUNTEERING",
    ];

    const ROLE_PREFIXES: &[&str] = &[
        "Software", "Senior", "Lead", "Product", "Frontend", "Backend",
        "Full-Stack", "Full", "Staff", "Principal", "Junior", "Head"
    ];

    const ROLE_SUFFIXES: &[&str] = &[
        "Engineer", "Developer", "Architect", "Designer", "Manager", "Development", "Director"
    ];

    const DEGREE_OPENERS: &[&str] = &[
        "Bachelor", "Master", "B.E.", "B.Tech", "B.S.", "M.S.", "M.Tech", "Ph.D", "PhD", "MBA", "MCA"
    ];

    let mut lines: Vec<String> = Vec::new();
    let mut current_line: Vec<&str> = Vec::new();

    let mut i = 0;
    while i < tokens.len() {
        let token = tokens[i];
        let next_token = if i + 1 < tokens.len() { tokens[i + 1] } else { "" };
        let next2_token = if i + 2 < tokens.len() { tokens[i + 2] } else { "" };

        let candidate3 = format!("{} {} {}", token, next_token, next2_token).to_uppercase();
        let candidate2 = format!("{} {}", token, next_token).to_uppercase();
        let candidate1 = token.to_uppercase();

        let upper1 = is_all_uppercase_token(token);
        let upper2 = upper1 && is_all_uppercase_token(next_token);
        let upper3 = upper2 && is_all_uppercase_token(next2_token);

        let mut matched_header: Option<String> = None;
        let mut header_tokens_count = 0;

        if upper3 && MULTI_WORD_SECTIONS.contains(&candidate3.as_str()) {
            matched_header = Some(candidate3);
            header_tokens_count = 3;
        } else if upper2 && MULTI_WORD_SECTIONS.contains(&candidate2.as_str()) {
            matched_header = Some(candidate2);
            header_tokens_count = 2;
        } else if upper1
            && SINGLE_WORD_SECTIONS.contains(&candidate1.as_str())
            && next_token != "&"
            && next_token != "and"
            && !next_token.ends_with(':')
            && !token.ends_with(':')
        {
            matched_header = Some(candidate1);
            header_tokens_count = 1;
        }

        if let Some(header) = matched_header {
            if !current_line.is_empty() {
                lines.push(current_line.join(" "));
                current_line.clear();
            }
            lines.push(String::new());
            lines.push(header);
            lines.push(String::new());
            i += header_tokens_count;
            continue;
        }

        if is_bullet_symbol(token) {
            if !current_line.is_empty() {
                lines.push(current_line.join(" "));
                current_line.clear();
            }
            current_line.push("●");
            i += 1;
            continue;
        }

        let is_role_start = ROLE_PREFIXES.contains(&token) && ROLE_SUFFIXES.contains(&next_token);
        let is_edu_start = DEGREE_OPENERS.contains(&token)
            || (token == "Bachelor" && next_token == "of")
            || (token == "Master" && next_token == "of");

        if (is_role_start || is_edu_start) && !current_line.is_empty() && current_line.contains(&"●") {
            lines.push(current_line.join(" "));
            current_line.clear();
            lines.push(String::new());
        }

        current_line.push(token);

        let is_date_end = (token == "Present"
            || token == "Current"
            || is_year(token))
            && next_token != "–"
            && next_token != "-"
            && next_token != "to"
            && next_token != "Present"
            && !is_year(next_token);

        if is_date_end
            && current_line.iter().any(|&w| w == "—" || w == "-" || w == "–")
            && !current_line.contains(&"●")
            && current_line.len() >= 4
        {
            lines.push(current_line.join(" "));
            current_line.clear();
        }

        i += 1;
    }

    if !current_line.is_empty() {
        lines.push(current_line.join(" "));
    }

    let mut cleaned = Vec::new();
    let mut prev_blank = false;
    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !prev_blank && !cleaned.is_empty() {
                cleaned.push(String::new());
                prev_blank = true;
            }
        } else {
            cleaned.push(trimmed.to_string());
            prev_blank = false;
        }
    }

    cleaned.join("\n")
}

fn is_all_uppercase_token(t: &str) -> bool {
    let chars: Vec<char> = t.chars().filter(|c| c.is_alphabetic()).collect();
    !chars.is_empty() && chars.iter().all(|c| c.is_uppercase())
}

fn is_bullet_symbol(token: &str) -> bool {
    token == "•"
        || token == "●"
        || token == "▪"
        || token == "▫"
        || token == "*"
        || token == "\u{2022}"
        || token == "\u{2023}"
        || token == "\u{25E6}"
        || token == "\u{2043}"
        || token == "\u{2219}"
        || (token.len() >= 2
            && token.len() <= 3
            && token.chars().take(token.len().saturating_sub(1)).all(|c| c.is_ascii_digit())
            && (token.ends_with('.') || token.ends_with(')')))
}

fn is_year(s: &str) -> bool {
    s.len() == 4 && (s.starts_with("19") || s.starts_with("20")) && s.chars().all(|c| c.is_ascii_digit())
}

/// Extracts text from all pages of a PDF and returns normalized, cleanly wrapped text.
///
/// # Returns
///
/// The combined extracted text with preserved headers and lists.
///
/// # Errors
///
/// Returns an error if the PDF cannot be loaded or contains no extractable text.
pub fn extract_pdf_text<P: AsRef<Path>>(path: P) -> Result<String, String> {
    let doc = lopdf::Document::load(path).map_err(|e| format!("Failed to load PDF: {}", e))?;
    let mut extracted_text = String::new();

    let pages = doc.get_pages();
    for (page_num, _) in pages {
        if let Ok(text) = doc.extract_text(&[page_num]) {
            extracted_text.push_str(&text);
            extracted_text.push('\n');
        }
    }

    if extracted_text.trim().is_empty() {
        return Err("PDF appears to be scanned or contains no extractable text layer.".to_string());
    }

    let normalized = normalize_extracted_text(&extracted_text);
    if normalized.trim().is_empty() {
        return Err("PDF appears to be scanned or contains no extractable text layer.".to_string());
    }

    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_nonexistent_pdf() {
        let res = extract_pdf_text("/nonexistent/file/path.pdf");
        assert!(res.is_err());
    }

    #[test]
    fn test_normalize_extracted_text_single_words() {
        let raw = "Experienced\n \nFull-Stack\n \nDeveloper\n \nwith\n \nexpertise\n \nin\n \nReact\n \nand\n \nRust.";
        let normalized = normalize_extracted_text(raw);
        assert_eq!(normalized, "Experienced Full-Stack Developer with expertise in React and Rust.");
    }

    #[test]
    fn test_normalize_extracted_text_bullets_and_headers() {
        let raw = "PROFESSIONAL EXPERIENCE\n \n●\n \nDesigned\n \nand\n \nbuilt\n \nAPIs.\n \n●\n \nManaged\n \nsystems.";
        let normalized = normalize_extracted_text(raw);
        assert!(normalized.contains("PROFESSIONAL EXPERIENCE\n\n● Designed and built APIs.\n● Managed systems."));
    }
}

