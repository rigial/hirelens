use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use futures_util::StreamExt;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub ram_gb: f32,
    pub has_gpu: bool,
    pub gpu_type: Option<String>,
    pub recommended_model_tier: String,
    pub cpu_cores: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct ModelDownloadProgress {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
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

pub async fn perform_model_download(
    app: AppHandle,
    models_dir: PathBuf,
    model: Model,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;
    let target_path = models_dir.join(&model.file_name);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(&model.download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to initiate download: {}", e))?;

    let total_size = response.content_length().unwrap_or(model.size_bytes as u64);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();
    let mut bytes_since_last_emit: u64 = 0;

    use tokio::io::AsyncWriteExt;
    let mut file = tokio::fs::File::create(&target_path)
        .await
        .map_err(|e| format!("Failed to create model file: {}", e))?;

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            drop(file);
            tokio::fs::remove_file(&target_path).await.ok();
            return Err("Download cancelled by user".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
        file.write_all(&chunk).await.map_err(|e| format!("File write error: {}", e))?;

        downloaded += chunk.len() as u64;
        bytes_since_last_emit += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 250 {
            let elapsed_sec = last_emit.elapsed().as_secs_f64();
            let speed_bps = if elapsed_sec > 0.0 { (bytes_since_last_emit as f64 / elapsed_sec) as u64 } else { 0 };

            let payload = ModelDownloadProgress {
                model_id: model.id.clone(),
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                speed_bps,
            };
            app.emit("model-download-progress", payload).ok();

            last_emit = std::time::Instant::now();
            bytes_since_last_emit = 0;
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;

    app.emit("model-download-complete", serde_json::json!({ "model_id": model.id })).ok();

    Ok(())
}
