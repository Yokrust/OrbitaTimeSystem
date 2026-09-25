import type { CSSProperties } from "react";

interface Props {
  nombre: string;
  /** Color del paquete: el avatar lo toma para que se vea de qué paquete es. */
  tono: string;
  /** 0 a 1: cuánto lleva de la hora que ya se le está cobrando. Sin anillo si falta. */
  progreso?: number;
  /** Anillo en ámbar: está por empezar otra hora de cobro. */
  alerta?: boolean;
  /** Ya salió: el avatar se apaga. */
  apagado?: boolean;
  chico?: boolean;
  titulo?: string;
}

const RADIO = 17;
const VUELTA = 2 * Math.PI * RADIO;

export function Avatar({ nombre, tono, progreso, alerta, apagado, chico, titulo }: Props) {
  const clases = ["avatar", chico && "chico", apagado && "apagado", alerta && "alerta"]
    .filter(Boolean)
    .join(" ");
  const avance = Math.min(1, Math.max(0, progreso ?? 0));

  return (
    <span
      className={clases}
      style={{ "--tono": tono } as CSSProperties}
      title={titulo}
      aria-hidden="true"
    >
      {progreso !== undefined && (
        <svg className="avatar-anillo" viewBox="0 0 38 38">
          <circle className="pista" cx="19" cy="19" r={RADIO} />
          <circle
            className="avance"
            cx="19"
            cy="19"
            r={RADIO}
            strokeDasharray={VUELTA}
            strokeDashoffset={VUELTA * (1 - avance)}
          />
        </svg>
      )}
      <span className="avatar-letras">{iniciales(nombre)}</span>
    </span>
  );
}

/** "Ana" -> "A", "Ana Sofía" -> "AS". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primera = Array.from(partes[0])[0];
  const ultima = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] : "";
  return (primera + ultima).toUpperCase();
}
