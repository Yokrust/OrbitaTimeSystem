import { useId } from "react";

interface Props {
  ahora: number;
  /** Colores de los paquetes: son los satélites de la órbita. */
  colores: string[];
  className?: string;
}

// Todo se dibuja sobre un lienzo de 240 × 160 con el planeta al centro.
const CX = 130;
const CY = 80;
/** Inclinación de las órbitas, en grados. */
const GIRO = -12;

const SATELITES = [
  { grados: 205, radio: 5 },
  { grados: 332, radio: 6.5 },
  { grados: 118, radio: 8 },
  { grados: 22, radio: 4.5 },
  { grados: 262, radio: 4.5 },
];

const BRILLOS = [
  { x: 26, y: 34, r: 5 },
  { x: 214, y: 20, r: 6.5 },
  { x: 38, y: 130, r: 4 },
  { x: 224, y: 126, r: 4.5 },
];

/**
 * Un planeta con su anillo, que además es un reloj: las manecillas marcan la
 * hora real. Los satélites llevan los colores de los paquetes.
 */
export function Ilustracion({ ahora, colores, className }: Props) {
  const id = useId();
  const fecha = new Date(ahora);
  const anguloHora = ((fecha.getHours() % 12) + fecha.getMinutes() / 60) * 30;
  const anguloMinuto = fecha.getMinutes() * 6;

  return (
    <svg className={className} viewBox="0 0 240 160" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-planeta`} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <stop offset="0" stopColor="var(--ilus-1)" />
          <stop offset="1" stopColor="var(--ilus-2)" />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor="var(--ilus-1)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--ilus-1)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r="64" fill={`url(#${id}-halo)`} />

      <ellipse
        cx={CX}
        cy={CY}
        rx="104"
        ry="52"
        transform={`rotate(${GIRO} ${CX} ${CY})`}
        fill="none"
        stroke="var(--ilus-orbita)"
        strokeWidth="1.6"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />

      {/* La mitad de atrás del anillo pasa por detrás del planeta. */}
      <path d={arco(64, 19, 180, 360)} className="ilus-anillo" />
      <circle cx={CX} cy={CY} r="32" fill={`url(#${id}-planeta)`} />
      <ellipse
        cx={CX - 11}
        cy={CY - 14}
        rx="10"
        ry="5.5"
        transform={`rotate(-35 ${CX - 11} ${CY - 14})`}
        fill="#fff"
        opacity="0.3"
      />
      <path d={arco(64, 19, 0, 180)} className="ilus-anillo" />

      <g transform={`translate(${CX} ${CY})`} stroke="#fff" strokeLinecap="round">
        <line y2="-12" strokeWidth="3.2" transform={`rotate(${anguloHora})`} />
        <line y2="-19" strokeWidth="2.2" transform={`rotate(${anguloMinuto})`} />
        <circle r="2.8" fill="#fff" stroke="none" />
      </g>

      {colores.slice(0, SATELITES.length).map((color, i) => {
        const [x, y] = punto(104, 52, SATELITES[i].grados);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={SATELITES[i].radio}
            fill={color}
            stroke="var(--tarjeta)"
            strokeWidth="2.5"
          />
        );
      })}

      {BRILLOS.map((b, i) => (
        <path key={i} d={destello(b.x, b.y, b.r)} fill="var(--ilus-brillo)" />
      ))}
    </svg>
  );
}

/** Punto de una elipse inclinada, con el ángulo en grados. */
function punto(rx: number, ry: number, grados: number): [number, number] {
  const t = (grados * Math.PI) / 180;
  const g = (GIRO * Math.PI) / 180;
  const x = rx * Math.cos(t);
  const y = ry * Math.sin(t);
  return [CX + x * Math.cos(g) - y * Math.sin(g), CY + x * Math.sin(g) + y * Math.cos(g)];
}

/** Media elipse inclinada, de un ángulo a otro. */
function arco(rx: number, ry: number, desde: number, hasta: number): string {
  const [x1, y1] = punto(rx, ry, desde);
  const [x2, y2] = punto(rx, ry, hasta);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx} ${ry} ${GIRO} 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/** Estrellita de cuatro puntas. */
function destello(x: number, y: number, r: number): string {
  const c = r * 0.28;
  return (
    `M ${x} ${y - r} Q ${x + c} ${y - c} ${x + r} ${y} Q ${x + c} ${y + c} ${x} ${y + r} ` +
    `Q ${x - c} ${y + c} ${x - r} ${y} Q ${x - c} ${y - c} ${x} ${y - r} Z`
  );
}
