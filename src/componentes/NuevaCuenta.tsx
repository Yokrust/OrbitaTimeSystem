import { useState, type CSSProperties } from "react";
import { CircleCheck, Zap } from "lucide-react";
import type { Ajustes, Modalidad, Paquete } from "../tipos";
import { buscarPaquete, formatoPrecio, NOMBRE_MODALIDAD_CORTO, preciosDe } from "../lib/cobro";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { moverConFlechas, Segmentado } from "./Segmentado";

const MODALIDADES: Modalidad[] = ["tiempo", "dia", "all_access"];

export interface Eleccion {
  paqueteId: string;
  modalidad: Modalidad;
}

interface Props {
  paquetes: Paquete[];
  ajustes: Ajustes;
  ahora: number;
  /** Lo que se eligió la última vez: casi siempre se repite. */
  inicial: Eleccion | null;
  onAbrir: (paqueteId: string, personas: string[], modalidad: Modalidad) => void;
  onCerrar: () => void;
}

export function NuevaCuenta({ paquetes, ajustes, ahora, inicial, onAbrir, onCerrar }: Props) {
  const [texto, setTexto] = useState("");
  const [paqueteId, setPaqueteId] = useState(inicial?.paqueteId ?? paquetes[0]?.id ?? "");
  const [modalidad, setModalidad] = useState<Modalidad>(inicial?.modalidad ?? "tiempo");

  const nombres = texto
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const elegido = buscarPaquete(paquetes, paqueteId);

  function enviar() {
    if (nombres.length === 0) return;
    onAbrir(elegido.id, nombres, modalidad);
  }

  return (
    <Modal
      titulo="Nueva cuenta"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="btn fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-nueva-cuenta"
            className="btn primario"
            disabled={nombres.length === 0}
          >
            Abrir cuenta
          </button>
        </>
      }
    >
      <form
        id="form-nueva-cuenta"
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <div className="grupo">
          <label className="grupo-etiqueta" htmlFor="nc-personas">
            ¿Quién entra?
          </label>
          <input
            id="nc-personas"
            className="campo grande"
            placeholder="Ana, Luis, Sofi"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            // El botón de abrir vive en el pie del modal, fuera del <form>: el
            // Enter se atiende aquí para no depender del envío implícito.
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                enviar();
              }
            }}
            autoComplete="off"
            data-autofocus
          />
          <div className="chips-nombres" aria-live="polite">
            {nombres.length === 0 ? (
              <span className="pista">Si son varios, sepáralos con comas.</span>
            ) : (
              nombres.map((nombre, i) => (
                <span key={`${i}-${nombre}`} className="chip-nombre">
                  <Avatar nombre={nombre} tono={elegido.color} chico />
                  {nombre}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="grupo">
          <span className="grupo-etiqueta" id="nc-paquete">
            Paquete
          </span>
          <div
            className="opciones-paquete"
            role="radiogroup"
            aria-labelledby="nc-paquete"
            onKeyDown={moverConFlechas}
          >
            {paquetes.map((p) => {
              const precios = preciosDe(p, ajustes, ahora);
              const activo = p.id === elegido.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  tabIndex={activo ? 0 : -1}
                  className="opcion-paquete"
                  style={{ "--tono": p.color } as CSSProperties}
                  onClick={() => setPaqueteId(p.id)}
                >
                  <span className="opcion-paquete-nombre">
                    <span className="punto" aria-hidden="true" />
                    {p.nombre}
                  </span>
                  <span className="opcion-paquete-precio">
                    {formatoPrecio(precios[modalidad], ajustes.moneda)}
                    {modalidad === "tiempo" && <small>/h</small>}
                  </span>
                  {modalidad === "all_access" && precios.hayHappyHour && (
                    <span className="etiqueta happy">
                      <Zap size={11} aria-hidden="true" /> Happy hour
                    </span>
                  )}
                  {activo && <CircleCheck className="opcion-check" size={18} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grupo">
          <span className="grupo-etiqueta">Cómo paga</span>
          <Segmentado
            etiqueta="Cómo paga"
            opciones={MODALIDADES.map((m) => ({ valor: m, etiqueta: NOMBRE_MODALIDAD_CORTO[m] }))}
            valor={modalidad}
            onCambio={setModalidad}
          />
        </div>
      </form>
    </Modal>
  );
}
