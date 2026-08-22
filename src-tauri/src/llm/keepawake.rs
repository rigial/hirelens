use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[cfg(target_os = "windows")]
extern "system" {
    fn SetThreadExecutionState(es_flags: u32) -> u32;
}

#[cfg(target_os = "windows")]
const ES_CONTINUOUS: u32 = 0x80000000;
#[cfg(target_os = "windows")]
const ES_SYSTEM_REQUIRED: u32 = 0x00000001;
#[cfg(target_os = "windows")]
const ES_DISPLAY_REQUIRED: u32 = 0x00000002;

/// RAII Guard that prevents display and system sleep while active.
pub struct KeepAwakeGuard {
    #[cfg(target_os = "macos")]
    child: Option<std::process::Child>,
    #[cfg(target_os = "windows")]
    previous_state: Option<u32>,
    #[cfg(target_os = "linux")]
    child: Option<std::process::Child>,
    is_active: Arc<AtomicBool>,
}

impl KeepAwakeGuard {
    /// Creates a new keep-awake guard, preventing OS display and system sleep.
    pub fn new(_reason: &str) -> Self {
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
            let is_active = Arc::new(AtomicBool::new(child.is_some()));

            Self { child, is_active }
        }

        #[cfg(target_os = "windows")]
        {
            let prev = unsafe {
                SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED)
            };
            let is_active = Arc::new(AtomicBool::new(prev != 0));
            Self {
                previous_state: if prev != 0 { Some(prev) } else { None },
                is_active,
            }
        }

        #[cfg(target_os = "linux")]
        {
            let child = std::process::Command::new("systemd-inhibit")
                .args(["--what=idle:sleep", "--who=HireLens", "--why=Downloading AI model", "sleep", "86400"])
                .spawn()
                .ok();
            let is_active = Arc::new(AtomicBool::new(child.is_some()));
            Self { child, is_active }
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        {
            Self {
                is_active: Arc::new(AtomicBool::new(false)),
            }
        }
    }

    /// Returns whether the sleep-prevention assertion is actively running.
    pub fn is_active(&self) -> bool {
        self.is_active.load(Ordering::Relaxed)
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

        #[cfg(target_os = "windows")]
        {
            if self.previous_state.is_some() {
                unsafe {
                    SetThreadExecutionState(ES_CONTINUOUS);
                }
            }
        }

        #[cfg(target_os = "linux")]
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
        #[cfg(target_os = "macos")]
        assert!(guard.is_active());
        drop(guard);
    }
}
