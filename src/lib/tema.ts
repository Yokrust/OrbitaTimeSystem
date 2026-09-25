/**
 * Apariencia de la app: igual que el sistema, o fija en claro u oscuro.
 *
 * Es una preferencia de esta Mac, no del negocio: vive en localStorage y no
 * viaja con el estado del día. En <html> se marca con data-tema, y los
 * tokens de estilos.css hacen el resto. En "sistema" no hay atributo y manda
 * prefers-color-scheme.
 */
import { enTauri } from "./entorno";

export type Tema = "sistema" | "claro" | "oscuro";

const CLAVE = "orbtime:tema";

export function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado === "claro" || guardado === "oscuro") return guardado;
  } catch {
    // Sin almacenamiento disponible: se queda como el sistema.
  }
  return "sistema";
}

export function guardarTema(tema: Tema): void {
  try {
    if (tema === "sistema") localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, tema);
  } catch {
    // No se pudo guardar: el cambio vale hasta cerrar la app.
  }
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === "sistema") delete raiz.dataset.tema;
  else raiz.dataset.tema = tema;

  // La ventana nativa también: semáforos, menús y barras de scroll de macOS.
  if (!enTauri()) return;
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) =>
      getCurrentWindow().setTheme(tema === "sistema" ? null : tema === "claro" ? "light" : "dark"),
    )
    .catch((e) => console.error("[tema] no se pudo cambiar la ventana:", e));
}

/**
 * Hace el cambio de una sola vez: sin transiciones de CSS a medias (cada
 * botón cambiaría a su ritmo) y, donde se puede, con un fundido de toda la
 * ventana.
 */
export function conTransicion(cambiar: () => void): void {
  const raiz = document.documentElement;
  raiz.classList.add("cambiando-tema");
  const soltar = () => setTimeout(() => raiz.classList.remove("cambiando-tema"), 0);

  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (sinMovimiento || !("startViewTransition" in document)) {
    cambiar();
    // Leer un estilo obliga a pintar ya con el tema nuevo, antes de soltar.
    void getComputedStyle(document.body).backgroundColor;
    soltar();
    return;
  }
  document.startViewTransition(cambiar).finished.finally(soltar);
}
