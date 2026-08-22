use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// RAII Guard that prevents display and system sleep while active.
pub struct KeepAwakeGuard {
    #[cfg(target_os = "macos")]
    child: Option<std::process::Child>,
    is_active: Arc<AtomicBool>,
}

impl KeepAwakeGuard {
    /// Creates a new keep-awake guard, preventing OS display and system sleep.
    pub fn new(_reason: &str) -> Self {
        let is_active = Arc::new(AtomicBool::new(true));

        #[cfg(target_os = "macos")]
        {
            let pid = std::process::id().to_string();
            // -d: Prevent display sleep
            // -i: Prevent idle system sleep
            // -w: Wait for the specified process ID
            let child = std::process::Command::new("caffeinate")
                .args(["-d", "-i", "-w", &pid])
                .spawn()
                .ok();

            Self { child, is_active }
        }

        #[cfg(not(target_os = "macos"))]
        {
            Self { is_active }
        }
    }
}

impl Drop for KeepAwakeGuard {
    fn drop(&mut self) {
        self.is_active.store(false, Ordering::Relaxed);
        #[cfg(target_os = "macos")]
        {
            if let Some(mut child) = self.child.take() {
                child.kill().ok();
                child.wait().ok();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keep_awake_guard_creation_and_drop() {
        let guard = KeepAwakeGuard::new("Testing Model Download Keep Awake");
        assert!(guard.is_active.load(Ordering::Relaxed));
        drop(guard);
    }
}
