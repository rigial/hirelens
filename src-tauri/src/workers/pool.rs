use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use rusqlite::Connection;
use tauri::AppHandle;

use crate::workers::queue::ProcessingJob;
use crate::llm::client::LlamaClient;
use crate::processing::pipeline::run_processing_pipeline;

pub struct WorkerPool {
    pub sender: mpsc::Sender<ProcessingJob>,
}

impl WorkerPool {
    pub fn new(
        app: AppHandle,
        conn: Arc<Mutex<Connection>>,
        llm: Arc<Mutex<LlamaClient>>,
        concurrency: usize,
    ) -> Self {
        let (tx, rx) = mpsc::channel::<ProcessingJob>(100);
        let rx_arc = Arc::new(Mutex::new(rx));

        for _ in 0..concurrency {
            let rx_clone = Arc::clone(&rx_arc);
            let app_clone = app.clone();
            let conn_clone = Arc::clone(&conn);
            let llm_clone = Arc::clone(&llm);

            tokio::spawn(async move {
                loop {
                    let job_opt = {
                        let mut receiver = rx_clone.lock().await;
                        receiver.recv().await
                    };

                    match job_opt {
                        Some(job) => {
                            let res = run_processing_pipeline(
                                &app_clone,
                                Arc::clone(&conn_clone),
                                Arc::clone(&llm_clone),
                                &job.queue_id,
                                &job.resume_id,
                                &job.job_id,
                            ).await;

                            if let Err(err) = res {
                                eprintln!("Processing job failed for resume {}: {}", job.resume_id, err);
                            }
                        }
                        None => {
                            // Channel closed
                            break;
                        }
                    }
                }
            });
        }

        Self { sender: tx }
    }

    pub async fn enqueue(&self, job: ProcessingJob) -> Result<(), String> {
        self.sender.send(job).await.map_err(|e| format!("Failed to submit job to queue: {}", e))
    }
}
