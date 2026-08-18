use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingJob {
    pub queue_id: String,
    pub resume_id: String,
    pub job_id: String,
    pub attempt: u32,
}
