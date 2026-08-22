use std::collections::HashMap;
use std::path::Path;
use tauri::State;
use rusqlite::params;
use crate::state::app_state::AppState;

/// Formats the application data directory path into a canonical string representation.
pub fn format_app_data_dir(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

/// Retrieves all persisted key-value application settings from the database.
#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let db = state.db.lock().await;
    let mut stmt = db.prepare("SELECT key, value FROM settings").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for (k, v) in iter.flatten() {
        map.insert(k, v);
    }
    Ok(map)
}

/// Upserts an individual application setting key-value pair into the database.
///
/// # Errors
/// Returns an error if the database query fails.
#[tauri::command]
pub async fn set_setting(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().await;
    db.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

/// Returns the filesystem path to the application's local data storage directory.
///
/// # Returns
/// The formatted application data directory path as a string.
#[tauri::command]
pub async fn get_app_data_dir(
    state: State<'_, AppState>,
) -> Result<String, String> {
    Ok(format_app_data_dir(&state.app_data_dir))
}

/// Opens a file or directory using the host operating system's default viewer/application.
#[tauri::command]
pub async fn open_file_path(
    path: String,
) -> Result<(), String> {
    let is_url = path.starts_with("http://") || path.starts_with("https://");
    if !is_url {
        let p = Path::new(&path);
        if !p.exists() {
            return Err(format!("File does not exist on disk: {}", path));
        }
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
        Ok(())
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_app_data_dir() {
        let test_dir = PathBuf::from("/Users/test/.hirelens");
        assert_eq!(format_app_data_dir(&test_dir), "/Users/test/.hirelens");

        let nested_dir = PathBuf::from("/var/data/hirelens/storage");
        assert_eq!(format_app_data_dir(&nested_dir), "/var/data/hirelens/storage");
    }
}
