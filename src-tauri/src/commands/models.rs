use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, State, Emitter};
use crate::state::app_state::AppState;
use crate::llm::model_manager::{
    Model, SystemInfo, detect_system_info, get_models_from_db, perform_model_download
};

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    Ok(detect_system_info())
}

#[tauri::command]
pub async fn get_models(
    state: State<'_, AppState>,
) -> Result<Vec<Model>, String> {
    let db = state.db.lock().await;
    get_models_from_db(&db).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    let model = {
        let db = state.db.lock().await;
        let models = get_models_from_db(&db).map_err(|e| e.to_string())?;
        models.into_iter().find(|m| m.id == model_id)
            .ok_or_else(|| format!("Model {} not found", model_id))?
    };

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut flags = state.download_cancel_flags.lock().await;
        flags.insert(model_id.clone(), Arc::clone(&cancel_flag));
    }

    let models_dir = state.app_data_dir.join("models");
    let state_db = Arc::clone(&state.db);
    let model_clone = model.clone();
    let app_clone = app.clone();

    // Mark as downloading in DB
    {
        let db = state_db.lock().await;
        db.execute(
            "UPDATE models SET status = 'downloading' WHERE id = ?1",
            rusqlite::params![model.id],
        ).ok();
    }

    let flags_arc = Arc::clone(&state.download_cancel_flags);

    tauri::async_runtime::spawn(async move {
        let res = perform_model_download(app_clone.clone(), models_dir.clone(), model_clone.clone(), cancel_flag).await;
        
        {
            let mut flags = flags_arc.lock().await;
            flags.remove(&model_clone.id);
        }

        let db = state_db.lock().await;
        match res {
            Ok(_) => {
                let file_path = models_dir.join(&model_clone.file_name).to_string_lossy().to_string();
                let now = chrono::Utc::now().to_rfc3339();
                db.execute(
                    "UPDATE models SET status = 'downloaded', file_path = ?1, downloaded_at = ?2 WHERE id = ?3",
                    rusqlite::params![file_path, now, model_clone.id],
                ).ok();

                app_clone.emit("model-download-complete", serde_json::json!({
                    "model_id": model_clone.id
                })).ok();
            }
            Err(err) => {
                db.execute(
                    "UPDATE models SET status = 'available' WHERE id = ?1",
                    rusqlite::params![model_clone.id],
                ).ok();
                app_clone.emit("model-download-error", serde_json::json!({
                    "model_id": model_clone.id,
                    "error": err
                })).ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_model_download(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    let mut flags = state.download_cancel_flags.lock().await;
    if let Some(flag) = flags.remove(&model_id) {
        flag.store(true, Ordering::Relaxed);
    }
    let db = state.db.lock().await;
    db.execute(
        "UPDATE models SET status = 'available' WHERE id = ?1",
        rusqlite::params![model_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_active_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    let model_path = {
        let db = state.db.lock().await;
        db.execute("UPDATE models SET is_active = 0", []).map_err(|e| e.to_string())?;
        db.execute("UPDATE models SET is_active = 1 WHERE id = ?1", rusqlite::params![model_id]).map_err(|e| e.to_string())?;

        let mut stmt = db.prepare("SELECT file_path FROM models WHERE id = ?1").map_err(|e| e.to_string())?;
        let path: Option<String> = stmt.query_row(rusqlite::params![model_id], |r| r.get(0)).unwrap_or(None);
        path
    };

    let mut llm = state.llm.lock().await;
    if let Some(path) = model_path {
        llm.set_active_model(path);
    } else {
        llm.unload_active_model();
    }

    Ok(())
}
