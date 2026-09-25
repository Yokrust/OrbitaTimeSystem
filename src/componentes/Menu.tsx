import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";

interface Props {
  /** Nombre accesible del botón y del menú. */
  etiqueta: string;
  /** Recibe `cerrar` para que cada opción decida cuándo cerrar. */
  children: (cerrar: () => void) => ReactNode;
  /** Contenido del botón; por defecto, los tres puntos. */
  disparador?: ReactNode;
  claseDisparador?: string;
  titulo?: string;
  alinear?: "izquierda" | "derecha";
  /** "dialog" cuando el panel trae un formulario en vez de opciones. */
  rol?: "menu" | "dialog";
  /** `porClic`: se cerró con un clic fuera del panel, no con Esc ni desde una opción. */
  alCerrar?: (porClic: boolean) => void;
}

/**
 * Menú desplegable para las acciones que no hace falta ver todo el tiempo.
 * Se cierra con Esc o con un clic fuera, y se recorre con las flechas.
 */
export function Menu({
  etiqueta,
  children,
  disparador,
  claseDisparador = "btn-icono",
  titulo,
  alinear = "derecha",
  rol = "menu",
  alCerrar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const avisarCierre = useRef(alCerrar);
  avisarCierre.current = alCerrar;

  const cerrar = useCallback((devolverFoco = false, porClic = false) => {
    setAbierto(false);
    avisarCierre.current?.(porClic);
    if (devolverFoco) boton.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!abierto) return;
    panel.current
      ?.querySelector<HTMLElement>('[role^="menuitem"]:not(:disabled), input, button')
      ?.focus({ preventScroll: true });

    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) cerrar(false, true);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar(true);
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const opciones = Array.from(
        panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [],
      );
      if (opciones.length === 0) return;
      e.preventDefault();
      const actual = opciones.indexOf(document.activeElement as HTMLElement);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      const siguiente =
        actual === -1
          ? paso > 0
            ? 0
            : opciones.length - 1
          : (actual + paso + opciones.length) % opciones.length;
      opciones[siguiente].focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto, cerrar]);

  return (
    <div className="menu" ref={raiz}>
      <button
        ref={boton}
        type="button"
        className={claseDisparador}
        aria-label={etiqueta}
        title={titulo ?? etiqueta}
        aria-haspopup={rol}
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => (abierto ? cerrar(false, true) : setAbierto(true))}
      >
        {disparador ?? <Ellipsis size={18} />}
      </button>
      {abierto && (
        <div ref={panel} id={id} className={`menu-panel ${alinear}`} role={rol} aria-label={etiqueta}>
          {children(() => cerrar())}
        </div>
      )}
    </div>
  );
}
