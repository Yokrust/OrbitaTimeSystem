import { useState } from "react";
import { Banknote, CreditCard, GraduationCap, Info, Zap } from "lucide-react";
import type { CobroPersona, Cuenta, EstadoDia, MetodoPago } from "../tipos";
import type { Accion } from "../estado/acciones";
import { cobrarCuenta, formatoDinero, NOMBRE_MODALIDAD_CORTO } from "../lib/cobro";
import { formatoDuracion } from "../lib/tiempo";
import { Avatar } from "./Avatar";
import { Dinero } from "./Dinero";
import { Modal } from "./Modal";
import { Segmentado, type OpcionSegmento } from "./Segmentado";

interface Props {
  cuenta: Cuenta;
  estado: EstadoDia;
  ahora: number;
  despachar: (a: Accion) => void;
  onCerrar: () => void;
  onConfirmar: (metodo: MetodoPago, total: number) => void;
}

const METODOS: OpcionSegmento<MetodoPago>[] = [
  { valor: "efectivo", etiqueta: "Efectivo", icono: <Banknote size={17} aria-hidden="true" /> },
  { valor: "tarjeta", etiqueta: "Tarjeta", icono: <CreditCard size={17} aria-hidden="true" /> },
];

export function ModalCobro({ cuenta, estado, ahora, despachar, onCerrar, onConfirmar }: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const cobro = cobrarCuenta(cuenta, estado.paquetes, estado.ajustes, ahora);
  const moneda = estado.ajustes.moneda;
  const siguenAdentro = cobro.personasActivas;
  const pct = estado.ajustes.descuentoEstudiante;
  const todosEstudiantes =
    cuenta.personas.length > 0 && cuenta.personas.every((p) => p.estudiante);
  const cuantas = cobro.personas.length;

  return (
    <Modal
      titulo={`Cobrar ${cuenta.nombre}`}
      onCerrar={onCerrar}
      ancho
      pie={
        <>
          <button type="button" className="btn fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn primario grande"
            onClick={() => onConfirmar(metodo, cobro.total)}
          >
            Cobrar {formatoDinero(cobro.total, moneda)}
          </button>
        </>
      }
    >
      <div className="cifra-panel">
        <Dinero className="cifra-grande" valor={cobro.total} moneda={moneda} />
        <span className="cifra-detalle">
          {cuantas === 1 ? "1 persona" : `${cuantas} personas`} · {cobro.paquete.nombre}
          {cobro.ahorro > 0 && ` · ahorran ${formatoDinero(cobro.ahorro, moneda)}`}
        </span>
      </div>

      {siguenAdentro > 0 && (
        <p className="nota">
          <Info size={16} aria-hidden="true" />
          Al cobrar se detiene el reloj de{" "}
          {siguenAdentro === 1 ? "1 persona" : `${siguenAdentro} personas`}.
        </p>
      )}

      <div className="lista-cabeza">
        <span className="grupo-etiqueta">Personas</span>
        <button
          type="button"
          className="btn chico fantasma"
          aria-pressed={todosEstudiantes}
          onClick={() =>
            despachar({
              tipo: "marcarTodosEstudiantes",
              cuentaId: cuenta.id,
              valor: !todosEstudiantes,
            })
          }
        >
          <GraduationCap size={16} aria-hidden="true" />
          {todosEstudiantes ? "Quitar estudiante a todos" : "Todos son estudiantes"}
        </button>
      </div>

      <ul className="cobro-personas">
        {cobro.personas.map((p) => {
          const persona = cuenta.personas.find((x) => x.id === p.personaId)!;
          return (
            <li key={p.personaId} className="cobro-persona">
              <Avatar nombre={p.nombre} tono={cobro.paquete.color} chico />
              <div className="cobro-persona-info">
                <b>{p.nombre}</b>
                <small>{concepto(p)}</small>
              </div>
              {p.descuento === "happy_hour" ? (
                <span className="etiqueta happy" title="La happy hour no se suma a otros descuentos">
                  <Zap size={11} aria-hidden="true" /> Happy hour
                </span>
              ) : (
                <button
                  type="button"
                  className="toggle-estudiante"
                  aria-pressed={persona.estudiante}
                  title={`Descuento de estudiante: ${pct}%`}
                  onClick={() =>
                    despachar({
                      tipo: "marcarEstudiante",
                      cuentaId: cuenta.id,
                      personaId: p.personaId,
                      valor: !persona.estudiante,
                    })
                  }
                >
                  <GraduationCap size={15} aria-hidden="true" /> Estudiante
                </button>
              )}
              <span className="cobro-importe">
                {p.ahorro > 0 && <s>{formatoDinero(p.importeBase, moneda)}</s>}
                {formatoDinero(p.importe, moneda)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="grupo">
        <span className="grupo-etiqueta">Método de pago</span>
        <Segmentado
          etiqueta="Método de pago"
          opciones={METODOS}
          valor={metodo}
          onCambio={setMetodo}
          grande
        />
      </div>
    </Modal>
  );
}

function concepto(p: CobroPersona): string {
  if (p.modalidad !== "tiempo") return NOMBRE_MODALIDAD_CORTO[p.modalidad];
  const horas = p.horasFacturadas === 1 ? "1 hora" : `${p.horasFacturadas} horas`;
  return `${horas} · estuvo ${formatoDuracion(p.minutosBrutos)}`;
}
