use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use super::provider::{OcrProvider, OcrError};

/// A mock OCR provider for deterministic testing.
#[derive(Clone, Default)]
pub struct MockOcrProvider {
    custom_text: Option<String>,
    simulated_error: Option<OcrError>,
    call_count: Arc<Mutex<usize>>,
}

impl MockOcrProvider {
    pub fn new() -> Self {
        Self::default()
    }

    /// Configures the mock to always return a specific text on success.
    pub fn with_text(mut self, text: impl Into<String>) -> Self {
        self.custom_text = Some(text.into());
        self
    }

    /// Configures the mock to always fail with a specific `OcrError`.
    pub fn with_error(mut self, error: OcrError) -> Self {
        self.simulated_error = Some(error);
        self
    }

    /// Returns the number of times `extract_text` was called.
    pub fn get_call_count(&self) -> usize {
        *self.call_count.lock().unwrap()
    }
}

impl OcrProvider for MockOcrProvider {
    fn extract_text<'a>(
        &'a self,
        _image_bytes: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<String, OcrError>> + Send + 'a>> {
        let count_lock = Arc::clone(&self.call_count);
        let custom_text = self.custom_text.clone();
        let simulated_error = self.simulated_error.clone();

        Box::pin(async move {
            let mut count = count_lock.lock().unwrap();
            *count += 1;

            if let Some(err) = simulated_error {
                return Err(err);
            }

            if let Some(text) = custom_text {
                return Ok(text);
            }

            Ok("MOCK OCR EXTRACTED TEXT: John Doe Senior Software Engineer Skills: Rust, React, TypeScript Experience: 5 years Education: B.S. Computer Science".to_string())
        })
    }

    fn name(&self) -> &'static str {
        "mock"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_ocr_provider_default() {
        let mock = MockOcrProvider::new();
        let text = mock.extract_text(b"fake_image").await.unwrap();
        assert!(text.contains("John Doe"));
        assert_eq!(mock.get_call_count(), 1);
    }

    #[tokio::test]
    async fn test_mock_ocr_provider_custom_text() {
        let mock = MockOcrProvider::new().with_text("Custom resume content");
        let text = mock.extract_text(b"fake_image").await.unwrap();
        assert_eq!(text, "Custom resume content");
    }

    #[tokio::test]
    async fn test_mock_ocr_provider_error() {
        let mock = MockOcrProvider::new().with_error(OcrError::BinaryNotFound("tesseract not found".into()));
        let res = mock.extract_text(b"fake_image").await;
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), OcrError::BinaryNotFound("tesseract not found".into()));
    }
}
