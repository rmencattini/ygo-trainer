//! Card image cache on disk: `<app cache dir>/images/<key>`.
//! Bytes travel as raw IPC bodies, not JSON arrays.

use std::path::PathBuf;
use tauri::{ipc, AppHandle, Manager};

/// Keys look like `89631139.jpg` or `89631139.small.jpg`; nothing else may touch the disk.
pub fn is_safe_key(key: &str) -> bool {
    let stem = key
        .strip_suffix(".small.jpg")
        .or_else(|| key.strip_suffix(".jpg"));
    matches!(stem, Some(s) if !s.is_empty() && s.bytes().all(|b| b.is_ascii_digit()))
}

fn image_path(app: &AppHandle, key: &str) -> Result<PathBuf, String> {
    if !is_safe_key(key) {
        return Err(format!("bad image key: {key}"));
    }
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("images").join(key))
}

#[tauri::command]
pub fn image_cache_read(app: AppHandle, key: String) -> Result<ipc::Response, String> {
    match std::fs::read(image_path(&app, &key)?) {
        Ok(bytes) => Ok(ipc::Response::new(bytes)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ipc::Response::new(Vec::new())),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn image_cache_write(app: AppHandle, request: ipc::Request<'_>) -> Result<(), String> {
    let key = request
        .headers()
        .get("x-image-key")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-image-key header")?;
    let ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let path = image_path(&app, key)?;
    std::fs::create_dir_all(path.parent().expect("images dir")).map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::is_safe_key;

    #[test]
    fn accepts_card_image_keys() {
        assert!(is_safe_key("89631139.jpg"));
        assert!(is_safe_key("89631139.small.jpg"));
    }

    #[test]
    fn rejects_anything_else() {
        for key in [
            "",
            ".jpg",
            "../1.jpg",
            "1.png",
            "a1.jpg",
            "1/2.jpg",
            "1.jpg/..",
            "1.small.small.jpg",
        ] {
            assert!(!is_safe_key(key), "{key}");
        }
    }
}
