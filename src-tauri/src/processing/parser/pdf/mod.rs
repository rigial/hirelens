pub mod models;
pub mod analyzer;
pub mod renderer;
pub mod normalizer;
pub mod extractor;

pub use models::{ExtractionMethod, ExtractionSource, PageAnalysisResult, PageExtraction, ResumeExtraction};
pub use analyzer::{analyze_page_text, is_text_usable};
pub use normalizer::{combine_and_normalize_pages, normalize_extracted_text};
pub use renderer::{render_or_extract_page_image, extract_embedded_page_image};
pub use extractor::extract_pdf_pages_hybrid;

use std::path::Path;
use crate::ocr::provider::OcrProvider;

/// Extracts text from all pages of a PDF, maintaining backward compatibility with existing callers.
///
/// If pages contain missing or unusable text layers, automatically uses default OCR provider fallback.
///
/// # Returns
/// The combined, normalized extracted text.
///
/// # Errors
/// Returns an error if the PDF cannot be loaded or contains no extractable text layer.
pub fn extract_pdf_text<P: AsRef<Path>>(path: P) -> Result<String, String> {
    let doc = lopdf::Document::load(path.as_ref()).map_err(|e| format!("Failed to load PDF: {}", e))?;
    let mut extracted_text = String::new();

    let mut pages: Vec<u32> = doc.get_pages().keys().copied().collect();
    pages.sort_unstable();

    for page_num in pages {
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

/// Asynchronously extracts text from a PDF file using hybrid page-level text extraction and OCR fallback.
pub async fn extract_pdf_text_with_ocr<P: AsRef<Path>>(
    path: P,
    ocr_provider: &dyn OcrProvider,
) -> Result<ResumeExtraction, String> {
    extract_pdf_pages_hybrid(path, ocr_provider).await
}

/// Asynchronously extracts text using the default system OCR provider.
pub async fn extract_pdf_hybrid_default<P: AsRef<Path>>(path: P) -> Result<ResumeExtraction, String> {
    let default_ocr = crate::ocr::create_default_ocr_provider();
    extract_pdf_pages_hybrid(path, &*default_ocr).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ocr::mock::MockOcrProvider;

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

    #[tokio::test]
    async fn test_extract_pdf_with_mock_ocr_nonexistent() {
        let mock_ocr = MockOcrProvider::new();
        let res = extract_pdf_text_with_ocr("/nonexistent/file/path.pdf", &mock_ocr).await;
        assert!(res.is_err());
    }
}
