import type { CSSProperties } from "react";
import { ArrowLeftRight, Banknote, CreditCard, Receipt, RotateCcw, Trash2 } from "lucide-react";
import type { EstadoDia, MetodoGuardado } from "../tipos";
import type { Accion } from "../estado/acciones";
import { buscarPaquete, redondearPeso } from "../lib/cobro";
import { formatoHora } from "../lib/tiempo";
import { Dinero } from "./Dinero";
import { Menu } from "./Menu";

const ICONO_METODO: Record<MetodoGuardado, typeof Banknote> = {
  efectivo: Banknote,
  tarjeta: CreditCard,
  transferencia: ArrowLeftRight,
};

interface Props {
  estado: EstadoDia;
  despachar: (a: Accion) => void;
  onReabrir: (cuentaId: string) => void;
}

/** Lo que ya se cobró hoy, de la más reciente a la más vieja. */
export function ListaCobradas({ estado, despachar, onReabrir }: Props) {
  const cerradas = estado.cuentas.filter((c) => c.cerradaEn);
  const moneda = estado.ajustes.moneda;
  const total = redondearPeso(cerradas.reduce((a, c) => a + (c.totalCobrado ?? 0), 0));

  return (
    <section className="tablero" aria-labelledby="titulo-cobradas">
      <div className="tablero-cabeza">
        <h2 id="titulo-cobradas" className="tablero-titulo">
          Cobradas hoy
          {cerradas.length > 0 && <span className="insignia">{cerradas.length}</span>}
        </h2>
        {cerradas.length > 0 && <Dinero className="tablero-total" valor={total} moneda={moneda} />}
      </div>

      {cerradas.length === 0 ? (
        <div className="vacio">
          <span className="vacio-icono" aria-hidden="true">
            <Receipt size={26} />
          </span>
          <h3>Todavía no se cobra nada</h3>
          <p>Aquí aparece cada cuenta cobrada, con su total y cómo se pagó.</p>
        </div>
      ) : (
        <ul className="lista-cobradas">
          {cerradas.map((c) => {
            const paquete = buscarPaquete(estado.paquetes, c.paqueteId);
            const Icono = c.metodoPago ? ICONO_METODO[c.metodoPago] : null;
            return (
              <li key={c.id} className="cobrada" style={{ "--tono": paquete.color } as CSSProperties}>
                <span className="punto" aria-hidden="true" />
                <div className="cobrada-info">
                  <b>{c.nombre}</b>
                  <small>
                    {nombres(c.personas.map((p) => p.nombre))} · {paquete.nombre}
                  </small>
                </div>
                {Icono && (
                  <span className="cobrada-metodo">
                    <Icono size={16} aria-hidden="true" />
                    {c.metodoPago}
                  </span>
                )}
                <span className="cobrada-hora">{formatoHora(c.cerradaEn!)}</span>
                <Dinero className="cobrada-total" valor={c.totalCobrado ?? 0} moneda={moneda} />
                <Menu etiqueta={`Opciones de ${c.nombre}`}>
                  {(cerrar) => (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => {
                          cerrar();
                          onReabrir(c.id);
                        }}
                      >
                        <RotateCcw size={16} aria-hidden="true" /> Reabrir cuenta
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item peligro"
                        onClick={() => {
                          cerrar();
                          if (confirm(`¿Borrar la ${c.nombre} del reporte?`)) {
                            despachar({ tipo: "eliminarCuenta", cuentaId: c.id });
                          }
                        }}
                      >
                        <Trash2 size={16} aria-hidden="true" /> Borrar del reporte
                      </button>
                    </>
                  )}
                </Menu>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "Ana y Luis", o "Ana, Luis y 3 más". */
function nombres(lista: string[]): string {
  if (lista.length === 0) return "Sin personas";
  if (lista.length <= 2) return lista.join(" y ");
  return `${lista.slice(0, 2).join(", ")} y ${lista.length - 2} más`;
}
