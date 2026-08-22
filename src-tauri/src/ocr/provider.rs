use std::fmt;
use std::future::Future;
use std::pin::Pin;

/// Errors that can occur during OCR processing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OcrError {
    /// The OCR binary/engine could not be found.
    BinaryNotFound(String),
    /// The input image data is invalid or could not be decoded.
    InvalidImage(String),
    /// The OCR process failed with an error message or non-zero exit code.
    ExecutionFailed(String),
    /// The OCR process timed out.
    Timeout(String),
    /// The OCR process succeeded but returned no readable text.
    EmptyOutput,
}

impl fmt::Display for OcrError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OcrError::BinaryNotFound(msg) => write!(f, "OCR engine not found: {}", msg),
            OcrError::InvalidImage(msg) => write!(f, "Invalid image data: {}", msg),
            OcrError::ExecutionFailed(msg) => write!(f, "OCR execution failed: {}", msg),
            OcrError::Timeout(msg) => write!(f, "OCR execution timed out: {}", msg),
            OcrError::EmptyOutput => write!(f, "OCR returned empty text output"),
        }
    }
}

impl std::error::Error for OcrError {}

/// Pluggable interface for OCR engines (Apple Vision, Tesseract, Cloud OCR, Mock, etc.).
pub trait OcrProvider: Send + Sync {
    /// Extracts text from raw image bytes (e.g. PNG, JPEG).
    fn extract_text<'a>(
        &'a self,
        image_bytes: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<String, OcrError>> + Send + 'a>>;

    /// Returns the name of the OCR provider.
    fn name(&self) -> &'static str {
        "generic"
    }

    /// Returns whether this OCR engine is available and ready to use.
    fn is_available(&self) -> bool {
        true
    }
}
