//! ORBTIME — parte nativa.
//!
//! Aquí solo vive lo que el navegador no puede hacer:
//!   * quedarse en la barra de menús cuando cierran la ventana,
//!   * un latido que despierta al frontend para revisar las alarmas aunque
//!     macOS haya congelado los temporizadores del webview,
//!   * el menú de la bandeja para exportar o salir sin abrir la ventana,
//!   * aplazar cualquier salida hasta que la interfaz deje el reporte en disco.
//!
//! Toda la lógica de negocio (tiempos, cobros, reporte) está del lado de React.

#[cfg(target_os = "macos")]
mod salida_macos;

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

/// ¿Ya se pidió salir? El aviso orbtime://salir no espera a nadie: si llegó
/// mientras la interfaz cargaba el día, se perdió. Ella lo pregunta al escuchar.
#[tauri::command]
fn salida_pedida(prefs: tauri::State<'_, Preferencias>) -> bool {
    prefs.saliendo.load(Ordering::Relaxed)
}

/// Salida de verdad. El frontend la llama después de exportar el reporte.
#[tauri::command]
fn salir_app(app: tauri::AppHandle) {
    terminar(&app);
}

/// Si la salida la pidió macOS (Dock, cerrar sesión), está esperando respuesta
/// y hay que dársela; si no, basta con cerrar el bucle de eventos.
fn terminar(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    if salida_macos::responder(app) {
        return;
    }
    app.exit(0);
}

fn mostrar_ventana(app: &tauri::AppHandle) {
    if let Some(ventana) = app.get_webview_window("main") {
        let _ = ventana.show();
        let _ = ventana.unminimize();
        let _ = ventana.set_focus();
    }
}

/// Pide el reporte al frontend y sale aunque no conteste. false si ya estaba saliendo.
fn pedir_salida(app: &tauri::AppHandle) -> bool {
    let prefs = app.state::<Preferencias>();
    if prefs.saliendo.swap(true, Ordering::Relaxed) {
        return false;
    }
    let _ = app.emit("orbtime://salir", ());

    // Red de seguridad: si la interfaz no responde, salir igual.
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(ESPERA_SALIDA_SEGUNDOS));
        terminar(&handle);
    });
    true
}

/// El "Quit" del menú se cambia por uno propio que pide el reporte directamente,
/// sin pasar por terminate:. El Dock y cerrar sesión sí pasan: ver salida_macos.
#[cfg(target_os = "macos")]
fn menu_de_la_app(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    use tauri::menu::MenuItemKind;

    let menu = Menu::default(app)?;
    if let Some(MenuItemKind::Submenu(submenu)) = menu.items()?.into_iter().next() {
        // En el menú por defecto, "Quit" es lo último del submenú de la app.
        if let Some(MenuItemKind::Predefined(quit)) = submenu.items()?.pop() {
            let texto = quit.text()?;
            submenu.remove(&quit)?;
            submenu.append(&MenuItem::with_id(app, "salir-app", texto, true, Some("CmdOrCtrl+Q"))?)?;
        }
    }
    Ok(menu)
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
        .invoke_handler(tauri::generate_handler![set_ocultar_al_cerrar, salida_pedida, salir_app])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                app.set_menu(menu_de_la_app(app.handle())?)?;
                salida_macos::instalar(app.handle());
            }
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
                // La ventana no se destruye nunca: sin ella no hay interfaz que
                // guarde el reporte.
                api.prevent_close();
                let app = ventana.app_handle();
                if app.state::<Preferencias>().ocultar_al_cerrar.load(Ordering::Relaxed) {
                    let _ = ventana.hide();
                } else {
                    pedir_salida(app);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar ORBTIME")
        .run(|app, evento| match &evento {
            // Click en el ícono del Dock con la ventana escondida.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => mostrar_ventana(app),

            // No quedan ventanas (no debería pasar: cerrar solo oculta o pide la
            // salida). `code` viene vacío solo en ese caso; el de salir_app trae
            // Some(0) y ese sí se deja pasar.
            tauri::RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
                if pedir_salida(app) {
                    api.prevent_exit();
                }
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

    // Solo la silueta de la ō (Logo/OrbitaBlack.svg en negro sobre transparente,
    // 26×36 px = 18 pt a 2x). Como plantilla, macOS la pinta blanca o negra según
    // la barra de menús, igual que los íconos del sistema.
    TrayIconBuilder::with_id("orbtime-tray")
        .icon(tauri::include_image!("icons/bandeja.png"))
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("ORBTIME")
        .on_menu_event(|app, evento| match evento.id.as_ref() {
            "abrir" => mostrar_ventana(app),
            // El frontend es el que sabe exportar; aquí solo se le avisa.
            "exportar" => {
                let _ = app.emit("orbtime://exportar", ());
            }
            // Este manejador recibe cualquier evento de menú, también el ⌘Q de la app.
            "salir" | "salir-app" => {
                pedir_salida(app);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
