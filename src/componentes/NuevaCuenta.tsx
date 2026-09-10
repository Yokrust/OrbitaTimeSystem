import { useState, type CSSProperties } from "react";
import type { Ajustes, Modalidad, Paquete } from "../tipos";
import { formatoDinero, NOMBRE_MODALIDAD_CORTO, preciosDe } from "../lib/cobro";

const MODALIDADES: Modalidad[] = ["tiempo", "dia", "all_access"];

interface Props {
  paquetes: Paquete[];
  ajustes: Ajustes;
  ahora: number;
  onAbrir: (paqueteId: string, personas: string[], modalidad: Modalidad) => void;
}

export function NuevaCuenta({ paquetes, ajustes, ahora, onAbrir }: Props) {
  const [personas, setPersonas] = useState("");
  const [paqueteId, setPaqueteId] = useState(paquetes[0]?.id ?? "");
  const [modalidad, setModalidad] = useState<Modalidad>("tiempo");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const lista = personas
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (lista.length === 0) return;
    onAbrir(paqueteId || paquetes[0].id, lista, modalidad);
    setPersonas("");
  }

  return (
    <section className="nueva-cuenta">
      <form onSubmit={enviar}>
        <div>
          <label className="etiqueta" htmlFor="nc-personas">
            Quién entra — separa los nombres con comas
          </label>
          <input
            id="nc-personas"
            className="campo"
            placeholder="Ana, Luis, Sofi"
            value={personas}
            onChange={(e) => setPersonas(e.target.value)}
            autoFocus
          />
        </div>

        <button className="btn primario" type="submit" disabled={!personas.trim()}>
          Abrir cuenta
        </button>
      </form>

      <div className="fila-elecciones">
        <div style={{ flex: 1 }}>
          <label className="etiqueta">Paquete</label>
          <div className="paquetes-elegir">
            {paquetes.map((p) => {
              const precios = preciosDe(p, ajustes, ahora);
              const activo = p.id === paqueteId;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="paquete-op"
                  style={{ "--tono": p.color } as CSSProperties}
                  aria-pressed={activo}
                  onClick={() => setPaqueteId(p.id)}
                >
                  <b>{p.nombre}</b>
                  <small>
                    <span className={modalidad === "tiempo" ? "resaltado" : ""}>
                      ${precios.tiempo}/h
                    </span>
                    {" · "}
                    <span className={modalidad === "dia" ? "resaltado" : ""}>
                      día ${precios.dia}
                    </span>
                    {" · "}
                    <span className={modalidad === "all_access" ? "resaltado" : ""}>
                      AA ${precios.all_access}
                      {precios.hayHappyHour ? " ⚡" : ""}
                    </span>
                  </small>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="etiqueta">Cómo paga</label>
          <div className="modalidades-elegir">
            {MODALIDADES.map((m) => (
              <button
                key={m}
                type="button"
                className="mini"
                aria-pressed={m === modalidad}
                onClick={() => setModalidad(m)}
              >
                {NOMBRE_MODALIDAD_CORTO[m]}
              </button>
            ))}
          </div>
          <div className="pista">
            {precioElegido(paquetes, paqueteId, ajustes, ahora, modalidad)}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Lo que va a pagar cada persona con lo que hay seleccionado ahora mismo. */
function precioElegido(
  paquetes: Paquete[],
  paqueteId: string,
  ajustes: Ajustes,
  ahora: number,
  modalidad: Modalidad,
): string {
  const paquete = paquetes.find((p) => p.id === paqueteId) ?? paquetes[0];
  if (!paquete) return "";
  const precios = preciosDe(paquete, ajustes, ahora);
  const moneda = ajustes.moneda;
  if (modalidad === "tiempo") return `${formatoDinero(precios.tiempo, moneda)} por hora empezada`;
  if (modalidad === "dia") return `${formatoDinero(precios.dia, moneda)} por persona`;
  return precios.hayHappyHour
    ? `${formatoDinero(precios.all_access, moneda)} — happy hour`
    : `${formatoDinero(precios.all_access, moneda)} por persona`;
}
