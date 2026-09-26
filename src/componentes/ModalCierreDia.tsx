import { FolderOpen, TriangleAlert } from "lucide-react";
import type { EstadoDia } from "../tipos";
import { cobrarCuenta, formatoDinero, redondearPeso } from "../lib/cobro";
import { fechaLarga, formatoDuracion } from "../lib/tiempo";
import { Dinero } from "./Dinero";
import { Modal } from "./Modal";

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
  const moneda = estado.ajustes.moneda;
  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn).length;
  const adentro = cobros.reduce((a, c) => a + c.personasActivas, 0);
  const total = redondearPeso(
    estado.cuentas.reduce((a, c, i) => a + (c.totalCobrado ?? cobros[i].total), 0),
  );
  const personas = estado.cuentas.reduce((a, c) => a + c.personas.length, 0);
  const ahorro = redondearPeso(cobros.reduce((a, c) => a + c.ahorro, 0));
  const minutos = cobros.reduce((a, c) => a + c.minutosTotales, 0);

  return (
    <Modal
      titulo={`Cerrar el día · ${fechaLarga(estado.fecha)}`}
      onCerrar={onCerrar}
      ocupado={trabajando}
      pie={
        <>
          <button type="button" className="btn fantasma" onClick={onCerrar} disabled={trabajando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onExportar(false)}
            disabled={trabajando}
          >
            Solo exportar
          </button>
          <button
            type="button"
            className="btn primario"
            onClick={() => onExportar(true)}
            disabled={trabajando || abiertas > 0}
          >
            {trabajando ? "Exportando…" : "Exportar y cerrar el día"}
          </button>
        </>
      }
    >
      <div className="cifra-panel">
        <span className="grupo-etiqueta">Total del día</span>
        <Dinero className="cifra-grande" valor={total} moneda={moneda} />
        {ahorro > 0 && (
          <span className="cifra-detalle">Con {formatoDinero(ahorro, moneda)} de descuentos</span>
        )}
      </div>

      <div className="cierre-datos">
        <div className="cierre-dato">
          <b>{estado.cuentas.length}</b>
          <span>{estado.cuentas.length === 1 ? "cuenta" : "cuentas"}</span>
        </div>
        <div className="cierre-dato">
          <b>{personas}</b>
          <span>{personas === 1 ? "persona" : "personas"}</span>
        </div>
        <div className="cierre-dato">
          <b>{formatoDuracion(minutos)}</b>
          <span>de tiempo</span>
        </div>
      </div>

      {abiertas > 0 && (
        <p className="nota ambar">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>
            {abiertas === 1 ? "Queda 1 cuenta sin cobrar" : `Quedan ${abiertas} cuentas sin cobrar`}
            {adentro > 0 && ` con ${adentro === 1 ? "1 reloj" : `${adentro} relojes`} corriendo`}.
            Cóbralas para cerrar el día; si solo exportas, salen con el tiempo que llevan.
          </span>
        </p>
      )}

      <p className="nota-archivo">
        <FolderOpen size={16} aria-hidden="true" />
        El reporte se guarda en Documentos › ORBTIME
      </p>
    </Modal>
  );
}
