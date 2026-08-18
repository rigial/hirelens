use std::collections::HashMap;
use tauri::State;
use rusqlite::params;
use crate::state::app_state::AppState;

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
    for item in iter {
        if let Ok((k, v)) = item {
            map.insert(k, v);
        }
    }
    Ok(map)
}

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

#[tauri::command]
pub async fn get_app_data_dir(
    state: State<'_, AppState>,
) -> Result<String, String> {
    Ok(state.app_data_dir.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    #[test]
    fn test_app_data_dir_path_format() {
        let test_dir = PathBuf::from("/Users/test/.hirelens");
        assert_eq!(test_dir.to_string_lossy(), "/Users/test/.hirelens");
    }
}


