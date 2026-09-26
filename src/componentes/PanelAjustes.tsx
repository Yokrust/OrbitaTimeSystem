import { useRef, useState, type CSSProperties } from "react";
import type { Ajustes, EstadoDia, Horario, Paquete, VentanaHappyHour } from "../tipos";
import { DIAS, DIAS_CORTOS } from "../lib/horario";
import { mayuscula } from "../lib/texto";
import { Modal } from "./Modal";
import { Segmentado } from "./Segmentado";

interface Props {
  estado: EstadoDia;
  onGuardar: (paquetes: Paquete[], ajustes: Ajustes) => void;
  onCerrar: () => void;
}

type Seccion = "precios" | "horario" | "avisos";

/** La semana empieza en lunes, como se lee en la puerta. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

export function PanelAjustes({ estado, onGuardar, onCerrar }: Props) {
  const [seccion, setSeccion] = useState<Seccion>("precios");
  const [paquetes, setPaquetes] = useState<Paquete[]>(() =>
    estado.paquetes.map((p) => ({ ...p })),
  );
  const [ajustes, setAjustes] = useState<Ajustes>(() => ({
    ...estado.ajustes,
    horarios: estado.ajustes.horarios.map((h) => ({ ...h })),
    happyHour: estado.ajustes.happyHour.map((v) => ({ ...v, dias: [...v.dias] })),
  }));
  const original = useRef(JSON.stringify({ paquetes, ajustes }));

  const editarPaquete = (id: string, cambios: Partial<Paquete>) =>
    setPaquetes((prev) => prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)));

  const editarHorario = (dia: number, cambios: Partial<Horario>) =>
    setAjustes((a) => ({
      ...a,
      horarios: a.horarios.map((h) => (h.dia === dia ? { ...h, ...cambios } : h)),
    }));

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

  /** Si hay cambios sin guardar, se pregunta antes de tirarlos. */
  function cerrar() {
    const sinCambios = JSON.stringify({ paquetes, ajustes }) === original.current;
    if (sinCambios || confirm("¿Salir sin guardar los cambios?")) onCerrar();
  }

  return (
    <Modal
      titulo="Ajustes"
      ancho
      onCerrar={cerrar}
      pie={
        <>
          <button type="button" className="btn fantasma" onClick={cerrar}>
            Cancelar
          </button>
          <button type="button" className="btn primario" onClick={() => onGuardar(paquetes, ajustes)}>
            Guardar
          </button>
        </>
      }
    >
      <div className="ajustes-secciones">
        <Segmentado
          etiqueta="Sección"
          opciones={[
            { valor: "precios", etiqueta: "Precios" },
            { valor: "horario", etiqueta: "Horario" },
            { valor: "avisos", etiqueta: "Avisos" },
          ]}
          valor={seccion}
          onCambio={setSeccion}
        />
      </div>

      {seccion === "precios" && (
        <>
          <section className="ajustes-grupo">
            <h3>Paquetes</h3>
            <div className="precios-fila cabecera" aria-hidden="true">
              <span>Nombre</span>
              <span>Por hora</span>
              <span>Día</span>
              <span>All access</span>
              <span>Happy hour</span>
            </div>
            {paquetes.map((p) => (
              <div key={p.id} className="precios-fila" style={{ "--tono": p.color } as CSSProperties}>
                <div className="paquete-identidad">
                  <input
                    type="color"
                    className="muestra-color"
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
                <CampoPrecio
                  valor={p.precioHora}
                  onCambio={(v) => editarPaquete(p.id, { precioHora: num(v) })}
                  etiqueta={`Precio por hora de ${p.nombre}`}
                />
                <CampoPrecio
                  valor={p.precioDia}
                  onCambio={(v) => editarPaquete(p.id, { precioDia: num(v) })}
                  etiqueta={`Precio de día de ${p.nombre}`}
                />
                <CampoPrecio
                  valor={p.precioAllAccess}
                  onCambio={(v) => editarPaquete(p.id, { precioAllAccess: num(v) })}
                  etiqueta={`Precio all access de ${p.nombre}`}
                />
                <CampoPrecio
                  valor={p.precioHappyHour ?? ""}
                  onCambio={(v) =>
                    editarPaquete(p.id, { precioHappyHour: v === "" ? null : num(v) })
                  }
                  etiqueta={`Precio all access en happy hour de ${p.nombre}`}
                  placeholder="—"
                />
              </div>
            ))}
            <p className="pista">Deja vacío “Happy hour” en los paquetes que no la tienen.</p>
          </section>

          <section className="ajustes-grupo">
            <h3>Descuento de estudiante</h3>
            <div className="linea-ajuste">
              <div className="campo-sufijo">
                <input
                  id="aj-estudiante"
                  className="campo corto"
                  type="number"
                  min={0}
                  max={100}
                  value={ajustes.descuentoEstudiante}
                  onChange={(e) =>
                    setAjustes({
                      ...ajustes,
                      descuentoEstudiante: Math.min(100, num(e.target.value)),
                    })
                  }
                  aria-label="Descuento de estudiante en porcentaje"
                />
                <span aria-hidden="true">%</span>
              </div>
              <span className="pista">No se suma a la happy hour.</span>
            </div>
          </section>
        </>
      )}

      {seccion === "horario" && (
        <>
          <section className="ajustes-grupo">
            <h3>Horario del negocio</h3>
            {SEMANA.map((dia) => {
              const h = ajustes.horarios.find((x) => x.dia === dia);
              if (!h) return null;
              return (
                <div key={dia} className="linea-horario">
                  <span className="linea-horario-dia">{mayuscula(DIAS[dia])}</span>
                  <input
                    className="campo hora"
                    type="time"
                    value={h.abre}
                    onChange={(e) => editarHorario(dia, { abre: e.target.value })}
                    aria-label={`Abre el ${DIAS[dia]}`}
                  />
                  <span className="pista">a</span>
                  <input
                    className="campo hora"
                    type="time"
                    value={h.cierra}
                    onChange={(e) => editarHorario(dia, { cierra: e.target.value })}
                    aria-label={`Cierra el ${DIAS[dia]}`}
                  />
                </div>
              );
            })}
          </section>

          <section className="ajustes-grupo">
            <h3>Happy hour</h3>
            {ajustes.happyHour.map((v, i) => (
              <div key={i} className="ventana-hh">
                <div className="dias-elegir" role="group" aria-label={`Días de la ventana ${i + 1}`}>
                  {SEMANA.map((dia) => (
                    <button
                      key={dia}
                      type="button"
                      className="dia-boton"
                      aria-pressed={v.dias.includes(dia)}
                      onClick={() => alternarDia(i, dia)}
                      title={mayuscula(DIAS[dia])}
                    >
                      {DIAS_CORTOS[dia]}
                    </button>
                  ))}
                </div>
                <div className="ventana-horas">
                  <input
                    className="campo hora"
                    type="time"
                    value={v.desde}
                    onChange={(e) => editarVentana(i, { desde: e.target.value })}
                    aria-label="Empieza"
                  />
                  <span className="pista">a</span>
                  <input
                    className="campo hora"
                    type="time"
                    value={v.hasta}
                    onChange={(e) => editarVentana(i, { hasta: e.target.value })}
                    aria-label="Termina"
                  />
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {seccion === "avisos" && (
        <div className="filas-ajuste">
          <div className="fila-ajuste">
            <label htmlFor="aj-intervalo">
              <b>Recordar el tiempo</b>
              <small>Un aviso por cada persona que paga por hora.</small>
            </label>
            <div className="campo-sufijo">
              <span aria-hidden="true">cada</span>
              <input
                id="aj-intervalo"
                className="campo corto"
                type="number"
                min={1}
                value={ajustes.intervaloAlarmaMin}
                onChange={(e) =>
                  setAjustes({ ...ajustes, intervaloAlarmaMin: Math.max(1, num(e.target.value)) })
                }
              />
              <span aria-hidden="true">min</span>
            </div>
          </div>

          <label className="fila-ajuste">
            <span>
              <b>Avisar antes de cerrar</b>
              <small>A 30 y a 15 minutos, si todavía queda gente.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="interruptor"
              checked={ajustes.avisarCierre}
              onChange={(e) => setAjustes({ ...ajustes, avisarCierre: e.target.checked })}
            />
          </label>

          <label className="fila-ajuste">
            <span>
              <b>Seguir en la barra de menús</b>
              <small>Al cerrar la ventana, los relojes y avisos siguen corriendo.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="interruptor"
              checked={ajustes.cerrarAMenuBar}
              onChange={(e) => setAjustes({ ...ajustes, cerrarAMenuBar: e.target.checked })}
            />
          </label>
        </div>
      )}
    </Modal>
  );
}

function CampoPrecio(props: {
  valor: number | "";
  onCambio: (valor: string) => void;
  etiqueta: string;
  placeholder?: string;
}) {
  return (
    <div className="campo-precio">
      <input
        className="campo"
        type="number"
        min={0}
        value={props.valor}
        placeholder={props.placeholder}
        onChange={(e) => props.onCambio(e.target.value)}
        aria-label={props.etiqueta}
      />
    </div>
  );
}
