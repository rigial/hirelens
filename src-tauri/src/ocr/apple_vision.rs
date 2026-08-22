use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::Duration;
use serde::Deserialize;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use super::provider::{OcrProvider, OcrError};

pub const DEFAULT_APPLE_VISION_TIMEOUT_SECS: u64 = 60;

const EMBEDDED_SWIFT_SOURCE: &str = include_str!("../../native/vision_ocr.swift");

static COMPILED_BINARY_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionPageResult {
    pub page_number: u32,
    pub text: String,
    pub confidence: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionOcrOutput {
    pub total_pages: u32,
    pub pages: Vec<VisionPageResult>,
    pub full_text: String,
}

#[derive(Debug, Clone)]
pub struct AppleVisionProvider {
    timeout: Duration,
}

impl Default for AppleVisionProvider {
    fn default() -> Self {
        let timeout_secs = std::env::var("OCR_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(DEFAULT_APPLE_VISION_TIMEOUT_SECS);

        Self {
            timeout: Duration::from_secs(timeout_secs),
        }
    }
}

impl AppleVisionProvider {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }

    /// Checks if Apple Vision OCR is available on this system (macOS with swift/swiftc or compiled binary).
    pub fn is_available(&self) -> bool {
        #[cfg(target_os = "macos")]
        {
            Self::get_or_compile_binary().is_some() || Path::new("/usr/bin/swift").exists()
        }
        #[cfg(not(target_os = "macos"))]
        {
            false
        }
    }

    /// Locates or compiles the native `vision_ocr` helper binary.
    pub fn get_or_compile_binary() -> Option<PathBuf> {
        COMPILED_BINARY_PATH.get_or_init(|| {
            // 1. Explicit env var
            if let Ok(env_path) = std::env::var("VISION_OCR_BIN") {
                let p = PathBuf::from(env_path);
                if p.exists() {
                    return Some(p);
                }
            }

            // 2. Check executable directory and current directory
            if let Ok(exe_dir) = std::env::current_exe().map(|p| p.parent().unwrap_or(Path::new("")).to_path_buf()) {
                let candidate = exe_dir.join("vision_ocr");
                if candidate.exists() {
                    return Some(candidate);
                }
            }

            let native_dir = Path::new("native").join("vision_ocr");
            if native_dir.exists() {
                return Some(native_dir);
            }

            let src_native_dir = Path::new("src-tauri").join("native").join("vision_ocr");
            if src_native_dir.exists() {
                return Some(src_native_dir);
            }

            // 3. Cached binary in temp / application support
            let temp_bin = std::env::temp_dir().join("hirelens_vision_ocr");
            if temp_bin.exists() {
                return Some(temp_bin);
            }

            // 4. Try compiling with swiftc
            let swift_script_path = std::env::temp_dir().join("hirelens_vision_ocr_src.swift");
            if std::fs::write(&swift_script_path, EMBEDDED_SWIFT_SOURCE).is_ok() {
                let status = std::process::Command::new("swiftc")
                    .arg("-O")
                    .arg(&swift_script_path)
                    .arg("-o")
                    .arg(&temp_bin)
                    .status();

                let _ = std::fs::remove_file(&swift_script_path);

                if let Ok(exit_status) = status {
                    if exit_status.success() && temp_bin.exists() {
                        return Some(temp_bin);
                    }
                }
            }

            None
        }).clone()
    }

    /// Extracts text directly from a PDF file using native macOS PDFKit & Vision.
    pub async fn extract_from_pdf(&self, pdf_path: &Path) -> Result<VisionOcrOutput, OcrError> {
        if !pdf_path.exists() {
            return Err(OcrError::InvalidImage(format!("PDF file not found: {}", pdf_path.display())));
        }

        let output_str = if let Some(binary) = Self::get_or_compile_binary() {
            let mut cmd = Command::new(binary);
            cmd.arg("--pdf")
                .arg(pdf_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let result = tokio::time::timeout(self.timeout, cmd.output()).await;
            match result {
                Ok(Ok(out)) => {
                    if !out.status.success() {
                        let err_msg = String::from_utf8_lossy(&out.stderr);
                        return Err(OcrError::ExecutionFailed(format!("Vision OCR exited with code {:?}: {}", out.status.code(), err_msg)));
                    }
                    String::from_utf8_lossy(&out.stdout).to_string()
                }
                Ok(Err(e)) => return Err(OcrError::ExecutionFailed(format!("Failed to execute Vision OCR: {}", e))),
                Err(_) => return Err(OcrError::Timeout(format!("Vision OCR timed out after {}s", self.timeout.as_secs()))),
            }
        } else {
            // Fallback to running swift directly
            let temp_script = std::env::temp_dir().join(format!("vision_{}.swift", uuid::Uuid::new_v4()));
            tokio::fs::write(&temp_script, EMBEDDED_SWIFT_SOURCE)
                .await
                .map_err(|e| OcrError::ExecutionFailed(format!("Failed to write swift script: {}", e)))?;

            let mut cmd = Command::new("/usr/bin/swift");
            cmd.arg(&temp_script)
                .arg("--pdf")
                .arg(pdf_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let result = tokio::time::timeout(self.timeout, cmd.output()).await;
            let _ = tokio::fs::remove_file(&temp_script).await;

            match result {
                Ok(Ok(out)) => {
                    if !out.status.success() {
                        let err_msg = String::from_utf8_lossy(&out.stderr);
                        return Err(OcrError::ExecutionFailed(format!("Swift Vision OCR failed: {}", err_msg)));
                    }
                    String::from_utf8_lossy(&out.stdout).to_string()
                }
                Ok(Err(e)) => return Err(OcrError::ExecutionFailed(format!("Failed to run swift: {}", e))),
                Err(_) => return Err(OcrError::Timeout(format!("Swift OCR timed out after {}s", self.timeout.as_secs()))),
            }
        };

        if let Ok(parsed) = serde_json::from_str::<VisionOcrOutput>(&output_str) {
            Ok(parsed)
        } else {
            Ok(VisionOcrOutput {
                total_pages: 1,
                pages: vec![VisionPageResult {
                    page_number: 1,
                    text: output_str.clone(),
                    confidence: 1.0,
                }],
                full_text: output_str,
            })
        }
    }

    /// Renders a specific PDF page to PNG using native PDFKit.
    pub async fn render_page(&self, pdf_path: &Path, page_num: u32, out_png: &Path) -> Result<(), OcrError> {
        let binary = Self::get_or_compile_binary().ok_or_else(|| {
            OcrError::BinaryNotFound("Native Vision/PDFKit binary not available".to_string())
        })?;

        let mut cmd = Command::new(binary);
        cmd.arg("--render-pdf")
            .arg(pdf_path)
            .arg(page_num.to_string())
            .arg(out_png)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let result = tokio::time::timeout(self.timeout, cmd.output()).await;
        match result {
            Ok(Ok(out)) => {
                if out.status.success() {
                    Ok(())
                } else {
                    let err_msg = String::from_utf8_lossy(&out.stderr);
                    Err(OcrError::ExecutionFailed(format!("Failed to render PDF page: {}", err_msg)))
                }
            }
            Ok(Err(e)) => Err(OcrError::ExecutionFailed(format!("Failed to execute renderer: {}", e))),
            Err(_) => Err(OcrError::Timeout("PDF render timed out".to_string())),
        }
    }
}

impl OcrProvider for AppleVisionProvider {
    fn extract_text<'a>(
        &'a self,
        image_bytes: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<String, OcrError>> + Send + 'a>> {
        Box::pin(async move {
            if image_bytes.is_empty() {
                return Err(OcrError::InvalidImage("Image buffer is empty".to_string()));
            }

            let binary = Self::get_or_compile_binary().ok_or_else(|| {
                OcrError::BinaryNotFound("Apple Vision binary not available".to_string())
            })?;

            let mut cmd = Command::new(binary);
            cmd.arg("--stdin-image")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| {
                OcrError::ExecutionFailed(format!("Failed to spawn Vision OCR process: {}", e))
            })?;

            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(image_bytes).await.map_err(|e| {
                    OcrError::ExecutionFailed(format!("Failed to write to Vision OCR stdin: {}", e))
                })?;
                stdin.flush().await.map_err(|e| {
                    OcrError::ExecutionFailed(format!("Failed to flush Vision OCR stdin: {}", e))
                })?;
            }

            let result = tokio::time::timeout(self.timeout, child.wait_with_output()).await;
            let output = match result {
                Ok(Ok(out)) => out,
                Ok(Err(e)) => return Err(OcrError::ExecutionFailed(format!("Vision OCR execution failed: {}", e))),
                Err(_) => return Err(OcrError::Timeout("Vision OCR timed out".to_string())),
            };

            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr);
                return Err(OcrError::ExecutionFailed(format!("Vision OCR error: {}", err_msg)));
            }

            let stdout_str = String::from_utf8_lossy(&output.stdout).to_string();
            if let Ok(parsed) = serde_json::from_str::<VisionOcrOutput>(&stdout_str) {
                Ok(parsed.full_text)
            } else {
                Ok(stdout_str)
            }
        })
    }

    fn name(&self) -> &'static str {
        "apple_vision"
    }

    fn is_available(&self) -> bool {
        self.is_available()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apple_vision_provider_creation() {
        let provider = AppleVisionProvider::new();
        assert_eq!(provider.name(), "apple_vision");
        #[cfg(target_os = "macos")]
        assert!(provider.is_available());
    }

    #[tokio::test]
    async fn test_apple_vision_empty_image_error() {
        let provider = AppleVisionProvider::new();
        let result = provider.extract_text(&[]).await;
        assert!(matches!(result, Err(OcrError::InvalidImage(_))));
    }

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn test_apple_vision_nonexistent_pdf() {
        let provider = AppleVisionProvider::new();
        let result = provider.extract_from_pdf(Path::new("/nonexistent/file.pdf")).await;
        assert!(result.is_err());
    }
}
