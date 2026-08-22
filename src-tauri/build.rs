fn main() {
    #[cfg(target_os = "macos")]
    {
        let swift_src = "native/vision_ocr.swift";
        let out_bin = "native/vision_ocr";
        if std::path::Path::new(swift_src).exists() {
            println!("cargo:rerun-if-changed={}", swift_src);
            let _ = std::process::Command::new("swiftc")
                .arg("-O")
                .arg(swift_src)
                .arg("-o")
                .arg(out_bin)
                .status();
        }
    }

    tauri_build::build()
}
