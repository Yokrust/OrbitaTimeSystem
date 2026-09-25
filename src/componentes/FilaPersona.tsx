import { useState } from "react";
import { Check, Clock, GraduationCap, Trash2, Zap } from "lucide-react";
import type { CobroPersona, Modalidad, Persona } from "../tipos";
import { BLOQUE_MINUTOS, NOMBRE_MODALIDAD_CORTO } from "../lib/cobro";
import { formatoDuracion, formatoHora, horaTextoAISO } from "../lib/tiempo";
import { Avatar } from "./Avatar";
import { Menu } from "./Menu";

const MODALIDADES: Modalidad[] = ["tiempo", "dia", "all_access"];

/** Minutos antes de la siguiente hora en los que el anillo se pinta de ámbar. */
const AVISO_SIGUIENTE_HORA_MIN = 10;

interface Props {
  persona: Persona;
  cobro: CobroPersona;
  /** Color del paquete de la cuenta. */
  tono: string;
  /** Todos en la cuenta pagan igual y ya se dice arriba: no se repite en la fila. */
  modalidadEnCabecera: boolean;
  /** Lo mismo con el descuento. */
  descuentoEnCabecera: boolean;
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
  tono,
  modalidadEnCabecera,
  descuentoEnCabecera,
  onSalida,
  onDeshacerSalida,
  onRenombrar,
  onEditarEntrada,
  onCambiarModalidad,
  onQuitar,
}: Props) {
  const [editandoHora, setEditandoHora] = useState(false);
  const [textoHora, setTextoHora] = useState("");

  const dentro = cobro.activa;
  const minutos = cobro.minutosBrutos;
  const porHora = persona.modalidad === "tiempo";
  // El anillo del avatar enseña cuánto va de la hora que ya se le cobra.
  const enBloque = minutos % BLOQUE_MINUTOS;
  const faltan = Math.ceil(BLOQUE_MINUTOS - enBloque);
  const alerta = dentro && porHora && faltan <= AVISO_SIGUIENTE_HORA_MIN;
  const [horas, segundos] = partesCronometro(minutos);
  const verModalidad = !porHora && !modalidadEnCabecera;
  const descuento = descuentoEnCabecera ? "ninguno" : cobro.descuento;

  const otroBloque = BLOQUE_MINUTOS === 60 ? "Otra hora" : "Otro bloque";
  const pista = alerta
    ? `${otroBloque} de cobro en ${faltan} min`
    : `Entró ${formatoHora(persona.entrada)}`;

  function aplicarHora() {
    if (textoHora === horaCampo(persona.entrada)) return;
    const iso = horaTextoAISO(textoHora);
    if (iso) onEditarEntrada(iso);
  }

  function guardarHora(e: React.FormEvent) {
    e.preventDefault();
    aplicarHora();
    setEditandoHora(false);
  }

  return (
    <li className={`persona ${dentro ? "dentro" : "fuera"}`}>
      <Avatar
        nombre={persona.nombre}
        tono={tono}
        progreso={dentro && porHora ? enBloque / BLOQUE_MINUTOS : undefined}
        alerta={alerta}
        apagado={!dentro}
        titulo={pista}
      />

      <div className="persona-info">
        <input
          className="persona-nombre"
          defaultValue={persona.nombre}
          key={persona.nombre}
          onBlur={(e) => {
            // Si el nombre no cambia, `key` no remonta el campo: se repinta a mano.
            e.target.value = e.target.value.trim() || persona.nombre;
            onRenombrar(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label={`Nombre de ${persona.nombre}`}
        />
        {(verModalidad || descuento !== "ninguno" || !dentro || alerta) && (
          <div className="persona-etiquetas">
            {alerta && (
              <span className="etiqueta aviso">
                <Clock size={11} aria-hidden="true" /> {otroBloque} en {faltan} min
              </span>
            )}
            {verModalidad && (
              <span className="etiqueta">{NOMBRE_MODALIDAD_CORTO[persona.modalidad]}</span>
            )}
            {descuento === "happy_hour" && (
              <span className="etiqueta happy">
                <Zap size={11} aria-hidden="true" /> Happy hour
              </span>
            )}
            {descuento === "estudiante" && (
              <span className="etiqueta estudiante">
                <GraduationCap size={12} aria-hidden="true" /> Estudiante
              </span>
            )}
            {!dentro && persona.salida && (
              <span className="etiqueta-texto">Salió {formatoHora(persona.salida)}</span>
            )}
          </div>
        )}
      </div>

      <span className={`persona-reloj${alerta ? " alerta" : ""}`} title={pista}>
        {dentro ? (
          <>
            {horas}
            <span className="segundos">{segundos}</span>
          </>
        ) : (
          formatoDuracion(minutos)
        )}
      </span>

      {dentro ? (
        <button type="button" className="btn chico suave" onClick={onSalida} title="Marcar salida">
          Salió
        </button>
      ) : (
        <button
          type="button"
          className="btn chico fantasma"
          onClick={onDeshacerSalida}
          title="Volver a correr su reloj"
        >
          Volvió
        </button>
      )}

      <Menu
        etiqueta={`Opciones de ${persona.nombre}`}
        rol={editandoHora ? "dialog" : "menu"}
        alCerrar={(porClic) => {
          // Un clic fuera guarda la hora; Esc y Cancelar la descartan.
          if (porClic && editandoHora) aplicarHora();
          setEditandoHora(false);
        }}
      >
        {(cerrar) =>
          editandoHora ? (
            <form
              className="menu-formulario"
              onSubmit={(e) => {
                guardarHora(e);
                cerrar();
              }}
            >
              <label className="menu-titulo" htmlFor={`hora-${persona.id}`}>
                Hora de entrada
              </label>
              <input
                id={`hora-${persona.id}`}
                className="campo"
                type="time"
                value={textoHora}
                onChange={(e) => setTextoHora(e.target.value)}
                required
                autoFocus
              />
              <div className="menu-acciones">
                <button type="button" className="btn chico fantasma" onClick={() => setEditandoHora(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn chico primario">
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="menu-titulo">
                Entró {formatoHora(persona.entrada)}
                {persona.salida && ` · salió ${formatoHora(persona.salida)}`}
              </p>
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  setTextoHora(horaCampo(persona.entrada));
                  setEditandoHora(true);
                }}
              >
                <Clock size={16} aria-hidden="true" /> Corregir hora de entrada
              </button>

              <div className="menu-separador" role="separator" />
              <p className="menu-titulo">Cómo paga</p>
              {MODALIDADES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m === persona.modalidad}
                  className="menu-item"
                  onClick={() => {
                    onCambiarModalidad(m);
                    cerrar();
                  }}
                >
                  <span className="menu-marca" aria-hidden="true">
                    {m === persona.modalidad && <Check size={15} />}
                  </span>
                  {NOMBRE_MODALIDAD_CORTO[m]}
                </button>
              ))}

              <div className="menu-separador" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="menu-item peligro"
                onClick={() => {
                  cerrar();
                  onQuitar();
                }}
              >
                <Trash2 size={16} aria-hidden="true" /> Quitar de la cuenta
              </button>
            </>
          )
        }
      </Menu>
    </li>
  );
}

/** "1:35" y ":04": los segundos van aparte para pintarlos más tenues. */
function partesCronometro(minutos: number): [string, string] {
  const total = Math.max(0, Math.floor(minutos * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [`${h}:${String(m).padStart(2, "0")}`, `:${String(s).padStart(2, "0")}`];
}

/** ISO -> "09:53", el formato de un <input type="time">. */
function horaCampo(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
