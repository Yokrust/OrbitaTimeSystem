import type { KeyboardEvent, ReactNode } from "react";

export interface OpcionSegmento<T extends string> {
  valor: T;
  etiqueta: string;
  icono?: ReactNode;
}

interface Props<T extends string> {
  /** Nombre accesible del grupo. */
  etiqueta: string;
  opciones: OpcionSegmento<T>[];
  valor: T;
  onCambio: (valor: T) => void;
  grande?: boolean;
  /** Solo el ícono; la etiqueta queda como nombre accesible y como tooltip. */
  soloIconos?: boolean;
}

/** Control segmentado: una sola opción activa, como los de macOS. */
export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  grande,
  soloIconos,
}: Props<T>) {
  const clases = ["segmentado", grande && "grande", soloIconos && "iconos"].filter(Boolean).join(" ");
  return (
    <div
      className={clases}
      role="radiogroup"
      aria-label={etiqueta}
      onKeyDown={moverConFlechas}
    >
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activo}
            tabIndex={activo ? 0 : -1}
            onClick={() => onCambio(o.valor)}
            aria-label={soloIconos ? o.etiqueta : undefined}
            title={soloIconos ? o.etiqueta : undefined}
          >
            {o.icono}
            {!soloIconos && o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

/** Las flechas mueven la selección entre los radios del grupo. */
export function moverConFlechas(e: KeyboardEvent<HTMLElement>) {
  const adelante = e.key === "ArrowRight" || e.key === "ArrowDown";
  const atras = e.key === "ArrowLeft" || e.key === "ArrowUp";
  if (!adelante && !atras) return;
  const radios = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not(:disabled)'),
  );
  const actual = radios.indexOf(document.activeElement as HTMLElement);
  if (actual === -1) return;
  e.preventDefault();
  const siguiente = radios[(actual + (adelante ? 1 : -1) + radios.length) % radios.length];
  siguiente.focus();
  siguiente.click();
}
