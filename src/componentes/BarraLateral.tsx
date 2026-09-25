import type { CSSProperties, ReactNode } from "react";
import { CalendarCheck, CircleCheck, Settings, Timer, Zap } from "lucide-react";
import logoBlanco from "../../Logo/OrbitaWhite.svg";
import type { EstadoDia } from "../tipos";
import { formatoPrecio } from "../lib/cobro";
import { aMinutos, aTextoHora, enHappyHour, happyHourDeHoy } from "../lib/horario";
import { SelectorTema } from "./SelectorTema";

export type Vista = "curso" | "cobradas";

interface Props {
  estado: EstadoDia;
  ahora: number;
  vista: Vista;
  onVista: (vista: Vista) => void;
  onAjustes: () => void;
  onCerrarDia: () => void;
}

export function BarraLateral({ estado, ahora, vista, onVista, onAjustes, onCerrarDia }: Props) {
  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn).length;
  const cobradas = estado.cuentas.length - abiertas;
  const finHappy = finDeHappyHour(estado, ahora);
  const moneda = estado.ajustes.moneda;

  return (
    <aside className="lateral">
      {/* Zona de los semáforos de macOS: también sirve para arrastrar la ventana. */}
      <div className="lateral-arrastre" data-tauri-drag-region />

      <div className="marca" data-tauri-drag-region>
        <span className="marca-logo" aria-hidden="true">
          <img src={logoBlanco} alt="" draggable={false} />
        </span>
        <span className="marca-nombre">ORBTIME</span>
      </div>

      <nav className="nav" aria-label="Secciones">
        <BotonNav
          activo={vista === "curso"}
          onClick={() => onVista("curso")}
          icono={<Timer size={18} />}
          texto="En curso"
          cuenta={abiertas}
        />
        <BotonNav
          activo={vista === "cobradas"}
          onClick={() => onVista("cobradas")}
          icono={<CircleCheck size={18} />}
          texto="Cobradas"
          cuenta={cobradas}
        />
      </nav>

      <section className="lateral-seccion" aria-labelledby="lateral-paquetes">
        <h2 id="lateral-paquetes" className="lateral-titulo">
          Paquetes
        </h2>
        <ul className="leyenda">
          {estado.paquetes.map((p) => (
            <li key={p.id} style={{ "--tono": p.color } as CSSProperties}>
              <span className="punto" aria-hidden="true" />
              <span className="leyenda-nombre">{p.nombre}</span>
              <span className="leyenda-precio">{formatoPrecio(p.precioHora, moneda)}/h</span>
            </li>
          ))}
        </ul>
        {finHappy && (
          <div className="happy-activa" role="status">
            <Zap size={16} aria-hidden="true" />
            <span>
              <b>Happy hour</b>
              <small>hasta {finHappy}</small>
            </span>
          </div>
        )}
      </section>

      <div className="lateral-pie">
        <button type="button" className="nav-item" onClick={onAjustes} title="Ajustes (⌘,)">
          <Settings size={18} aria-hidden="true" />
          <span className="nav-texto">Ajustes</span>
        </button>
        <button type="button" className="nav-item" onClick={onCerrarDia} title="Cerrar día">
          <CalendarCheck size={18} aria-hidden="true" />
          <span className="nav-texto">Cerrar día</span>
        </button>
        <SelectorTema />
      </div>
    </aside>
  );
}

function BotonNav(props: {
  activo: boolean;
  onClick: () => void;
  icono: ReactNode;
  texto: string;
  cuenta: number;
}) {
  return (
    <button
      type="button"
      className="nav-item"
      aria-current={props.activo ? "page" : undefined}
      onClick={props.onClick}
      title={props.texto}
    >
      <span aria-hidden="true">{props.icono}</span>
      <span className="nav-texto">{props.texto}</span>
      {props.cuenta > 0 && <span className="insignia">{props.cuenta}</span>}
    </button>
  );
}

/**
 * Hasta qué hora dura la happy hour que está corriendo ahora, o null si no hay.
 * Si dos ventanas se enciman (el viernes), cuenta la que termina más tarde.
 */
function finDeHappyHour(estado: EstadoDia, ahora: number): string | null {
  const ventanas = estado.ajustes.happyHour;
  if (!estado.paquetes.some((p) => p.precioHappyHour !== null)) return null;
  if (!enHappyHour(ventanas, ahora)) return null;

  const fecha = new Date(ahora);
  const minutos = fecha.getHours() * 60 + fecha.getMinutes() + fecha.getSeconds() / 60;
  const finales = happyHourDeHoy(ventanas, ahora)
    .map((v) => ({ desde: aMinutos(v.desde), hasta: aMinutos(v.hasta) }))
    .filter((v) => v.desde !== null && v.hasta !== null && minutos >= v.desde && minutos < v.hasta)
    .map((v) => v.hasta as number);
  return finales.length ? aTextoHora(Math.max(...finales)) : null;
}
