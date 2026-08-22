use std::path::Path;
use std::sync::Once;
use rusqlite::{Connection, Result};
use sqlite_vec::sqlite3_vec_init;
use rusqlite::ffi::sqlite3_auto_extension;
use crate::db::migrations::INITIAL_MIGRATION;

static INIT_SQLITE_VEC: Once = Once::new();

#[allow(clippy::missing_transmute_annotations)]
pub fn register_sqlite_vec_extension() {
    INIT_SQLITE_VEC.call_once(|| {
        unsafe {
            sqlite3_auto_extension(Some(std::mem::transmute(
                sqlite3_vec_init as *const (),
            )));
        }
    });
}

pub fn init_db<P: AsRef<Path>>(db_path: P) -> Result<Connection> {
    register_sqlite_vec_extension();

    if let Some(parent) = db_path.as_ref().parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(db_path)?;

    // Enable foreign keys and WAL mode for reliability and performance
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
    conn.execute_batch(INITIAL_MIGRATION)?;

    // Safe migrations for newly added columns
    let _ = conn.execute("ALTER TABLE jobs ADD COLUMN min_experience_years REAL;", []);
    let _ = conn.execute("ALTER TABLE jobs ADD COLUMN max_experience_years REAL;", []);

    let default_models = [
        (
            "qwen3-4b-q4",
            "Qwen3 4B (Fast)",
            "fast",
            "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
            "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
            "9c9f56a391a3abbd5b89d0245bf6106081bcc3173119d4229235dd9d23253f94",
            1929903264_i64,
        ),
        (
            "qwen3-8b-q4",
            "Qwen3 8B (Balanced)",
            "balanced",
            "Qwen2.5-7B-Instruct-Q4_K_M.gguf",
            "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
            "65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423",
            4683074240_i64,
        ),
        (
            "qwen3-14b-q4",
            "Qwen3 14B (Quality)",
            "quality",
            "Qwen2.5-14B-Instruct-Q4_K_M.gguf",
            "https://huggingface.co/bartowski/Qwen2.5-14B-Instruct-GGUF/resolve/main/Qwen2.5-14B-Instruct-Q4_K_M.gguf",
            "e47ad95dad6ff848b431053b375adb5d39321290ea2c638682577dafca87c008",
            8988110976_i64,
        ),
    ];

    // Seed default models if table is empty
    let model_count: i64 = conn.query_row("SELECT COUNT(*) FROM models", [], |row| row.get(0)).unwrap_or(0);
    if model_count == 0 {
        for (id, display_name, tier, file_name, download_url, sha256, size_bytes) in default_models {
            conn.execute(
                "INSERT INTO models (id, display_name, tier, file_name, download_url, sha256, size_bytes, status, is_active)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'available', 0)",
                rusqlite::params![id, display_name, tier, file_name, download_url, sha256, size_bytes],
            ).ok();
        }
    } else {
        // Upgrade legacy/mock entries if present
        for (id, display_name, tier, file_name, download_url, sha256, size_bytes) in default_models {
            conn.execute(
                "UPDATE models 
                 SET display_name = ?2, tier = ?3, file_name = ?4, download_url = ?5, sha256 = ?6, size_bytes = ?7
                 WHERE id = ?1 AND (sha256 LIKE 'mock_%' OR download_url LIKE '%Qwen/Qwen2.5-7B%' OR download_url LIKE '%Qwen/Qwen2.5-14B%')",
                rusqlite::params![id, display_name, tier, file_name, download_url, sha256, size_bytes],
            ).ok();
        }
    }

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_vec_extension_loaded() {
        let temp_dir = std::env::temp_dir();
        let db_path = temp_dir.join(format!("test_vec_{}.db", uuid::Uuid::new_v4()));
        let conn = init_db(&db_path).expect("Failed to initialize DB with sqlite-vec");

        let version: String = conn.query_row("SELECT vec_version()", [], |r| r.get(0))
            .expect("Failed to query vec_version()");
        assert!(!version.is_empty(), "vec_version should return non-empty version string");

        // Verify vec functions work (e.g. vec_distance_cosine)
        let dist: f64 = conn.query_row(
            "SELECT vec_distance_cosine(?, ?)",
            rusqlite::params![
                crate::db::queries::embeddings::vector_to_blob(&[1.0, 0.0, 0.0]),
                crate::db::queries::embeddings::vector_to_blob(&[1.0, 0.0, 0.0]),
            ],
            |r| r.get(0),
        ).unwrap_or(0.0);

        assert!((dist - 0.0).abs() < 1e-4);

        std::fs::remove_file(&db_path).ok();
    }
}

