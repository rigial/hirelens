use serde::{Deserialize, Serialize};

/// The origin source of extracted text for a specific page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionSource {
    /// Extracted directly from PDF vector text stream.
    PdfText,
    /// Extracted via optical character recognition on a rendered page image.
    Ocr,
}

/// The document-level extraction strategy achieved across all pages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExtractionMethod {
    /// All pages contained a usable text layer; OCR was not invoked.
    Text,
    /// All pages were processed via OCR (scanned or image-based PDF).
    Ocr,
    /// Some pages used native PDF text and others used OCR.
    Hybrid,
}

/// Page-level extraction result.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageExtraction {
    /// 1-indexed page number.
    pub page_number: usize,
    /// Source of text extraction (native PDF text vs OCR).
    pub source: ExtractionSource,
    /// Normalized text content extracted from this page.
    pub text: String,
    /// Time taken to extract this page in milliseconds.
    pub duration_ms: u64,
}

/// Result of analyzing text quality/usability on an individual page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageAnalysisResult {
    pub page_number: usize,
    pub is_usable: bool,
    pub word_count: usize,
    pub char_count: usize,
    pub printable_ratio: f32,
    pub reason: String,
}

/// Document-level extraction summary containing normalized text and per-page breakdown.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeExtraction {
    /// Individual page extractions in original sequential order.
    pub pages: Vec<PageExtraction>,
    /// Overall extraction method used.
    pub method: ExtractionMethod,
    /// Total count of pages in the PDF.
    pub total_pages: usize,
    /// Count of pages extracted via native PDF text.
    pub text_pages: usize,
    /// Count of pages extracted via OCR.
    pub ocr_pages: usize,
    /// Combined, normalized text ready for downstream LLM processing.
    pub full_text: String,
    /// Total extraction duration in milliseconds.
    pub total_duration_ms: u64,
}
