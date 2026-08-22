pub mod provider;
pub mod tesseract;
pub mod apple_vision;
pub mod mock;

pub use provider::{OcrProvider, OcrError};
pub use tesseract::{TesseractProvider, DEFAULT_OCR_DPI, DEFAULT_OCR_LANG, DEFAULT_OCR_TIMEOUT_SECS};
pub use apple_vision::AppleVisionProvider;
pub use mock::MockOcrProvider;

use std::sync::Arc;

/// Creates the default OCR provider for the current environment.
/// On macOS, uses native Apple Vision + PDFKit first, falling back to Tesseract if available.
/// On other platforms, uses Tesseract.
pub fn create_default_ocr_provider() -> Arc<dyn OcrProvider> {
    #[cfg(target_os = "macos")]
    {
        let vision = AppleVisionProvider::new();
        if vision.is_available() {
            return Arc::new(vision);
        }
    }

    Arc::new(TesseractProvider::new())
}
