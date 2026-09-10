//! ORBTIME — parte nativa.
//!
//! Aquí solo vive lo que el navegador no puede hacer:
//!   * quedarse en la barra de menús cuando cierran la ventana,
//!   * un latido que despierta al frontend para revisar las alarmas aunque
//!     macOS haya congelado los temporizadores del webview,
//!   * el menú de la bandeja para exportar o salir sin abrir la ventana.
//!
//! Toda la lógica de negocio (tiempos, cobros, reporte) está del lado de React.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

/// Cada cuánto se despierta al frontend para que revise si toca alarma.
const LATIDO_SEGUNDOS: u64 = 30;

/// Cuánto se le da al frontend para guardar el reporte antes de salir a la
/// fuerza. Si el webview no contesta, la app se cierra igual.
const ESPERA_SALIDA_SEGUNDOS: u64 = 5;

/// Preferencias que el backend necesita conocer. Las manda el frontend.
struct Preferencias {
    ocultar_al_cerrar: AtomicBool,
    /// Ya se pidió el reporte de salida; no volver a aplazar el cierre.
    saliendo: AtomicBool,
}

/// El botón de cerrar la ventana esconde la app en vez de matarla, para que
/// los relojes sigan corriendo. Lo activa/desactiva el ajuste de la interfaz.
#[tauri::command]
fn set_ocultar_al_cerrar(prefs: tauri::State<'_, Preferencias>, valor: bool) {
    prefs.ocultar_al_cerrar.store(valor, Ordering::Relaxed);
}

/// Salida de verdad. El frontend la llama después de exportar el reporte.
#[tauri::command]
fn salir_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn mostrar_ventana(app: &tauri::AppHandle) {
    if let Some(ventana) = app.get_webview_window("main") {
        let _ = ventana.show();
        let _ = ventana.unminimize();
        let _ = ventana.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(Preferencias {
            ocultar_al_cerrar: AtomicBool::new(true),
            saliendo: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![set_ocultar_al_cerrar, salir_app])
        .setup(|app| {
            construir_bandeja(app.handle())?;

            // Latido: no calcula nada, solo le da un empujón al frontend.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(LATIDO_SEGUNDOS));
                if handle.emit("orbtime://latido", ()).is_err() {
                    break; // la app se está cerrando
                }
            });

            Ok(())
        })
        .on_window_event(|ventana, evento| {
            if let WindowEvent::CloseRequested { api, .. } = evento {
                let prefs = ventana.app_handle().state::<Preferencias>();
                if prefs.ocultar_al_cerrar.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = ventana.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar ORBTIME")
        .run(|app, evento| match &evento {
            // Click en el ícono del Dock con la ventana escondida.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => mostrar_ventana(app),

            // Salida pedida por el sistema: Cmd+Q, "Salir" del Dock, apagar la
            // Mac. `code` viene vacío justo en esos casos; cuando el frontend
            // llama a salir_app trae Some(0) y entonces sí se deja salir.
            tauri::RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
                let prefs = app.state::<Preferencias>();
                if prefs.saliendo.swap(true, Ordering::Relaxed) {
                    return; // ya se pidió; no aplazar de nuevo
                }
                api.prevent_exit();
                let _ = app.emit("orbtime://salir", ());

                // Red de seguridad: si la interfaz no responde, salir igual.
                let handle = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs(ESPERA_SALIDA_SEGUNDOS));
                    handle.exit(0);
                });
            }

            _ => {}
        });
}

fn construir_bandeja(app: &tauri::AppHandle) -> tauri::Result<()> {
    let abrir = MenuItem::with_id(app, "abrir", "Abrir ORBTIME", true, None::<&str>)?;
    let exportar = MenuItem::with_id(app, "exportar", "Exportar reporte de hoy", true, None::<&str>)?;
    let separador = PredefinedMenuItem::separator(app)?;
    let salir = MenuItem::with_id(app, "salir", "Cerrar día y salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&abrir, &exportar, &separador, &salir])?;

    let mut bandeja = TrayIconBuilder::with_id("orbtime-tray")
        .menu(&menu)
        .tooltip("ORBTIME")
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "abrir" => mostrar_ventana(app),
            // El frontend es el que sabe exportar; aquí solo se le avisa.
            "exportar" => {
                let _ = app.emit("orbtime://exportar", ());
            }
            "salir" => {
                let _ = app.emit("orbtime://salir", ());
            }
            _ => {}
        });

    if let Some(icono) = app.default_window_icon() {
        bandeja = bandeja.icon(icono.clone());
    }

    bandeja.build(app)?;
    Ok(())
}
