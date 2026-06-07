use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
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
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- Tray Menu ---
            let show_item = MenuItemBuilder::with_id("show", "显示主界面").build(app)?;
            let toggle_pomodoro = MenuItemBuilder::with_id("toggle_pomodoro", "暂停/继续番茄钟").build(app)?;
            let toggle_music = MenuItemBuilder::with_id("toggle_music", "暂停/继续音乐").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出程序").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&toggle_pomodoro)
                .item(&toggle_music)
                .separator()
                .item(&quit_item)
                .build()?;

            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ChillFocus")
                .menu_on_left_click(false)
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
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "toggle_pomodoro" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.eval("window.__togglePomodoro && window.__togglePomodoro()");
                            }
                        }
                        "toggle_music" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.eval("window.__toggleMusic && window.__toggleMusic()");
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
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
        .invoke_handler(tauri::generate_handler![set_minimize_to_tray, force_quit])
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
