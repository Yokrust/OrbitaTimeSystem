import { useRef, useState, type CSSProperties } from "react";
import {
  Check,
  ChevronDown,
  GraduationCap,
  PencilLine,
  StickyNote,
  UserPlus,
  Zap,
} from "lucide-react";
import type { Cuenta, EstadoDia } from "../tipos";
import type { Accion } from "../estado/acciones";
import { cobrarCuenta, formatoPrecio, NOMBRE_MODALIDAD_CORTO } from "../lib/cobro";
import { formatoHora } from "../lib/tiempo";
import { Dinero } from "./Dinero";
import { FilaPersona } from "./FilaPersona";
import { Menu } from "./Menu";

interface Props {
  cuenta: Cuenta;
  estado: EstadoDia;
  ahora: number;
  /** Se ilumina un momento cuando se llega a ella desde otro lado. */
  destacada: boolean;
  despachar: (a: Accion) => void;
  onCobrar: () => void;
}

export function TarjetaCuenta({ cuenta, estado, ahora, destacada, despachar, onCobrar }: Props) {
  const [agregando, setAgregando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoNotas, setEditandoNotas] = useState(false);
  const campoNombre = useRef<HTMLInputElement>(null);

  const cobro = cobrarCuenta(cuenta, estado.paquetes, estado.ajustes, ahora);
  const moneda = estado.ajustes.moneda;
  // Si todos pagan igual o tienen el mismo descuento, se dice una vez en la
  // cabecera y no en cada fila.
  const modalidades = new Set(cuenta.personas.map((p) => p.modalidad));
  const modalidadComun = modalidades.size === 1 ? cuenta.personas[0].modalidad : null;
  const descuentos = new Set(cobro.personas.map((p) => p.descuento));
  const descuentoComun =
    descuentos.size === 1 && cobro.personas[0].descuento !== "ninguno"
      ? cobro.personas[0].descuento
      : null;

  function agregarPersona(e: React.FormEvent) {
    e.preventDefault();
    // Se pueden meter varias de un jalón: "Ana, Luis, Sofi"
    for (const parte of nuevoNombre.split(",")) {
      const nombre = parte.trim();
      if (nombre) despachar({ tipo: "agregarPersona", cuentaId: cuenta.id, nombre });
    }
    setNuevoNombre("");
    setAgregando(false);
  }

  function cancelarAgregar() {
    setNuevoNombre("");
    setAgregando(false);
  }

  return (
    <article
      id={`cuenta-${cuenta.id}`}
      className={`cuenta${destacada ? " destello" : ""}`}
      style={{ "--tono": cobro.paquete.color } as CSSProperties}
      aria-label={cuenta.nombre}
    >
      <header className="cuenta-cabeza">
        <div className="cuenta-titulo">
          <input
            ref={campoNombre}
            className="cuenta-nombre"
            defaultValue={cuenta.nombre}
            key={cuenta.nombre}
            onBlur={(e) => {
              // Si el nombre no cambia, `key` no remonta el campo: se repinta a mano.
              e.target.value = e.target.value.trim() || `Cuenta ${cuenta.numero}`;
              despachar({
                tipo: "editarCuenta",
                cuentaId: cuenta.id,
                cambios: { nombre: e.target.value },
              });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Nombre de la cuenta"
          />
          <div className="cuenta-etiquetas">
            <Menu
              etiqueta={`Paquete ${cobro.paquete.nombre}. Cambiar paquete`}
              titulo="Cambiar paquete"
              claseDisparador="paquete-pill"
              alinear="izquierda"
              disparador={
                <>
                  <span className="punto" aria-hidden="true" />
                  {cobro.paquete.nombre}
                  <ChevronDown size={13} aria-hidden="true" />
                </>
              }
            >
              {(cerrar) => (
                <>
                  <p className="menu-titulo">Paquete</p>
                  {estado.paquetes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={p.id === cobro.paquete.id}
                      className="menu-item"
                      style={{ "--tono": p.color } as CSSProperties}
                      onClick={() => {
                        despachar({
                          tipo: "editarCuenta",
                          cuentaId: cuenta.id,
                          cambios: { paqueteId: p.id },
                        });
                        cerrar();
                      }}
                    >
                      <span className="menu-marca" aria-hidden="true">
                        {p.id === cobro.paquete.id && <Check size={15} />}
                      </span>
                      <span className="punto" aria-hidden="true" />
                      {p.nombre}
                      <span className="menu-item-extra">{formatoPrecio(p.precioHora, moneda)}/h</span>
                    </button>
                  ))}
                </>
              )}
            </Menu>
            {descuentoComun === "happy_hour" && (
              <span className="etiqueta happy">
                <Zap size={11} aria-hidden="true" /> Happy hour
              </span>
            )}
            {descuentoComun === "estudiante" && (
              <span className="etiqueta estudiante">
                <GraduationCap size={12} aria-hidden="true" /> Estudiantes
              </span>
            )}
            <span className="etiqueta-texto">
              {modalidadComun && modalidadComun !== "tiempo" && (
                <>{NOMBRE_MODALIDAD_CORTO[modalidadComun]} · </>
              )}
              Abrió {formatoHora(cuenta.abiertaEn)}
            </span>
          </div>
        </div>

        <Dinero className="cuenta-total" valor={cobro.total} moneda={moneda} />

        <Menu etiqueta={`Opciones de ${cuenta.nombre}`}>
          {(cerrar) => (
            <>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  cerrar();
                  campoNombre.current?.focus();
                  campoNombre.current?.select();
                }}
              >
                <PencilLine size={16} aria-hidden="true" /> Cambiar nombre
              </button>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  cerrar();
                  setEditandoNotas(true);
                }}
              >
                <StickyNote size={16} aria-hidden="true" />
                {cuenta.notas ? "Editar nota" : "Agregar nota"}
              </button>
            </>
          )}
        </Menu>
      </header>

      <ul className="personas">
        {cuenta.personas.length === 0 && <li className="persona-vacia">Sin nadie todavía</li>}
        {cuenta.personas.map((persona) => (
          <FilaPersona
            key={persona.id}
            persona={persona}
            cobro={cobro.personas.find((p) => p.personaId === persona.id)!}
            tono={cobro.paquete.color}
            modalidadEnCabecera={modalidadComun !== null}
            descuentoEnCabecera={descuentoComun !== null}
            onSalida={() =>
              despachar({ tipo: "marcarSalida", cuentaId: cuenta.id, personaId: persona.id })
            }
            onDeshacerSalida={() =>
              despachar({ tipo: "deshacerSalida", cuentaId: cuenta.id, personaId: persona.id })
            }
            onRenombrar={(nombre) =>
              despachar({
                tipo: "renombrarPersona",
                cuentaId: cuenta.id,
                personaId: persona.id,
                nombre,
              })
            }
            onEditarEntrada={(entrada) =>
              despachar({
                tipo: "editarEntrada",
                cuentaId: cuenta.id,
                personaId: persona.id,
                entrada,
              })
            }
            onCambiarModalidad={(modalidad) =>
              despachar({
                tipo: "cambiarModalidad",
                cuentaId: cuenta.id,
                personaId: persona.id,
                modalidad,
              })
            }
            onQuitar={() => {
              if (confirm(`¿Quitar a ${persona.nombre} de ${cuenta.nombre}?`)) {
                despachar({ tipo: "quitarPersona", cuentaId: cuenta.id, personaId: persona.id });
              }
            }}
          />
        ))}
      </ul>

      {editandoNotas ? (
        <textarea
          className="campo nota-campo"
          defaultValue={cuenta.notas}
          autoFocus
          placeholder="Mesa, consumo extra, pendientes…"
          aria-label={`Nota de ${cuenta.nombre}`}
          onBlur={(e) => {
            despachar({
              tipo: "editarCuenta",
              cuentaId: cuenta.id,
              cambios: { notas: e.target.value.trim() },
            });
            setEditandoNotas(false);
          }}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        />
      ) : (
        cuenta.notas && (
          <button
            type="button"
            className="cuenta-nota"
            onClick={() => setEditandoNotas(true)}
            title="Editar nota"
          >
            <StickyNote size={14} aria-hidden="true" />
            <span>{cuenta.notas}</span>
          </button>
        )
      )}

      <footer className="cuenta-pie">
        {agregando ? (
          <form className="agregar-persona" onSubmit={agregarPersona}>
            <input
              className="campo"
              autoFocus
              placeholder="Nombre, o varios con comas"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onBlur={() => !nuevoNombre.trim() && cancelarAgregar()}
              onKeyDown={(e) => e.key === "Escape" && cancelarAgregar()}
              aria-label={`Quién entra a ${cuenta.nombre}`}
            />
            <button className="btn chico primario" type="submit" disabled={!nuevoNombre.trim()}>
              Agregar
            </button>
          </form>
        ) : (
          <>
            <button type="button" className="btn chico fantasma" onClick={() => setAgregando(true)}>
              <UserPlus size={16} aria-hidden="true" /> Persona
            </button>
            <button type="button" className="btn primario" onClick={onCobrar}>
              Cobrar
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
