import type { EstadoDia } from "../tipos";
import { cobrarCuenta, formatoDinero, redondearPeso } from "../lib/cobro";
import { estadoNegocio, happyHourDeHoy } from "../lib/horario";
import { formatoDuracion } from "../lib/tiempo";

interface Props {
  estado: EstadoDia;
  ahora: number;
  onAjustes: () => void;
  onCerrarDia: () => void;
}

export function BarraSuperior({ estado, ahora, onAjustes, onCerrarDia }: Props) {
  const cobros = estado.cuentas.map((c) =>
    cobrarCuenta(c, estado.paquetes, estado.ajustes, ahora),
  );
  const total = redondearPeso(
    estado.cuentas.reduce((acc, c, i) => acc + (c.totalCobrado ?? cobros[i].total), 0),
  );
  const adentro = cobros.reduce((acc, c) => acc + c.personasActivas, 0);
  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn).length;
  const minutos = cobros.reduce((acc, c) => acc + c.minutosTotales, 0);

  const negocio = estadoNegocio(estado.ajustes.horarios, ahora);
  // Se avisa en rojo cuando queda menos de media hora y todavía hay gente.
  const porCerrar = negocio.paraCerrar !== null && negocio.paraCerrar <= 30 && adentro > 0;
  const hayHappyHour = happyHourDeHoy(estado.ajustes.happyHour, ahora).length > 0;

  const hora = new Date(ahora).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <header className="barra">
      <div className="marca">
        <strong>ORBTIME</strong>
        <span>{estado.fecha}</span>
      </div>

      <div className="reloj-barra">{hora}</div>

      <div
        className={`estado-negocio${negocio.abierto ? " abierto" : ""}${porCerrar ? " urgente" : ""}`}
        title={hayHappyHour ? "Hoy hay happy hour" : undefined}
      >
        <span className="punto" />
        {negocio.abierto ? "Abierto" : "Cerrado"}
        <span className="tenue-inline">
          {negocio.texto}
          {negocio.abierto && negocio.paraCerrar !== null && negocio.paraCerrar <= 60
            ? ` · faltan ${Math.round(negocio.paraCerrar)} min`
            : ""}
        </span>
      </div>

      <div className="metricas">
        <dl className="metrica">
          <dt>Adentro</dt>
          <dd className={adentro > 0 ? "verde" : ""}>{adentro}</dd>
        </dl>
        <dl className="metrica">
          <dt>Cuentas</dt>
          <dd>{abiertas}</dd>
        </dl>
        <dl className="metrica">
          <dt>Tiempo</dt>
          <dd>{formatoDuracion(minutos)}</dd>
        </dl>
        <dl className="metrica">
          <dt>Total del día</dt>
          <dd>{formatoDinero(total, estado.ajustes.moneda)}</dd>
        </dl>

        <button className="btn" onClick={onAjustes}>
          Ajustes
        </button>
        <button className="btn" onClick={onCerrarDia}>
          Cerrar día
        </button>
      </div>
    </header>
  );
}
