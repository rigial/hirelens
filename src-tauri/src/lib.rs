use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

pub mod db;
pub mod llm;
pub mod processing;
pub mod workers;
pub mod state;
pub mod commands;

use state::app_state::AppState;
use llm::client::LlamaClient;
use llm::model_manager::detect_system_info;
use workers::pool::WorkerPool;
use workers::queue::ProcessingJob;
use db::connection::init_db;
use db::queries::queue::reset_interrupted_queue;

/// Builds and starts the HireLens Tauri application.
///
/// # Examples
///
/// ```no_run
/// run();
/// ```
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = dirs::data_dir()
                .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
                .join("hirelens");
            std::fs::create_dir_all(&app_data_dir).ok();

            let db_path = app_data_dir.join("hirelens.db");
            let conn = init_db(&db_path).expect("Failed to initialize SQLite database");
            let conn_arc = Arc::new(Mutex::new(conn));

            let sys_info = detect_system_info();
            let concurrency = if sys_info.has_gpu { 4 } else { 2 };

            let mut llama_client = LlamaClient::new();
            {
                let db = conn_arc.blocking_lock();
                let active_path: Option<String> = db.query_row(
                    "SELECT file_path FROM models WHERE is_active = 1 AND status = 'downloaded' AND file_path IS NOT NULL LIMIT 1",
                    [],
                    |row| row.get(0),
                ).ok();
                if let Some(path) = active_path {
                    llama_client.set_active_model(path);
                }
            }

            let llm = Arc::new(Mutex::new(llama_client));
            let worker_pool = Arc::new(WorkerPool::new(
                app.handle().clone(),
                Arc::clone(&conn_arc),
                Arc::clone(&llm),
                concurrency,
            ));

            // Reconcile any interrupted queue items from previous run
            {
                let db = conn_arc.blocking_lock();
                if let Ok(queued_items) = reset_interrupted_queue(&db) {
                    let pool_clone = Arc::clone(&worker_pool);
                    tauri::async_runtime::spawn(async move {
                        for item in queued_items {
                            pool_clone.enqueue(ProcessingJob {
                                queue_id: item.id,
                                resume_id: item.resume_id,
                                job_id: item.job_id,
                                attempt: item.attempts as u32,
                            }).await.ok();
                        }
                    });
                }
            }

            let app_state = AppState {
                db: conn_arc,
                llm,
                worker_pool,
                app_data_dir,
                download_cancel_flags: Arc::new(Mutex::new(HashMap::new())),
            };

            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_settings,
            commands::settings::set_setting,
            commands::settings::get_app_data_dir,
            commands::models::get_models,
            commands::models::download_model,
            commands::models::cancel_model_download,
            commands::models::set_active_model,
            commands::models::get_system_info,
            commands::jobs::create_job,
            commands::jobs::get_jobs,
            commands::jobs::get_job,
            commands::jobs::update_job,
            commands::jobs::archive_job,
            commands::processing::upload_resumes,
            commands::processing::check_duplicate_resumes,
            commands::processing::get_processing_status,
            commands::candidates::get_candidates,
            commands::candidates::get_candidate_detail,
            commands::candidates::update_shortlist_status,
            commands::candidates::retry_resume,
            commands::candidates::reanalyze_job_candidates,
            commands::candidates::search_candidates_semantic,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
