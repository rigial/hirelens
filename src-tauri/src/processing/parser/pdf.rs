use std::path::Path;

/// Extracts text from all pages of a PDF.
///
/// Text extracted from each page is separated by a newline. Pages whose text
/// cannot be extracted are skipped.
///
/// # Returns
///
/// The combined extracted text.
///
/// # Errors
///
/// Returns an error if the PDF cannot be loaded or contains no extractable
/// text.
///
/// # Examples
///
/// ```
/// let result = extract_pdf_text("missing.pdf");
/// assert!(result.is_err());
/// ```
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

    Ok(extracted_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_nonexistent_pdf() {
        let res = extract_pdf_text("/nonexistent/file/path.pdf");
        assert!(res.is_err());
    }
}

