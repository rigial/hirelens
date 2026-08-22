use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use futures_util::StreamExt;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sysinfo::System;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufWriter};
use crate::llm::keepawake::KeepAwakeGuard;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub ram_gb: f32,
    pub has_gpu: bool,
    pub gpu_type: Option<String>,
    pub recommended_model_tier: String,
    pub cpu_cores: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub id: String,
    pub display_name: String,
    pub tier: String,
    pub file_name: String,
    pub download_url: String,
    pub sha256: String,
    pub size_bytes: i64,
    pub file_path: Option<String>,
    pub status: String,
    pub is_active: bool,
    pub downloaded_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub eta_seconds: Option<u64>,
}

pub fn detect_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_bytes = sys.total_memory();
    let ram_gb = (total_ram_bytes as f64 / (1024.0 * 1024.0 * 1024.0)) as f32;
    let cpu_cores = sys.cpus().len();

    // Check for Apple Silicon / Metal or CUDA GPU
    let (has_gpu, gpu_type) = if cfg!(target_os = "macos") {
        (true, Some("Apple Silicon / Metal".to_string()))
    } else {
        (false, None)
    };

    let recommended_model_tier = if ram_gb < 8.0 {
        "fast".to_string()
    } else if ram_gb <= 16.0 {
        "balanced".to_string()
    } else {
        "quality".to_string()
    };

    SystemInfo {
        ram_gb,
        has_gpu,
        gpu_type,
        recommended_model_tier,
        cpu_cores: if cpu_cores > 0 { cpu_cores } else { 4 },
    }
}

pub fn get_models_from_db(conn: &Connection) -> Result<Vec<Model>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, display_name, tier, file_name, download_url, sha256, size_bytes, file_path, status, is_active, downloaded_at
         FROM models ORDER BY size_bytes ASC"
    )?;

    let iter = stmt.query_map([], |row| {
        let is_active_int: i64 = row.get(9)?;
        Ok(Model {
            id: row.get(0)?,
            display_name: row.get(1)?,
            tier: row.get(2)?,
            file_name: row.get(3)?,
            download_url: row.get(4)?,
            sha256: row.get(5)?,
            size_bytes: row.get(6)?,
            file_path: row.get(7)?,
            status: row.get(8)?,
            is_active: is_active_int == 1,
            downloaded_at: row.get(10)?,
        })
    })?;

    let mut models = Vec::new();
    for m in iter {
        models.push(m?);
    }
    Ok(models)
}

/// Compute SHA-256 hash string for an in-memory byte slice.
pub fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Read a file from disk asynchronously and verify its SHA-256 hash.
pub async fn verify_file_sha256<P: AsRef<Path>>(path: P, expected_hash: &str) -> Result<bool, String> {
    let mut file = tokio::fs::File::open(path.as_ref())
        .await
        .map_err(|e| format!("Failed to open file for verification: {}", e))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];

    loop {
        let bytes_read = file.read(&mut buffer)
            .await
            .map_err(|e| format!("Failed to read file chunk during verification: {}", e))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    let calculated_hash = format!("{:x}", hasher.finalize());
    Ok(calculated_hash.eq_ignore_ascii_case(expected_hash.trim()))
}

/// Performs a robust, resumable model download with speed calculation, ETA estimation,
/// buffered I/O, screen wake-lock, and atomic integrity verification.
pub async fn perform_model_download(
    app: AppHandle,
    models_dir: PathBuf,
    model: Model,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    // 1. Acquire OS power assertion to keep screen and system awake during download
    let _keep_awake = KeepAwakeGuard::new(&format!("Downloading AI model {}", model.display_name));

    tokio::fs::create_dir_all(&models_dir)
        .await
        .map_err(|e| format!("Failed to create models directory: {}", e))?;

    let target_path = models_dir.join(&model.file_name);
    let part_path = models_dir.join(format!("{}.part", model.file_name));

    // HTTP client without aggressive total timeout (uses 30s connection timeout)
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(30))
        .tcp_keepalive(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut attempts = 0;
    const MAX_RETRIES: usize = 3;

    loop {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err("Download cancelled by user".to_string());
        }

        attempts += 1;

        // Check if partial file exists for resume support
        let mut existing_bytes: u64 = 0;
        if let Ok(meta) = tokio::fs::metadata(&part_path).await {
            existing_bytes = meta.len();
        }

        let mut req = client.get(&model.download_url);
        if existing_bytes > 0 {
            req = req.header("Range", format!("bytes={}-", existing_bytes));
        }

        let response = match req.send().await {
            Ok(resp) => resp,
            Err(err) => {
                if attempts <= MAX_RETRIES && !cancel_flag.load(Ordering::Relaxed) {
                    tokio::time::sleep(std::time::Duration::from_secs(2 * attempts as u64)).await;
                    continue;
                }
                return Err(format!("Failed to connect to model download URL: {}", err));
            }
        };

        let status = response.status();
        let (file, mut downloaded, total_size) = if status == reqwest::StatusCode::PARTIAL_CONTENT {
            // Server supports Range resume
            let content_len = response.content_length().unwrap_or(0);
            let total = existing_bytes + content_len;
            let f = tokio::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to open partial download file: {}", e))?;
            (f, existing_bytes, if total > 0 { total } else { model.size_bytes as u64 })
        } else if status == reqwest::StatusCode::OK {
            // Server sent full content (reset to 0)
            let total = response.content_length().unwrap_or(model.size_bytes as u64);
            let f = tokio::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&part_path)
                .await
                .map_err(|e| format!("Failed to create download file: {}", e))?;
            (f, 0u64, total)
        } else if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
            // Range out of bounds, reset partial file and restart
            tokio::fs::remove_file(&part_path).await.ok();
            if attempts <= MAX_RETRIES {
                continue;
            }
            return Err(format!("Download range error: HTTP {}", status));
        } else {
            return Err(format!("Failed to download model {}: HTTP error {}", model.id, status));
        };

        let mut writer = BufWriter::with_capacity(262_144, file); // 256KB buffer
        let mut stream = response.bytes_stream();
        let mut last_emit = std::time::Instant::now();
        let mut bytes_since_last_emit: u64 = 0;
        let mut smoothed_speed: f64 = 0.0;
        let mut stream_error = false;

        while let Some(chunk_result) = stream.next().await {
            if cancel_flag.load(Ordering::Relaxed) {
                writer.flush().await.ok();
                drop(writer);
                return Err("Download cancelled by user".to_string());
            }

            let chunk = match chunk_result {
                Ok(c) => c,
                Err(e) => {
                    stream_error = true;
                    eprintln!("Download chunk stream interrupted: {}", e);
                    break;
                }
            };

            if let Err(e) = writer.write_all(&chunk).await {
                writer.flush().await.ok();
                drop(writer);
                return Err(format!("File write error: {}", e));
            }

            let chunk_len = chunk.len() as u64;
            downloaded += chunk_len;
            bytes_since_last_emit += chunk_len;

            let elapsed_millis = last_emit.elapsed().as_millis();
            if elapsed_millis >= 250 {
                let elapsed_sec = last_emit.elapsed().as_secs_f64();
                let current_instant_speed = if elapsed_sec > 0.0 {
                    bytes_since_last_emit as f64 / elapsed_sec
                } else {
                    0.0
                };

                // Exponential moving average for smooth speed and stable ETA
                if smoothed_speed == 0.0 {
                    smoothed_speed = current_instant_speed;
                } else {
                    smoothed_speed = (smoothed_speed * 0.7) + (current_instant_speed * 0.3);
                }

                let speed_bps = smoothed_speed.round() as u64;
                let eta_seconds = if speed_bps > 0 && total_size > downloaded {
                    Some((total_size - downloaded) / speed_bps)
                } else if downloaded >= total_size {
                    Some(0)
                } else {
                    None
                };

                let payload = ModelDownloadProgress {
                    model_id: model.id.clone(),
                    downloaded_bytes: downloaded,
                    total_bytes: total_size,
                    speed_bps,
                    eta_seconds,
                };
                app.emit("model-download-progress", payload).ok();

                last_emit = std::time::Instant::now();
                bytes_since_last_emit = 0;
            }
        }

        if let Err(e) = writer.flush().await {
            return Err(format!("Failed to flush model file buffer: {}", e));
        }
        drop(writer);

        if stream_error {
            if attempts <= MAX_RETRIES && !cancel_flag.load(Ordering::Relaxed) {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                continue;
            }
            return Err("Download connection was interrupted. Please retry.".to_string());
        }

        // Download stream completed successfully
        break;
    }

    // Final Progress Emit (100%)
    let final_size = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(model.size_bytes as u64);

    app.emit("model-download-progress", ModelDownloadProgress {
        model_id: model.id.clone(),
        downloaded_bytes: final_size,
        total_bytes: final_size,
        speed_bps: 0,
        eta_seconds: Some(0),
    }).ok();

    // 2. SHA-256 Integrity Verification on the .part file before promoting
    let expected_hash = model.sha256.trim().to_lowercase();
    if !expected_hash.is_empty() {
        let is_valid = verify_file_sha256(&part_path, &expected_hash)
            .await
            .map_err(|e| format!("Verification error: {}", e))?;

        if !is_valid {
            tokio::fs::remove_file(&part_path).await.ok();
            return Err(format!(
                "Integrity check failed for model {}: SHA-256 checksum mismatch",
                model.id
            ));
        }
    }

    // 3. Atomically rename .part file to final model destination
    tokio::fs::rename(&part_path, &target_path)
        .await
        .map_err(|e| format!("Failed to finalize model file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_compute_sha256() {
        let data = b"Hello HireLens SHA256 Verification";
        let hash = compute_sha256(data);
        assert_eq!(
            hash,
            "df3383fb179bab3b999705ba6ca4399c65fb56431e043fc9c6a406728f77c21c"
        );
    }

    #[tokio::test]
    async fn test_verify_file_sha256_success() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_hirelens_valid_model.bin");
        let content = b"Sample Model Weights File Content for Testing Integrity Check";
        
        {
            let mut f = std::fs::File::create(&file_path).unwrap();
            f.write_all(content).unwrap();
        }

        let expected_hash = compute_sha256(content);
        let result = verify_file_sha256(&file_path, &expected_hash).await;
        
        // Clean up
        std::fs::remove_file(&file_path).ok();

        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[tokio::test]
    async fn test_verify_file_sha256_mismatch() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("test_hirelens_corrupted_model.bin");
        let content = b"Corrupted Model Content";
        
        {
            let mut f = std::fs::File::create(&file_path).unwrap();
            f.write_all(content).unwrap();
        }

        let wrong_hash = "0000000000000000000000000000000000000000000000000000000000000000";
        let result = verify_file_sha256(&file_path, wrong_hash).await;
        
        // Clean up
        std::fs::remove_file(&file_path).ok();

        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_system_info_detection() {
        let info = detect_system_info();
        assert!(info.ram_gb > 0.0);
        assert!(["fast", "balanced", "quality"].contains(&info.recommended_model_tier.as_str()));
    }

    #[test]
    fn test_models_seed_and_query() {
        let temp_db = std::env::temp_dir().join(format!("test_hirelens_db_{}.sqlite", uuid::Uuid::new_v4()));
        let conn = crate::db::connection::init_db(&temp_db).expect("Failed to initialize test DB");

        let models = get_models_from_db(&conn).expect("Failed to query models");
        assert_eq!(models.len(), 3);

        let fast_model = models.iter().find(|m| m.tier == "fast").unwrap();
        assert_eq!(fast_model.sha256, "9c9f56a391a3abbd5b89d0245bf6106081bcc3173119d4229235dd9d23253f94");
        assert_eq!(fast_model.file_name, "Qwen2.5-3B-Instruct-Q4_K_M.gguf");

        let balanced_model = models.iter().find(|m| m.tier == "balanced").unwrap();
        assert_eq!(balanced_model.sha256, "65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423");

        let quality_model = models.iter().find(|m| m.tier == "quality").unwrap();
        assert_eq!(quality_model.sha256, "e47ad95dad6ff848b431053b375adb5d39321290ea2c638682577dafca87c008");

        std::fs::remove_file(&temp_db).ok();
    }
}
