import { useState, type CSSProperties } from "react";
import type { Cuenta, EstadoDia } from "../tipos";
import type { Accion } from "../estado/acciones";
import { cobrarCuenta, formatoDinero, preciosDe } from "../lib/cobro";
import { formatoDuracion, formatoHora } from "../lib/tiempo";
import { FilaPersona } from "./FilaPersona";

interface Props {
  cuenta: Cuenta;
  estado: EstadoDia;
  ahora: number;
  despachar: (a: Accion) => void;
  onCobrar: () => void;
}

export function TarjetaCuenta({ cuenta, estado, ahora, despachar, onCobrar }: Props) {
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [cambiandoPaquete, setCambiandoPaquete] = useState(false);
  const [editandoNotas, setEditandoNotas] = useState(false);

  const cobro = cobrarCuenta(cuenta, estado.paquetes, estado.ajustes, ahora);
  const cerrada = cuenta.cerradaEn !== null;
  const moneda = estado.ajustes.moneda;
  const estilo = { "--tono": cobro.paquete.color } as CSSProperties;
  const precios = preciosDe(cobro.paquete, estado.ajustes, ahora);

  function agregarPersona(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    // Se pueden meter varias de un jalón: "Ana, Luis, Sofi"
    for (const parte of nombre.split(",")) {
      const limpio = parte.trim();
      if (limpio) despachar({ tipo: "agregarPersona", cuentaId: cuenta.id, nombre: limpio });
    }
    setNuevoNombre("");
  }

  return (
    <article className={`cuenta${cerrada ? " cerrada" : ""}`} style={estilo}>
      <header className="cuenta-cabeza">
        <input
          className="cuenta-nombre"
          defaultValue={cuenta.nombre}
          key={cuenta.nombre}
          disabled={cerrada}
          onBlur={(e) =>
            despachar({
              tipo: "editarCuenta",
              cuentaId: cuenta.id,
              cambios: { nombre: e.target.value.trim() || `Cuenta ${cuenta.numero}` },
            })
          }
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Nombre de la cuenta"
        />
        <div className="cuenta-total">
          <b>{formatoDinero(cuenta.totalCobrado ?? cobro.total, moneda)}</b>
          <small>
            {cobro.ahorro > 0
              ? `−${formatoDinero(cobro.ahorro, moneda)} en descuentos`
              : `${formatoDuracion(cobro.minutosTotales)} en total`}
          </small>
        </div>
      </header>

      <div className="cuenta-chips">
        {cambiandoPaquete && !cerrada ? (
          estado.paquetes.map((p) => (
            <button
              key={p.id}
              className="chip paquete"
              style={{ "--tono": p.color } as CSSProperties}
              onClick={() => {
                despachar({
                  tipo: "editarCuenta",
                  cuentaId: cuenta.id,
                  cambios: { paqueteId: p.id },
                });
                setCambiandoPaquete(false);
              }}
            >
              {p.nombre}
            </button>
          ))
        ) : (
          <button
            className="chip paquete"
            onClick={() => !cerrada && setCambiandoPaquete(true)}
            title="Cambiar de paquete"
          >
            {cobro.paquete.nombre}
            {precios.hayHappyHour ? " ⚡" : ""}
          </button>
        )}

        {cobro.personasActivas > 0 && (
          <span className="chip adentro">● {cobro.personasActivas} adentro</span>
        )}
        <span className="chip">Abrió {formatoHora(cuenta.abiertaEn)}</span>
        {cerrada && <span className="chip">Cobrada · {cuenta.metodoPago}</span>}
      </div>

      <div className="personas">
        {cuenta.personas.length === 0 && (
          <div className="persona-vacia">Todavía no hay nadie en esta cuenta.</div>
        )}
        {cuenta.personas.map((persona) => (
          <FilaPersona
            key={persona.id}
            persona={persona}
            cobro={cobro.personas.find((p) => p.personaId === persona.id)!}
            moneda={moneda}
            bloqueada={cerrada}
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
      </div>

      {(cuenta.notas || editandoNotas) && (
        <div className="cuenta-notas">
          {editandoNotas && !cerrada ? (
            <textarea
              className="campo"
              defaultValue={cuenta.notas}
              autoFocus
              placeholder="Mesa, consumo extra, pendientes…"
              onBlur={(e) => {
                despachar({
                  tipo: "editarCuenta",
                  cuentaId: cuenta.id,
                  cambios: { notas: e.target.value },
                });
                setEditandoNotas(false);
              }}
            />
          ) : (
            <span onClick={() => !cerrada && setEditandoNotas(true)}>📝 {cuenta.notas}</span>
          )}
        </div>
      )}

      <footer className="cuenta-pie">
        {cerrada ? (
          <>
            <span style={{ flex: 1, fontSize: 12, color: "var(--texto-3)" }}>
              Cerrada {formatoHora(cuenta.cerradaEn!)}
            </span>
            <button
              className="btn chico fantasma"
              onClick={() => despachar({ tipo: "reabrirCuenta", cuentaId: cuenta.id })}
            >
              Reabrir
            </button>
            <button
              className="btn chico fantasma peligro"
              onClick={() =>
                confirm(`¿Borrar la ${cuenta.nombre} del reporte?`) &&
                despachar({ tipo: "eliminarCuenta", cuentaId: cuenta.id })
              }
            >
              Borrar
            </button>
          </>
        ) : (
          <>
            <form className="agregar-persona" onSubmit={agregarPersona}>
              <input
                className="campo"
                placeholder="+ Agregar persona…"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
              />
              <button className="btn chico" type="submit" disabled={!nuevoNombre.trim()}>
                Entra
              </button>
            </form>
            {!cuenta.notas && !editandoNotas && (
              <button
                className="btn chico fantasma"
                onClick={() => setEditandoNotas(true)}
                title="Agregar una nota"
              >
                📝
              </button>
            )}
            <button className="btn chico verde" onClick={onCobrar}>
              Cobrar
            </button>
          </>
        )}
      </footer>
    </article>
  );
}
