use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex;
use rusqlite::Connection;

use crate::llm::client::LlamaClient;
use crate::workers::pool::WorkerPool;

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub llm: Arc<Mutex<LlamaClient>>,
    pub worker_pool: Arc<WorkerPool>,
    pub app_data_dir: PathBuf,
    pub download_cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}
