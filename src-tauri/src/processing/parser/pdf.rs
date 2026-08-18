use std::path::Path;

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

