pub mod pdf;
pub mod docx;

use std::path::Path;

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
