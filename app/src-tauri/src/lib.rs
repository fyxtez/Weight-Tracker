use std::fs;
use tauri::Manager;

// Feature: Native CSV export writes to the platform Downloads directory and reports the exact path to the UI.
#[tauri::command]
fn export_report(app: tauri::AppHandle, csv: String, file_name: String) -> Result<String, String> {
    let safe_name: String = file_name
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
        .collect();

    if safe_name.is_empty() || !safe_name.ends_with(".csv") {
        return Err("Invalid report filename".to_string());
    }

    let download_directory = app
        .path()
        .download_dir()
        .map_err(|error| format!("Downloads directory is unavailable: {error}"))?;
    fs::create_dir_all(&download_directory)
        .map_err(|error| format!("Could not create Downloads directory: {error}"))?;

    let report_path = download_directory.join(safe_name);
    fs::write(&report_path, csv)
        .map_err(|error| format!("Could not write report: {error}"))?;

    Ok(report_path.display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Feature: Native file sharing exposes Telegram, WhatsApp, Bluetooth and other Android targets.
        .plugin(tauri_plugin_sharekit::init())
        .invoke_handler(tauri::generate_handler![export_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
