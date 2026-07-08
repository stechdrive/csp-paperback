use std::path::PathBuf;

use tauri::{LogicalSize, Manager, Size};
use tauri_plugin_fs::FsExt;

fn launch_file_args() -> Vec<String> {
    std::env::args_os()
        .skip(1)
        .map(|arg| arg.to_string_lossy().to_string())
        .collect()
}

fn has_quick_export_args() -> bool {
    launch_file_args()
        .iter()
        .any(|arg| is_quick_export_file(arg))
}

fn is_quick_export_file(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".psd") || lower.ends_with(".xdts")
}

#[tauri::command]
fn get_launch_args() -> Vec<String> {
    launch_file_args()
}

#[tauri::command]
fn allow_launch_file_paths(app: tauri::AppHandle) -> Result<(), String> {
    let scope = app.fs_scope();

    for arg in launch_file_args()
        .into_iter()
        .filter(|path| is_quick_export_file(path))
    {
        let is_xdts = arg.to_ascii_lowercase().ends_with(".xdts");
        let path = PathBuf::from(arg);
        scope.allow_file(&path).map_err(|error| error.to_string())?;

        if is_xdts {
            if let Some(parent) = path.parent() {
                scope
                    .allow_directory(parent, true)
                    .map_err(|error| error.to_string())?;
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_launch_args,
            allow_launch_file_paths
        ])
        .setup(|app| {
            if has_quick_export_args() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("CSP Paperback クイック書き出し");
                    let _ = window.set_resizable(false);
                    let _ = window.set_size(Size::Logical(LogicalSize {
                        width: 460.0,
                        height: 300.0,
                    }));
                    let _ = window.center();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
