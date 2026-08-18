use std::path::Path;
use rusqlite::{Connection, Result};
use crate::db::migrations::INITIAL_MIGRATION;

pub fn init_db<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    if let Some(parent) = db_path.as_ref().parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(db_path)?;

    // Enable foreign keys and WAL mode for reliability and performance
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    conn.execute_batch(INITIAL_MIGRATION)?;

    // Seed default models if table is empty
    let model_count: i64 = conn.query_row("SELECT COUNT(*) FROM models", [], |row| row.get(0)).unwrap_or(0);
    if model_count == 0 {
        let default_models = [
            ("qwen3-4b-q4", "Qwen3 4B (Fast)", "fast", "Qwen3-4B-Q4_K_M.gguf", "https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf", "mock_sha256_fast", 2450000000_i64),
            ("qwen3-8b-q4", "Qwen3 8B (Balanced)", "balanced", "Qwen3-8B-Q4_K_M.gguf", "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf", "mock_sha256_balanced", 4980000000_i64),
            ("qwen3-14b-q4", "Qwen3 14B (Quality)", "quality", "Qwen3-14B-Q4_K_M.gguf", "https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/qwen2.5-14b-instruct-q4_k_m.gguf", "mock_sha256_quality", 8900000000_i64),
        ];

        for (id, display_name, tier, file_name, download_url, sha256, size_bytes) in default_models {
            conn.execute(
                "INSERT INTO models (id, display_name, tier, file_name, download_url, sha256, size_bytes, status, is_active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'available', 0)",
                rusqlite::params![id, display_name, tier, file_name, download_url, sha256, size_bytes],
            ).ok();
        }
    }

    Ok(conn)
}
