import type { EstadoDia } from "../tipos";
import { cobrarCuenta, formatoDinero, redondearPeso } from "../lib/cobro";
import { formatoDuracion } from "../lib/tiempo";

interface Props {
  estado: EstadoDia;
  ahora: number;
  trabajando: boolean;
  onCerrar: () => void;
  onExportar: (empezarDiaNuevo: boolean) => void;
}

export function ModalCierreDia({ estado, ahora, trabajando, onCerrar, onExportar }: Props) {
  const cobros = estado.cuentas.map((c) =>
    cobrarCuenta(c, estado.paquetes, estado.ajustes, ahora),
  );
  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn).length;
  const adentro = cobros.reduce((a, c) => a + c.personasActivas, 0);
  const total = redondearPeso(
    estado.cuentas.reduce((a, c, i) => a + (c.totalCobrado ?? cobros[i].total), 0),
  );
  const personas = estado.cuentas.reduce((a, c) => a + c.personas.length, 0);
  const ahorro = redondearPeso(cobros.reduce((a, c) => a + c.ahorro, 0));
  const minutos = cobros.reduce((a, c) => a + c.minutosTotales, 0);

  return (
    <div className="velo" onClick={trabajando ? undefined : onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-cabeza">
          <h2>Cerrar el día · {estado.fecha}</h2>
        </div>

        <div className="modal-cuerpo">
          {abiertas > 0 && (
            <div className="aviso-caja">
              Quedan {abiertas} cuenta{abiertas === 1 ? "" : "s"} sin cobrar
              {adentro > 0 && ` y ${adentro} persona${adentro === 1 ? "" : "s"} con el reloj corriendo`}.
              Se exportan tal cual, con el tiempo que llevan hasta ahorita.
            </div>
          )}

          <table className="ticket">
            <tbody>
              <tr>
                <td>Cuentas</td>
                <td>{estado.cuentas.length}</td>
              </tr>
              <tr>
                <td>Personas atendidas</td>
                <td>{personas}</td>
              </tr>
              <tr>
                <td>Tiempo vendido</td>
                <td>{formatoDuracion(minutos)}</td>
              </tr>
              {ahorro > 0 && (
                <tr>
                  <td>Descuentos aplicados</td>
                  <td>−{formatoDinero(ahorro, estado.ajustes.moneda)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total del día</td>
                <td>{formatoDinero(total, estado.ajustes.moneda)}</td>
              </tr>
            </tfoot>
          </table>

          <p style={{ fontSize: 12, color: "var(--texto-3)", marginBottom: 0 }}>
            Se guarda un CSV y un JSON en <b>Documentos / ORBTIME</b>.
          </p>
        </div>

        <div className="modal-pie">
          <button className="btn fantasma" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </button>
          <button className="btn" onClick={() => onExportar(false)} disabled={trabajando}>
            Solo exportar
          </button>
          <button
            className="btn primario"
            onClick={() => onExportar(true)}
            disabled={trabajando || abiertas > 0}
            title={
              abiertas > 0
                ? "Primero cobra o cierra las cuentas que siguen abiertas"
                : "Exporta y deja la caja vacía para mañana"
            }
          >
            {trabajando ? "Exportando…" : "Exportar y empezar día nuevo"}
          </button>
        </div>
      </div>
    </div>
  );
}
