pub mod pdf;
pub mod docx;

use std::path::Path;
use crate::ocr::provider::OcrProvider;
use self::pdf::ResumeExtraction;

/// Result of document text extraction containing both normalized text and optional extraction metadata.
#[derive(Debug, Clone)]
pub struct DocumentExtraction {
    pub text: String,
    pub pdf_metadata: Option<ResumeExtraction>,
}

/// Synchronously extracts text from a supported file (.pdf, .docx).
pub fn extract_text_from_file<P: AsRef<Path>>(path: P) -> Result<String, String> {
    let p = path.as_ref();
    let extension = p.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "pdf" => pdf::extract_pdf_text(p),
        "docx" => docx::extract_docx_text(p),
        "doc" => {
            // Try DOCX parser first, if fails inform user
            docx::extract_docx_text(p).map_err(|_| {
                "Legacy binary .doc format is not supported directly. Please convert to .docx or .pdf and re-upload.".to_string()
            })
        }
        ext => Err(format!("Unsupported file extension: .{}", ext)),
    }
}

/// Asynchronously extracts text from a file with OCR fallback for PDF documents.
pub async fn extract_text_from_file_with_ocr<P: AsRef<Path>>(
    path: P,
    ocr_provider: &dyn OcrProvider,
) -> Result<DocumentExtraction, String> {
    let p = path.as_ref();
    let extension = p.extension()
        .and_then(|ext| ext.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match extension.as_str() {
        "pdf" => {
            let resume_extraction = pdf::extract_pdf_text_with_ocr(p, ocr_provider).await?;
            Ok(DocumentExtraction {
                text: resume_extraction.full_text.clone(),
                pdf_metadata: Some(resume_extraction),
            })
        }
        "docx" => {
            let text = docx::extract_docx_text(p)?;
            Ok(DocumentExtraction {
                text,
                pdf_metadata: None,
            })
        }
        "doc" => {
            let text = docx::extract_docx_text(p).map_err(|_| {
                "Legacy binary .doc format is not supported directly. Please convert to .docx or .pdf and re-upload.".to_string()
            })?;
            Ok(DocumentExtraction {
                text,
                pdf_metadata: None,
            })
        }
        ext => Err(format!("Unsupported file extension: .{}", ext)),
    }
}
