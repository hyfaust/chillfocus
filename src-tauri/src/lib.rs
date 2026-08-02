use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- Tray Menu ---
            let show_item = MenuItemBuilder::with_id("show", "显示/隐藏主界面").build(app)?;
            let prev_track = MenuItemBuilder::with_id("prev_track", "上一首").build(app)?;
            let toggle_music = MenuItemBuilder::with_id("toggle_music", "暂停/继续音乐").build(app)?;
            let next_track = MenuItemBuilder::with_id("next_track", "下一首").build(app)?;
            let toggle_ambient = MenuItemBuilder::with_id("toggle_ambient", "暂停/继续环境音").build(app)?;
            let toggle_pomodoro = MenuItemBuilder::with_id("toggle_pomodoro", "暂停/继续番茄钟").build(app)?;

            // Play mode submenu
            let mode_sequential = MenuItemBuilder::with_id("mode_sequential", "顺序播放").build(app)?;
            let mode_loop_list = MenuItemBuilder::with_id("mode_loop_list", "列表循环").build(app)?;
            let mode_loop_single = MenuItemBuilder::with_id("mode_loop_single", "单曲循环").build(app)?;
            let mode_shuffle = MenuItemBuilder::with_id("mode_shuffle", "随机播放").build(app)?;
            let mode_single = MenuItemBuilder::with_id("mode_single", "单曲播放").build(app)?;
            let play_mode_submenu = SubmenuBuilder::new(app, "切换播放模式")
                .item(&mode_sequential)
                .item(&mode_loop_list)
                .item(&mode_loop_single)
                .item(&mode_shuffle)
                .item(&mode_single)
                .build()?;

            let quit_item = MenuItemBuilder::with_id("quit", "退出程序").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&prev_track)
                .item(&toggle_music)
                .item(&next_track)
                .item(&toggle_ambient)
                .separator()
                .item(&toggle_pomodoro)
                .item(&play_mode_submenu)
                .separator()
                .item(&quit_item)
                .build()?;

            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ChillFocus")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |tray, event| {
                    let app = tray.app_handle();
                    match event {
                        // Left click → show window
                        TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        // Right click → menu is shown automatically by Tauri
                        _ => {}
                    }
                })
                .on_menu_event(move |app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id().as_ref() {
                            "show" => {
                                let _ = window.eval("window.__showHideWindow && window.__showHideWindow()");
                            }
                            "prev_track" => {
                                let _ = window.eval("window.__prevTrack && window.__prevTrack()");
                            }
                            "toggle_music" => {
                                let _ = window.eval("window.__toggleMusic && window.__toggleMusic()");
                            }
                            "next_track" => {
                                let _ = window.eval("window.__nextTrack && window.__nextTrack()");
                            }
                            "toggle_ambient" => {
                                let _ = window.eval("window.__toggleAmbient && window.__toggleAmbient()");
                            }
                            "toggle_pomodoro" => {
                                let _ = window.eval("window.__togglePomodoro && window.__togglePomodoro()");
                            }
                            "mode_sequential" => {
                                let _ = window.eval("window.__setPlayMode && window.__setPlayMode('sequential')");
                            }
                            "mode_loop_list" => {
                                let _ = window.eval("window.__setPlayMode && window.__setPlayMode('loop-list')");
                            }
                            "mode_loop_single" => {
                                let _ = window.eval("window.__setPlayMode && window.__setPlayMode('loop-single')");
                            }
                            "mode_shuffle" => {
                                let _ = window.eval("window.__setPlayMode && window.__setPlayMode('shuffle')");
                            }
                            "mode_single" => {
                                let _ = window.eval("window.__setPlayMode && window.__setPlayMode('single')");
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            // --- Close to tray ---
            let app_handle2 = app_handle.clone();
            if let Some(window) = app.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        let minimize = app_handle2
                            .state::<AppState>()
                            .minimize_to_tray
                            .load(std::sync::atomic::Ordering::Relaxed);
                        if minimize {
                            api.prevent_close();
                            if let Some(w) = app_handle2.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![set_minimize_to_tray, force_quit, set_autostart_flag, is_autostart_launch, open_in_explorer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
struct AppState {
    minimize_to_tray: AtomicBool,
}

#[tauri::command]
fn set_minimize_to_tray(state: tauri::State<AppState>, enabled: bool) {
    state.minimize_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
fn force_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn set_autostart_flag(enable: bool) {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Run", KEY_READ | KEY_WRITE) {
        let app_name = "ChillFocus";
        if enable {
            if let Ok(val) = key.get_value::<String, _>(app_name) {
                if !val.contains("--autostart") {
                    let _ = key.set_value(app_name, &format!("{} --autostart", val));
                }
            }
        } else {
            if let Ok(val) = key.get_value::<String, _>(app_name) {
                let cleaned = val.replace(" --autostart", "").replace("--autostart", "");
                let _ = key.set_value(app_name, &cleaned);
            }
        }
    }
}

#[tauri::command]
fn is_autostart_launch() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
