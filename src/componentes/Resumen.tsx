import { TriangleAlert, Users, Wallet } from "lucide-react";
import type { EstadoDia } from "../tipos";
import { buscarPaquete, cobrarCuenta, formatoDinero, redondearPeso } from "../lib/cobro";
import { estadoNegocio } from "../lib/horario";
import { fechaLarga, fechaOperativa } from "../lib/tiempo";
import { mayuscula, minuscula } from "../lib/texto";
import { Avatar } from "./Avatar";
import { Dinero } from "./Dinero";
import { Ilustracion } from "./Ilustracion";

interface Props {
  estado: EstadoDia;
  ahora: number;
  onIrACuenta: (cuentaId: string) => void;
  onCerrarDia: () => void;
}

/** Cuántos avatares caben en la tarjeta de "Adentro" antes del "+N". */
const MAX_AVATARES = 5;

/** La franja de arriba: la hora, si está abierto, quién está adentro y cuánto va. */
export function Resumen({ estado, ahora, onIrACuenta, onCerrarDia }: Props) {
  const moneda = estado.ajustes.moneda;
  const cobros = estado.cuentas.map((c) =>
    cobrarCuenta(c, estado.paquetes, estado.ajustes, ahora),
  );
  const total = redondearPeso(
    estado.cuentas.reduce((acc, c, i) => acc + (c.totalCobrado ?? cobros[i].total), 0),
  );
  const cobrado = redondearPeso(estado.cuentas.reduce((acc, c) => acc + (c.totalCobrado ?? 0), 0));

  const adentro = estado.cuentas
    .filter((c) => !c.cerradaEn)
    .flatMap((cuenta) => {
      const paquete = buscarPaquete(estado.paquetes, cuenta.paqueteId);
      return cuenta.personas
        .filter((p) => p.salida === null)
        .map((persona) => ({ persona, cuenta, paquete }));
    });

  const fecha = new Date(ahora);
  const reloj = partesHora(fecha);
  const negocio = estadoNegocio(estado.ajustes.horarios, ahora);
  const faltan = negocio.paraCerrar;
  const cierraPronto = negocio.abierto && faltan !== null && faltan <= 60;
  // Rojo solo cuando falta poco y todavía hay a quién avisarle.
  const urgente = cierraPronto && faltan! <= 30 && adentro.length > 0;
  const claseEstado = !negocio.abierto ? "cerrado" : urgente ? "urgente" : cierraPronto ? "pronto" : "abierto";
  const textoEstado = !negocio.abierto
    ? `Cerrado · ${minuscula(negocio.texto)}`
    : cierraPronto
      ? `Cierra en ${Math.max(1, Math.round(faltan!))} min`
      : `Abierto · ${minuscula(negocio.texto)}`;
  const diaPendiente = estado.fecha !== fechaOperativa(fecha);

  return (
    <section className="resumen" aria-label="Resumen de hoy">
      <div className="tarjeta hero">
        <div className="hero-texto">
          <h1 className="hero-saludo">{saludo(fecha.getHours())}</h1>
          <p className="hero-fecha">
            {mayuscula(fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }))}
          </p>
          <p className="hero-reloj">
            {reloj.hora}
            <span className="hero-periodo">{reloj.periodo}</span>
          </p>
          <div className="hero-estados">
            <span className={`estado ${claseEstado}`}>
              <span className="estado-punto" aria-hidden="true" />
              {textoEstado}
            </span>
            {diaPendiente && (
              <button type="button" className="estado aviso" onClick={onCerrarDia}>
                <TriangleAlert size={14} aria-hidden="true" />
                Día del {fechaLarga(estado.fecha)} sin cerrar
              </button>
            )}
          </div>
        </div>
        <Ilustracion
          className="hero-ilustracion"
          ahora={ahora}
          colores={estado.paquetes.map((p) => p.color)}
        />
      </div>

      <div className="tarjeta dato">
        <div className="dato-cabeza">
          <span className="dato-icono" aria-hidden="true">
            <Users size={16} />
          </span>
          <span className="dato-etiqueta">Adentro</span>
        </div>
        <p className="dato-valor">{adentro.length}</p>
        {adentro.length > 0 ? (
          <div className="pila-avatares">
            {adentro.slice(0, MAX_AVATARES).map(({ persona, cuenta, paquete }) => (
              <button
                key={persona.id}
                type="button"
                className="pila-avatar"
                onClick={() => onIrACuenta(cuenta.id)}
                aria-label={`Ir a ${cuenta.nombre}, donde está ${persona.nombre}`}
                title={`${persona.nombre} · ${cuenta.nombre}`}
              >
                <Avatar nombre={persona.nombre} tono={paquete.color} chico />
              </button>
            ))}
            {adentro.length > MAX_AVATARES && (
              <span className="pila-mas">+{adentro.length - MAX_AVATARES}</span>
            )}
          </div>
        ) : (
          <p className="dato-sub">Nadie por ahora</p>
        )}
      </div>

      <div className="tarjeta dato">
        <div className="dato-cabeza">
          <span className="dato-icono" aria-hidden="true">
            <Wallet size={16} />
          </span>
          <span className="dato-etiqueta">Total del día</span>
        </div>
        <p className="dato-valor">
          <Dinero valor={total} moneda={moneda} />
        </p>
        <p className="dato-sub">
          {total > 0 ? `${formatoDinero(cobrado, moneda)} ya cobrado` : "Sin movimientos todavía"}
        </p>
      </div>
    </section>
  );
}

function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "11:28" y "a.m." por separado, para pintar el periodo más chico. */
function partesHora(fecha: Date): { hora: string; periodo: string } {
  const partes = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(fecha);
  const periodo = partes.find((p) => p.type === "dayPeriod")?.value ?? "";
  const hora = partes
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  return { hora, periodo };
}
