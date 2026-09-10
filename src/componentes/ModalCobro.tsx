import { useState } from "react";
import type { Cuenta, EstadoDia, MetodoPago } from "../tipos";
import type { Accion } from "../estado/acciones";
import {
  cobrarCuenta,
  formatoDinero,
  NOMBRE_DESCUENTO,
  NOMBRE_MODALIDAD_CORTO,
} from "../lib/cobro";
import { formatoDuracion, formatoHora } from "../lib/tiempo";

interface Props {
  cuenta: Cuenta;
  estado: EstadoDia;
  ahora: number;
  despachar: (a: Accion) => void;
  onCerrar: () => void;
  onConfirmar: (metodo: MetodoPago, total: number) => void;
}

const METODOS: MetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

export function ModalCobro({
  cuenta,
  estado,
  ahora,
  despachar,
  onCerrar,
  onConfirmar,
}: Props) {
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const cobro = cobrarCuenta(cuenta, estado.paquetes, estado.ajustes, ahora);
  const moneda = estado.ajustes.moneda;
  const siguenAdentro = cobro.personasActivas;
  const pct = estado.ajustes.descuentoEstudiante;
  const todosEstudiantes =
    cuenta.personas.length > 0 && cuenta.personas.every((p) => p.estudiante);

  return (
    <div className="velo" onClick={onCerrar}>
      <div
        className="modal ancho"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-cabeza">
          <h2>
            Cobrar · {cuenta.nombre} <span className="tenue-inline">{cobro.paquete.nombre}</span>
          </h2>
          <button className="btn fantasma chico" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="modal-cuerpo">
          {siguenAdentro > 0 && (
            <div className="aviso-caja">
              {siguenAdentro === 1
                ? "Hay 1 persona con el reloj corriendo."
                : `Hay ${siguenAdentro} personas con el reloj corriendo.`}{" "}
              Al cobrar se les marca la salida en este momento.
            </div>
          )}

          <div className="barra-descuento">
            <span>Descuento de estudiante ({pct}%)</span>
            <button
              className="btn chico"
              onClick={() =>
                despachar({
                  tipo: "marcarTodosEstudiantes",
                  cuentaId: cuenta.id,
                  valor: !todosEstudiantes,
                })
              }
            >
              {todosEstudiantes ? "Quitar a todos" : "Marcar a todos"}
            </button>
          </div>

          <table className="ticket">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Estudiante</th>
                <th>Concepto</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {cobro.personas.map((p) => {
                const persona = cuenta.personas.find((x) => x.id === p.personaId)!;
                const concepto =
                  p.modalidad === "tiempo"
                    ? `${p.horasFacturadas} h · ${formatoDuracion(p.minutosBrutos)}`
                    : NOMBRE_MODALIDAD_CORTO[p.modalidad];
                return (
                  <tr key={p.personaId}>
                    <td>
                      {p.nombre}
                      <div className="tenue">
                        {formatoHora(persona.entrada)} →{" "}
                        {persona.salida ? formatoHora(persona.salida) : "ahora"}
                      </div>
                    </td>
                    <td className="col-estudiante">
                      <input
                        type="checkbox"
                        checked={persona.estudiante}
                        onChange={(e) =>
                          despachar({
                            tipo: "marcarEstudiante",
                            cuentaId: cuenta.id,
                            personaId: p.personaId,
                            valor: e.target.checked,
                          })
                        }
                        aria-label={`Estudiante: ${p.nombre}`}
                      />
                    </td>
                    <td>
                      {concepto}
                      {p.descuento !== "ninguno" && (
                        <div className={`tenue etiqueta-${p.descuento}`}>
                          {NOMBRE_DESCUENTO[p.descuento]}
                          {p.descuento === "happy_hour" && persona.estudiante
                            ? " (no se acumula)"
                            : ""}
                        </div>
                      )}
                    </td>
                    <td>
                      {p.ahorro > 0 && (
                        <div className="tenue">
                          <s>{formatoDinero(p.importeBase, moneda)}</s>
                        </div>
                      )}
                      {formatoDinero(p.importe, moneda)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {cobro.ahorro > 0 && (
                <tr className="sin-borde">
                  <td colSpan={3} className="tenue">
                    Subtotal
                  </td>
                  <td className="tenue">{formatoDinero(cobro.subtotal, moneda)}</td>
                </tr>
              )}
              {cobro.ahorro > 0 && (
                <tr className="sin-borde">
                  <td colSpan={3} className="tenue">
                    Descuentos
                  </td>
                  <td className="tenue">−{formatoDinero(cobro.ahorro, moneda)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3}>Total</td>
                <td>{formatoDinero(cobro.total, moneda)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop: 18 }}>
            <label className="etiqueta">Método de pago</label>
            <div className="metodos" style={{ marginTop: 0 }}>
              {METODOS.map((m) => (
                <button
                  key={m}
                  className="metodo"
                  aria-pressed={m === metodo}
                  onClick={() => setMetodo(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-pie">
          <button className="btn fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn verde" onClick={() => onConfirmar(metodo, cobro.total)}>
            Cobrar {formatoDinero(cobro.total, moneda)}
          </button>
        </div>
      </div>
    </div>
  );
}
