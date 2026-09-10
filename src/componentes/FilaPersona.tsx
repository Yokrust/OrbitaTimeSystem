import { useState } from "react";
import type { CobroPersona, Modalidad, Persona } from "../tipos";
import { formatoCronometro, formatoDuracion, formatoHora, horaTextoAISO } from "../lib/tiempo";
import { formatoDinero, NOMBRE_DESCUENTO, NOMBRE_MODALIDAD_CORTO } from "../lib/cobro";

const MODALIDADES: Modalidad[] = ["tiempo", "dia", "all_access"];

interface Props {
  persona: Persona;
  cobro: CobroPersona;
  moneda: string;
  bloqueada: boolean;
  onSalida: () => void;
  onDeshacerSalida: () => void;
  onRenombrar: (nombre: string) => void;
  onEditarEntrada: (iso: string) => void;
  onCambiarModalidad: (modalidad: Modalidad) => void;
  onQuitar: () => void;
}

export function FilaPersona({
  persona,
  cobro,
  moneda,
  bloqueada,
  onSalida,
  onDeshacerSalida,
  onRenombrar,
  onEditarEntrada,
  onCambiarModalidad,
  onQuitar,
}: Props) {
  const [editandoHora, setEditandoHora] = useState(false);
  const [textoHora, setTextoHora] = useState("");
  const [eligiendoModalidad, setEligiendoModalidad] = useState(false);

  const dentro = cobro.activa;
  const clases = [
    "persona",
    dentro ? "dentro" : "fuera",
    cobro.descuento === "happy_hour" ? "happy" : "",
  ]
    .filter(Boolean)
    .join(" ");

  function abrirEdicionHora() {
    setTextoHora(
      new Date(persona.entrada).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
    setEditandoHora(true);
  }

  function confirmarHora() {
    const iso = horaTextoAISO(textoHora);
    if (iso) onEditarEntrada(iso);
    setEditandoHora(false);
  }

  return (
    <div className={clases}>
      <div className="persona-datos">
        <input
          className="persona-nombre"
          defaultValue={persona.nombre}
          key={persona.nombre}
          onBlur={(e) => onRenombrar(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Nombre de la persona"
        />

        <div className="persona-horas">
          {editandoHora ? (
            <input
              className="campo campo-hora"
              value={textoHora}
              autoFocus
              onChange={(e) => setTextoHora(e.target.value)}
              onBlur={confirmarHora}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmarHora();
                if (e.key === "Escape") setEditandoHora(false);
              }}
              aria-label="Corregir hora de entrada"
            />
          ) : (
            <button type="button" onClick={abrirEdicionHora} title="Corregir la hora de entrada">
              {formatoHora(persona.entrada)}
            </button>
          )}
          {" → "}
          {persona.salida ? formatoHora(persona.salida) : "ahora"}
        </div>

        <div className="persona-modalidad">
          {eligiendoModalidad && !bloqueada ? (
            MODALIDADES.map((m) => (
              <button
                key={m}
                className="mini"
                aria-pressed={m === persona.modalidad}
                onClick={() => {
                  onCambiarModalidad(m);
                  setEligiendoModalidad(false);
                }}
              >
                {NOMBRE_MODALIDAD_CORTO[m]}
              </button>
            ))
          ) : (
            <button
              className="mini activa"
              onClick={() => !bloqueada && setEligiendoModalidad(true)}
              title="Cambiar cómo paga"
            >
              {NOMBRE_MODALIDAD_CORTO[persona.modalidad]}
            </button>
          )}
          {cobro.descuento !== "ninguno" && (
            <span className={`mini etiqueta-${cobro.descuento}`}>
              {NOMBRE_DESCUENTO[cobro.descuento]}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className="persona-reloj">
          {dentro
            ? formatoCronometro(cobro.minutosBrutos)
            : formatoDuracion(cobro.minutosBrutos)}
        </div>
        <div className="persona-importe">
          {cobro.ahorro > 0 && (
            <s>{formatoDinero(cobro.importeBase, moneda)}</s>
          )}{" "}
          {formatoDinero(cobro.importe, moneda)}
        </div>
      </div>

      <div className="persona-acciones">
        {!bloqueada &&
          (dentro ? (
            <button className="btn chico" onClick={onSalida} title="Marcar salida">
              Salió
            </button>
          ) : (
            <button
              className="btn chico fantasma"
              onClick={onDeshacerSalida}
              title="Volver a abrirle el reloj"
            >
              Volvió
            </button>
          ))}
        {!bloqueada && (
          <button
            className="btn chico fantasma peligro"
            onClick={onQuitar}
            title="Quitar de la cuenta"
            aria-label={`Quitar a ${persona.nombre}`}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
