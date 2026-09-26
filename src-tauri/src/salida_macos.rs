//! macOS: salir desde el Dock, al cerrar sesión o con `quit` de AppleScript.
//!
//! Todo eso llega como -[NSApplication terminate:], y el delegado de tao no
//! implementa applicationShouldTerminate:, así que macOS sale sin preguntar y
//! sin reporte. Aquí se le añade ese método: la salida se aplaza
//! (NSTerminateLater) mientras la interfaz deja el reporte en disco, y se
//! confirma con replyToApplicationShouldTerminate:.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use objc2::ffi::class_addMethod;
use objc2::runtime::{AnyClass, AnyObject, Bool, Imp, Sel};
use objc2::{class, msg_send, sel};

const NS_TERMINATE_NOW: usize = 1;
const NS_TERMINATE_LATER: usize = 2;

static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

/// macOS está esperando la respuesta a una salida aplazada.
static PENDIENTE: AtomicBool = AtomicBool::new(false);

/// Engancha applicationShouldTerminate: al delegado de la app. Una vez, en setup.
pub fn instalar(app: &tauri::AppHandle) {
    let _ = APP.set(app.clone());
    unsafe {
        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        let delegado: *mut AnyObject = msg_send![ns_app, delegate];
        let Some(delegado) = delegado.as_ref() else {
            eprintln!("[salida] la app no tiene delegado: el Dock saldrá sin reporte");
            return;
        };
        let clase = delegado.class() as *const AnyClass as *mut AnyClass;
        let imp: Imp = std::mem::transmute(
            debe_terminar as unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject) -> usize,
        );
        // Q: NSApplicationTerminateReply; @ self, : _cmd, @ sender.
        if !class_addMethod(clase, sel!(applicationShouldTerminate:), imp, c"Q@:@".as_ptr()).as_bool() {
            eprintln!("[salida] el delegado ya decide la salida; no se toca");
        }
    }
}

unsafe extern "C-unwind" fn debe_terminar(_: *mut AnyObject, _: Sel, _: *mut AnyObject) -> usize {
    let Some(app) = APP.get() else {
        return NS_TERMINATE_NOW;
    };
    PENDIENTE.store(true, Ordering::SeqCst);
    // Si ya se estaba saliendo (⌘Q, bandeja), esa salida contestará por las dos.
    crate::pedir_salida(app);
    NS_TERMINATE_LATER
}

/// Contesta que sí a una salida aplazada. false si macOS no esperaba ninguna.
pub fn responder(app: &tauri::AppHandle) -> bool {
    if !PENDIENTE.swap(false, Ordering::SeqCst) {
        return false;
    }
    let _ = app.run_on_main_thread(|| unsafe {
        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        let _: () = msg_send![ns_app, replyToApplicationShouldTerminate: Bool::YES];
    });
    true
}
