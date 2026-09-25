import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  titulo: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: boolean;
  /** Mientras hay trabajo en curso (exportando) no se deja cerrar. */
  ocupado?: boolean;
}

/**
 * Ventana modal: Esc y clic fuera la cierran, el foco se queda adentro y al
 * salir vuelve a donde estaba. El elemento con `data-autofocus` recibe el foco
 * al abrir (autoFocus de React no sobrevive al doble montaje de StrictMode).
 */
export function Modal({ titulo, onCerrar, children, pie, ancho, ocupado }: Props) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const previo = useRef<Element | null>(document.activeElement);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  const bloqueado = useRef(ocupado);
  bloqueado.current = ocupado;

  useEffect(() => {
    const destino = caja.current?.querySelector<HTMLElement>("[data-autofocus]") ?? caja.current;
    destino?.focus({ preventScroll: true });

    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !bloqueado.current) {
        e.preventDefault();
        cerrar.current();
        return;
      }
      if (e.key !== "Tab" || !caja.current) return;
      const focables = Array.from(
        caja.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
        ),
      ).filter((el) => el.tabIndex >= 0);
      if (focables.length === 0) return;
      const primero = focables[0];
      const ultimo = focables[focables.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === primero || activo === caja.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      (previo.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className="velo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !ocupado) onCerrar();
      }}
    >
      <div
        ref={caja}
        className={`modal${ancho ? " ancho" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <header className="modal-cabeza">
          <h2 id={id}>{titulo}</h2>
          <button
            type="button"
            className="btn-icono"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  );
}
