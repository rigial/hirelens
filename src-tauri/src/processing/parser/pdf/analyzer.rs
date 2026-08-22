use super::models::PageAnalysisResult;

/// Minimum number of words required for extracted page text to be considered usable.
pub const MIN_USABLE_WORDS: usize = 10;
/// Minimum number of characters required for extracted page text to be considered usable.
pub const MIN_USABLE_CHARS: usize = 30;
/// Minimum ratio of printable characters required to filter out binary/corrupted extraction.
pub const MIN_PRINTABLE_RATIO: f32 = 0.75;
/// Minimum count of alphabetic characters required on a page.
pub const MIN_ALPHA_CHARS: usize = 15;

/// Analyzes extracted page text and returns a detailed `PageAnalysisResult`.
pub fn analyze_page_text(page_number: usize, text: &str) -> PageAnalysisResult {
    let trimmed = text.trim();

    if trimmed.is_empty() {
        return PageAnalysisResult {
            page_number,
            is_usable: false,
            word_count: 0,
            char_count: 0,
            printable_ratio: 0.0,
            reason: "Extracted text is empty".to_string(),
        };
    }

    let char_count = trimmed.chars().count();
    let words: Vec<&str> = trimmed.split_whitespace().collect();
    let word_count = words.len();

    let printable_count = trimmed.chars().filter(|c| !c.is_control() || *c == '\n' || *c == '\t').count();
    let printable_ratio = if char_count > 0 {
        printable_count as f32 / char_count as f32
    } else {
        0.0
    };

    let alpha_count = trimmed.chars().filter(|c| c.is_alphabetic()).count();

    if printable_ratio < MIN_PRINTABLE_RATIO {
        return PageAnalysisResult {
            page_number,
            is_usable: false,
            word_count,
            char_count,
            printable_ratio,
            reason: format!("Low printable character ratio ({:.2} < {})", printable_ratio, MIN_PRINTABLE_RATIO),
        };
    }

    if word_count < MIN_USABLE_WORDS {
        return PageAnalysisResult {
            page_number,
            is_usable: false,
            word_count,
            char_count,
            printable_ratio,
            reason: format!("Insufficient word count ({} < {})", word_count, MIN_USABLE_WORDS),
        };
    }

    if char_count < MIN_USABLE_CHARS {
        return PageAnalysisResult {
            page_number,
            is_usable: false,
            word_count,
            char_count,
            printable_ratio,
            reason: format!("Insufficient character count ({} < {})", char_count, MIN_USABLE_CHARS),
        };
    }

    if alpha_count < MIN_ALPHA_CHARS {
        return PageAnalysisResult {
            page_number,
            is_usable: false,
            word_count,
            char_count,
            printable_ratio,
            reason: format!("Insufficient alphabetic character count ({} < {})", alpha_count, MIN_ALPHA_CHARS),
        };
    }

    PageAnalysisResult {
        page_number,
        is_usable: true,
        word_count,
        char_count,
        printable_ratio,
        reason: "Text layer meets quality criteria".to_string(),
    }
}

/// Convenience function returning true if the extracted page text meets usability standards.
pub fn is_text_usable(text: &str) -> bool {
    analyze_page_text(1, text).is_usable
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_and_whitespace_text() {
        assert!(!is_text_usable(""));
        assert!(!is_text_usable("   \n\t  "));
    }

    #[test]
    fn test_short_insufficient_text() {
        assert!(!is_text_usable("Page 1"));
        assert!(!is_text_usable("Confidential Resume John"));
    }

    #[test]
    fn test_non_printable_corrupt_text() {
        let corrupt = "\u{0000}\u{0001}\u{0002}\u{0003}\u{0004} ABC \u{0007}\u{0008}";
        assert!(!is_text_usable(corrupt));
    }

    #[test]
    fn test_valid_resume_page_text() {
        let valid = "Alice Smith - Senior Software Engineer\n\
                     San Francisco, CA | alice@example.com | 555-0199\n\
                     \n\
                     SUMMARY\n\
                     Experienced backend developer with 7 years specializing in distributed systems, Rust, and Go.\n\
                     Led development of microservices handling 50k requests per second.\n\
                     \n\
                     TECHNICAL SKILLS\n\
                     Rust, Go, Python, PostgreSQL, Redis, Kubernetes, Docker, AWS, gRPC";
        let res = analyze_page_text(1, valid);
        assert!(res.is_usable);
        assert!(res.word_count >= 20);
        assert!(res.char_count >= 100);
        assert!(res.printable_ratio >= 0.95);
    }
}
