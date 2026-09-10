import { useState, type CSSProperties } from "react";
import type { Ajustes, EstadoDia, Paquete, VentanaHappyHour } from "../tipos";
import { DIAS_CORTOS } from "../lib/horario";

interface Props {
  estado: EstadoDia;
  onGuardar: (paquetes: Paquete[], ajustes: Ajustes) => void;
  onCerrar: () => void;
}

export function PanelAjustes({ estado, onGuardar, onCerrar }: Props) {
  const [paquetes, setPaquetes] = useState<Paquete[]>(() =>
    estado.paquetes.map((p) => ({ ...p })),
  );
  const [ajustes, setAjustes] = useState<Ajustes>(() => ({
    ...estado.ajustes,
    horarios: estado.ajustes.horarios.map((h) => ({ ...h })),
    happyHour: estado.ajustes.happyHour.map((v) => ({ ...v, dias: [...v.dias] })),
  }));

  const editarPaquete = (id: string, cambios: Partial<Paquete>) =>
    setPaquetes((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  const editarVentana = (i: number, cambios: Partial<VentanaHappyHour>) =>
    setAjustes((a) => ({
      ...a,
      happyHour: a.happyHour.map((v, j) => (j === i ? { ...v, ...cambios } : v)),
    }));

  const alternarDia = (i: number, dia: number) => {
    const actual = ajustes.happyHour[i].dias;
    editarVentana(i, {
      dias: actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort(),
    });
  };

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  return (
    <div className="velo" onClick={onCerrar}>
      <div
        className="modal ancho"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-cabeza">
          <h2>Ajustes</h2>
          <button className="btn fantasma chico" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="modal-cuerpo">
          <div className="ajustes-grupo">
            <h3>Paquetes y precios</h3>
            <div className="precios-cabecera">
              <span />
              <span>Por hora</span>
              <span>Día</span>
              <span>All access</span>
              <span>All access en happy hour</span>
            </div>
            {paquetes.map((p) => (
              <div
                key={p.id}
                className="paquete-editor"
                style={{ "--tono": p.color } as CSSProperties}
              >
                <div className="paquete-fila">
                  <div className="paquete-identidad">
                    <input
                      type="color"
                      value={p.color}
                      onChange={(e) => editarPaquete(p.id, { color: e.target.value })}
                      aria-label={`Color de ${p.nombre}`}
                    />
                    <input
                      className="campo"
                      value={p.nombre}
                      onChange={(e) => editarPaquete(p.id, { nombre: e.target.value })}
                      aria-label="Nombre del paquete"
                    />
                  </div>
                  <input
                    className="campo"
                    type="number"
                    min={0}
                    value={p.precioHora}
                    onChange={(e) => editarPaquete(p.id, { precioHora: num(e.target.value) })}
                    aria-label={`Precio por hora de ${p.nombre}`}
                  />
                  <input
                    className="campo"
                    type="number"
                    min={0}
                    value={p.precioDia}
                    onChange={(e) => editarPaquete(p.id, { precioDia: num(e.target.value) })}
                    aria-label={`Precio de día de ${p.nombre}`}
                  />
                  <input
                    className="campo"
                    type="number"
                    min={0}
                    value={p.precioAllAccess}
                    onChange={(e) => editarPaquete(p.id, { precioAllAccess: num(e.target.value) })}
                    aria-label={`Precio all access de ${p.nombre}`}
                  />
                  <input
                    className="campo"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={p.precioHappyHour ?? ""}
                    onChange={(e) =>
                      editarPaquete(p.id, {
                        precioHappyHour: e.target.value === "" ? null : num(e.target.value),
                      })
                    }
                    aria-label={`Precio de happy hour de ${p.nombre}`}
                  />
                </div>
              </div>
            ))}
            <p className="pista">
              Deja vacía la última columna en los paquetes que no tengan happy hour.
            </p>
          </div>

          <div className="ajustes-grupo">
            <h3>Descuentos</h3>
            <div className="linea-ajuste">
              <label htmlFor="aj-est">Estudiante</label>
              <input
                id="aj-est"
                className="campo corto"
                type="number"
                min={0}
                max={100}
                value={ajustes.descuentoEstudiante}
                onChange={(e) =>
                  setAjustes({ ...ajustes, descuentoEstudiante: Math.min(100, num(e.target.value)) })
                }
              />
              <span className="pista">% sobre el precio de lista. Nunca se acumula con la happy hour.</span>
            </div>

            <h4 className="sub">Ventanas de happy hour</h4>
            {ajustes.happyHour.map((v, i) => (
              <div key={i} className="ventana-hh">
                <div className="dias-elegir">
                  {DIAS_CORTOS.map((nombre, dia) => (
                    <button
                      key={dia}
                      className="mini"
                      aria-pressed={v.dias.includes(dia)}
                      onClick={() => alternarDia(i, dia)}
                    >
                      {nombre}
                    </button>
                  ))}
                </div>
                <input
                  className="campo corto"
                  type="time"
                  value={v.desde}
                  onChange={(e) => editarVentana(i, { desde: e.target.value })}
                  aria-label="Inicio de la happy hour"
                />
                <span className="pista">a</span>
                <input
                  className="campo corto"
                  type="time"
                  value={v.hasta}
                  onChange={(e) => editarVentana(i, { hasta: e.target.value })}
                  aria-label="Fin de la happy hour"
                />
              </div>
            ))}
          </div>

          <div className="ajustes-grupo">
            <h3>Horario del negocio</h3>
            {ajustes.horarios.map((h, i) => (
              <div key={h.dia} className="linea-horario">
                <span>{DIAS_CORTOS[h.dia]}</span>
                <input
                  className="campo corto"
                  type="time"
                  value={h.abre}
                  onChange={(e) =>
                    setAjustes({
                      ...ajustes,
                      horarios: ajustes.horarios.map((x, j) =>
                        j === i ? { ...x, abre: e.target.value } : x,
                      ),
                    })
                  }
                  aria-label={`Hora de apertura del ${DIAS_CORTOS[h.dia]}`}
                />
                <span className="pista">a</span>
                <input
                  className="campo corto"
                  type="time"
                  value={h.cierra}
                  onChange={(e) =>
                    setAjustes({
                      ...ajustes,
                      horarios: ajustes.horarios.map((x, j) =>
                        j === i ? { ...x, cierra: e.target.value } : x,
                      ),
                    })
                  }
                  aria-label={`Hora de cierre del ${DIAS_CORTOS[h.dia]}`}
                />
              </div>
            ))}
          </div>

          <div className="ajustes-grupo">
            <h3>Recordatorios</h3>
            <div className="linea-ajuste">
              <label htmlFor="aj-int">Avisar cada</label>
              <input
                id="aj-int"
                className="campo corto"
                type="number"
                min={1}
                value={ajustes.intervaloAlarmaMin}
                onChange={(e) =>
                  setAjustes({ ...ajustes, intervaloAlarmaMin: Math.max(1, num(e.target.value)) })
                }
              />
              <span className="pista">
                minutos, por cada persona que paga por tiempo.
              </span>
            </div>

            <label className="interruptor">
              <input
                type="checkbox"
                checked={ajustes.avisarCierre}
                onChange={(e) => setAjustes({ ...ajustes, avisarCierre: e.target.checked })}
              />
              <span>
                Avisar cuando falte poco para cerrar
                <small>A 30 y a 15 minutos, solo si todavía queda gente adentro.</small>
              </span>
            </label>

            <label className="interruptor">
              <input
                type="checkbox"
                checked={ajustes.cerrarAMenuBar}
                onChange={(e) => setAjustes({ ...ajustes, cerrarAMenuBar: e.target.checked })}
              />
              <span>
                Al cerrar la ventana, seguir en la barra de menús
                <small>Los relojes siguen corriendo y las alarmas siguen llegando.</small>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-pie">
          <button className="btn fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn primario" onClick={() => onGuardar(paquetes, ajustes)}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
