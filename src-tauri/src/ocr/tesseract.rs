use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use uuid::Uuid;

use super::provider::{OcrProvider, OcrError};

/// Default OCR resolution DPI.
pub const DEFAULT_OCR_DPI: u32 = 300;
/// Default OCR language code.
pub const DEFAULT_OCR_LANG: &str = "eng";
/// Default OCR execution timeout.
pub const DEFAULT_OCR_TIMEOUT_SECS: u64 = 30;

/// RAII helper to ensure temporary files are deleted when dropped.
pub struct TempFileGuard {
    pub path: PathBuf,
}

impl TempFileGuard {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if self.path.exists() {
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

/// Tesseract OCR provider invoking the local Tesseract CLI engine.
#[derive(Debug, Clone)]
pub struct TesseractProvider {
    binary_path: Option<PathBuf>,
    dpi: u32,
    lang: String,
    timeout: Duration,
}

impl Default for TesseractProvider {
    fn default() -> Self {
        let dpi = std::env::var("OCR_DPI")
            .ok()
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(DEFAULT_OCR_DPI);

        let lang = std::env::var("TESSERACT_LANG")
            .unwrap_or_else(|_| DEFAULT_OCR_LANG.to_string());

        let timeout_secs = std::env::var("OCR_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(DEFAULT_OCR_TIMEOUT_SECS);

        Self {
            binary_path: Self::discover_tesseract_binary(),
            dpi,
            lang,
            timeout: Duration::from_secs(timeout_secs),
        }
    }
}

impl TesseractProvider {
    /// Creates a new `TesseractProvider` with default discovery and settings.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets an explicit path to the tesseract executable.
    pub fn with_binary_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.binary_path = Some(path.into());
        self
    }

    /// Sets the target DPI for OCR.
    pub fn with_dpi(mut self, dpi: u32) -> Self {
        self.dpi = dpi;
        self
    }

    /// Sets the language code (e.g. "eng").
    pub fn with_lang(mut self, lang: impl Into<String>) -> Self {
        self.lang = lang.into();
        self
    }

    /// Sets the maximum execution timeout.
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Returns `true` if a usable Tesseract binary is available on the system.
    pub fn is_available(&self) -> bool {
        self.binary_path.as_ref().map(|p| p.exists()).unwrap_or(false)
    }

    /// Discovers the Tesseract binary across environment variables and standard platform locations.
    pub fn discover_tesseract_binary() -> Option<PathBuf> {
        // 1. Explicit env var
        if let Ok(env_path) = std::env::var("TESSERACT_PATH") {
            let p = PathBuf::from(env_path);
            if p.exists() {
                return Some(p);
            }
        }

        // 2. Known standard paths
        let candidate_paths = [
            "/opt/homebrew/bin/tesseract",       // macOS Apple Silicon
            "/usr/local/bin/tesseract",          // macOS Intel / Linux
            "/usr/bin/tesseract",                // Linux
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        ];

        for path_str in &candidate_paths {
            let p = Path::new(path_str);
            if p.exists() {
                return Some(p.to_path_buf());
            }
        }

        // 3. Fallback: check if "tesseract" is in PATH via `which` or running `--version`
        if let Ok(output) = std::process::Command::new("tesseract").arg("--version").output() {
            if output.status.success() {
                return Some(PathBuf::from("tesseract"));
            }
        }

        None
    }

    async fn extract_text_internal(&self, image_bytes: &[u8]) -> Result<String, OcrError> {
        if image_bytes.is_empty() {
            return Err(OcrError::InvalidImage("Image buffer is empty".to_string()));
        }

        let binary = self.binary_path.as_ref().ok_or_else(|| {
            OcrError::BinaryNotFound("Tesseract binary not found in PATH or standard locations".to_string())
        })?;

        // Create temporary image file with RAII cleanup guard
        let temp_dir = std::env::temp_dir();
        let temp_filename = format!("hirelens_ocr_{}.png", Uuid::new_v4());
        let temp_path = temp_dir.join(temp_filename);
        let guard = TempFileGuard::new(temp_path.clone());

        {
            let mut file = tokio::fs::File::create(&guard.path).await.map_err(|e| {
                OcrError::ExecutionFailed(format!("Failed to create temp OCR image: {}", e))
            })?;
            file.write_all(image_bytes).await.map_err(|e| {
                OcrError::ExecutionFailed(format!("Failed to write temp OCR image: {}", e))
            })?;
            file.flush().await.map_err(|e| {
                OcrError::ExecutionFailed(format!("Failed to flush temp OCR image: {}", e))
            })?;
        }

        // Execute tesseract: `tesseract <temp_path> stdout -l <lang> --dpi <dpi>`
        let mut cmd = Command::new(binary);
        cmd.arg(&guard.path)
            .arg("stdout")
            .arg("-l")
            .arg(&self.lang)
            .arg("--dpi")
            .arg(self.dpi.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let result = tokio::time::timeout(self.timeout, cmd.output()).await;

        // Ensure temp file is dropped and deleted
        drop(guard);

        let output = match result {
            Ok(Ok(out)) => out,
            Ok(Err(e)) => {
                return Err(OcrError::ExecutionFailed(format!("Failed to execute Tesseract: {}", e)));
            }
            Err(_) => {
                return Err(OcrError::Timeout(format!("Tesseract OCR timed out after {}s", self.timeout.as_secs())));
            }
        };

        if !output.status.success() {
            let stderr_msg = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(OcrError::ExecutionFailed(format!(
                "Tesseract exited with error code {:?}: {}",
                output.status.code(),
                stderr_msg
            )));
        }

        let raw_text = String::from_utf8_lossy(&output.stdout).to_string();
        let trimmed = raw_text.trim().to_string();

        if trimmed.is_empty() {
            return Err(OcrError::EmptyOutput);
        }

        Ok(trimmed)
    }
}

impl OcrProvider for TesseractProvider {
    fn extract_text<'a>(
        &'a self,
        image_bytes: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<String, OcrError>> + Send + 'a>> {
        Box::pin(async move {
            self.extract_text_internal(image_bytes).await
        })
    }

    fn name(&self) -> &'static str {
        "tesseract"
    }

    fn is_available(&self) -> bool {
        self.is_available()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_temp_file_guard_cleanup() {
        let temp_path = std::env::temp_dir().join(format!("test_guard_{}.tmp", Uuid::new_v4()));
        std::fs::write(&temp_path, b"test content").unwrap();
        assert!(temp_path.exists());

        {
            let _guard = TempFileGuard::new(temp_path.clone());
        }

        assert!(!temp_path.exists(), "Temp file should be deleted on drop");
    }

    #[test]
    fn test_tesseract_provider_builder() {
        let provider = TesseractProvider::new()
            .with_dpi(150)
            .with_lang("fra")
            .with_timeout(Duration::from_secs(10));

        assert_eq!(provider.dpi, 150);
        assert_eq!(provider.lang, "fra");
        assert_eq!(provider.timeout, Duration::from_secs(10));
    }

    #[tokio::test]
    async fn test_empty_image_error() {
        let provider = TesseractProvider::new();
        let result = provider.extract_text(&[]).await;
        assert!(result.is_err());
        match result.unwrap_err() {
            OcrError::InvalidImage(_) => (),
            other => panic!("Expected InvalidImage, got {:?}", other),
        }
    }
}
