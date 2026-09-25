import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Coffee, FolderOpen, Plus, TriangleAlert, X } from "lucide-react";
import type { Cuenta, MetodoPago, Modalidad } from "./tipos";
import { useAhora, useCaja } from "./estado/useCaja";
import { abrirCarpetaReportes, exportarDia } from "./lib/exportar";
import { formatoDinero } from "./lib/cobro";
import { BarraLateral, type Vista } from "./componentes/BarraLateral";
import { Resumen } from "./componentes/Resumen";
import { NuevaCuenta, type Eleccion } from "./componentes/NuevaCuenta";
import { TarjetaCuenta } from "./componentes/TarjetaCuenta";
import { ListaCobradas } from "./componentes/ListaCobradas";
import { ModalCobro } from "./componentes/ModalCobro";
import { ModalCierreDia } from "./componentes/ModalCierreDia";
import { PanelAjustes } from "./componentes/PanelAjustes";

interface Tostada {
  mensaje: string;
  conCarpeta: boolean;
  error: boolean;
}

export default function App() {
  const { estado, listo, errorCarga, despachar, guardarAhora, leerEstado } = useCaja();
  const ahora = useAhora();

  const [vista, setVista] = useState<Vista>("curso");
  const [creando, setCreando] = useState(false);
  const [eleccion, setEleccion] = useState<Eleccion | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);
  const [verAjustes, setVerAjustes] = useState(false);
  const [verCierre, setVerCierre] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [destacada, setDestacada] = useState<string | null>(null);
  const [tostada, setTostada] = useState<Tostada | null>(null);

  const avisar = useCallback(
    (mensaje: string, opciones: { conCarpeta?: boolean; error?: boolean } = {}) => {
      setTostada({ mensaje, conCarpeta: !!opciones.conCarpeta, error: !!opciones.error });
      setTimeout(() => setTostada((t) => (t?.mensaje === mensaje ? null : t)), 6000);
    },
    [],
  );

  /** Exporta el día. `limpiar` deja la caja vacía para la jornada siguiente. */
  const exportar = useCallback(
    async (limpiar: boolean) => {
      setExportando(true);
      try {
        const resultado = await exportarDia(leerEstado());
        if (limpiar) despachar({ tipo: "nuevoDia" });
        setVerCierre(false);
        avisar(`Reporte guardado en ${resultado.ubicacion}`, { conCarpeta: true });
        return true;
      } catch (e) {
        console.error("[app] falló la exportación:", e);
        avisar("No se pudo guardar el reporte. Revisa los permisos de la carpeta Documentos.", {
          error: true,
        });
        return false;
      } finally {
        setExportando(false);
      }
    },
    [avisar, despachar, leerEstado],
  );

  // Órdenes que llegan desde el ícono de la barra de menús (proceso en Rust).
  useEffect(() => {
    if (!listo) return;
    let vivo = true;
    const quitar: Array<() => void> = [];
    // Si el efecto ya se limpió cuando llega un listener, se suelta en el acto.
    const registrar = (fn: () => void) => {
      if (vivo) quitar.push(fn);
      else fn();
    };

    import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        registrar(await listen("orbtime://exportar", () => void exportar(false)));
        // Rust aplaza el cierre hasta que el reporte esté en disco. Pase lo
        // que pase hay que llamar a salir_app, o la app se queda colgada.
        registrar(
          await listen("orbtime://salir", async () => {
            try {
              await exportar(false);
              await guardarAhora();
            } catch (e) {
              console.error("[app] no se pudo cerrar limpio:", e);
            }
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("salir_app");
          }),
        );
      })
      .catch(() => {
        // Fuera de Tauri no hay barra de menús.
      });

    return () => {
      vivo = false;
      quitar.forEach((fn) => fn());
    };
  }, [listo, exportar, guardarAhora]);

  // El ajuste de "seguir en la barra de menús" vive en Rust, que es quien
  // intercepta el cierre de la ventana.
  useEffect(() => {
    if (!listo) return;
    import("@tauri-apps/api/core")
      .then(({ invoke }) =>
        invoke("set_ocultar_al_cerrar", { valor: estado.ajustes.cerrarAMenuBar }),
      )
      .catch(() => {});
  }, [listo, estado.ajustes.cerrarAMenuBar]);

  // Atajos: ⌘N abre una cuenta, ⌘, los ajustes.
  const hayModal = creando || verAjustes || verCierre || cobrando !== null;
  useEffect(() => {
    if (!listo || hayModal) return;
    const tecla = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCreando(true);
      } else if (e.key === ",") {
        e.preventDefault();
        setVerAjustes(true);
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [listo, hayModal]);

  /** Lleva a la tarjeta de una cuenta y la ilumina un momento. */
  const irACuenta = useCallback((cuentaId: string) => {
    setVista("curso");
    setDestacada(cuentaId);
    requestAnimationFrame(() => {
      const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(`cuenta-${cuentaId}`)
        ?.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "center" });
    });
    setTimeout(() => setDestacada((d) => (d === cuentaId ? null : d)), 1600);
  }, []);

  if (errorCarga) {
    return (
      <div className="cargando" role="alert">
        <div>
          No se pudo abrir la caja.{" "}
          <button type="button" className="btn chico" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!listo) {
    return <div className="cargando">Cargando la caja…</div>;
  }

  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn);
  const cuentaCobrando = estado.cuentas.find((c) => c.id === cobrando) ?? null;

  function abrirCuenta(paqueteId: string, personas: string[], modalidad: Modalidad) {
    despachar({ tipo: "abrirCuenta", paqueteId, nombresPersonas: personas, modalidad });
    setEleccion({ paqueteId, modalidad });
    setCreando(false);
    setVista("curso");
  }

  function cobrar(cuenta: Cuenta, metodo: MetodoPago, total: number) {
    despachar({ tipo: "cerrarCuenta", cuentaId: cuenta.id, metodoPago: metodo, total });
    setCobrando(null);
    avisar(`${cuenta.nombre} cobrada: ${formatoDinero(total, estado.ajustes.moneda)}`);
  }

  return (
    <div className="app">
      <BarraLateral
        estado={estado}
        ahora={ahora}
        vista={vista}
        onVista={setVista}
        onAjustes={() => setVerAjustes(true)}
        onCerrarDia={() => setVerCierre(true)}
      />

      <main className="principal">
        {/* Franja de la barra de título: arrastra la ventana y difumina lo que pasa por debajo. */}
        <div className="principal-arrastre" data-tauri-drag-region />

        <div className="principal-contenido">
          <Resumen
            estado={estado}
            ahora={ahora}
            onIrACuenta={irACuenta}
            onCerrarDia={() => setVerCierre(true)}
          />

          {vista === "curso" ? (
            <section className="tablero" aria-labelledby="titulo-curso">
              <div className="tablero-cabeza">
                <h2 id="titulo-curso" className="tablero-titulo">
                  En curso
                  {abiertas.length > 0 && <span className="insignia">{abiertas.length}</span>}
                </h2>
                {abiertas.length > 0 && (
                  <button
                    type="button"
                    className="btn primario"
                    onClick={() => setCreando(true)}
                    title="Nueva cuenta (⌘N)"
                  >
                    <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                    Nueva cuenta
                  </button>
                )}
              </div>

              {abiertas.length === 0 ? (
                <div className="vacio">
                  <span className="vacio-icono" aria-hidden="true">
                    <Coffee size={26} />
                  </span>
                  <h3>Nadie adentro todavía</h3>
                  <p>Abre una cuenta y el reloj empieza a correr solo.</p>
                  <button type="button" className="btn primario grande" onClick={() => setCreando(true)}>
                    <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
                    Nueva cuenta
                  </button>
                </div>
              ) : (
                <div className="rejilla">
                  {abiertas.map((cuenta) => (
                    <TarjetaCuenta
                      key={cuenta.id}
                      cuenta={cuenta}
                      estado={estado}
                      ahora={ahora}
                      destacada={destacada === cuenta.id}
                      despachar={despachar}
                      onCobrar={() => setCobrando(cuenta.id)}
                    />
                  ))}
                  <button type="button" className="cuenta-nueva" onClick={() => setCreando(true)}>
                    <span className="cuenta-nueva-icono" aria-hidden="true">
                      <Plus size={20} strokeWidth={2.4} />
                    </span>
                    Nueva cuenta
                  </button>
                </div>
              )}
            </section>
          ) : (
            <ListaCobradas
              estado={estado}
              despachar={despachar}
              onReabrir={(cuentaId) => {
                despachar({ tipo: "reabrirCuenta", cuentaId });
                irACuenta(cuentaId);
              }}
            />
          )}
        </div>
      </main>

      {creando && (
        <NuevaCuenta
          paquetes={estado.paquetes}
          ajustes={estado.ajustes}
          ahora={ahora}
          inicial={eleccion}
          onAbrir={abrirCuenta}
          onCerrar={() => setCreando(false)}
        />
      )}

      {cuentaCobrando && (
        <ModalCobro
          cuenta={cuentaCobrando}
          estado={estado}
          ahora={ahora}
          despachar={despachar}
          onCerrar={() => setCobrando(null)}
          onConfirmar={(metodo, total) => cobrar(cuentaCobrando, metodo, total)}
        />
      )}

      {verCierre && (
        <ModalCierreDia
          estado={estado}
          ahora={ahora}
          trabajando={exportando}
          onCerrar={() => setVerCierre(false)}
          onExportar={(limpiar) => void exportar(limpiar)}
        />
      )}

      {verAjustes && (
        <PanelAjustes
          estado={estado}
          onCerrar={() => setVerAjustes(false)}
          onGuardar={(paquetes, ajustes) => {
            despachar({ tipo: "guardarPaquetes", paquetes });
            despachar({ tipo: "guardarAjustes", ajustes });
            setVerAjustes(false);
            avisar("Ajustes guardados");
          }}
        />
      )}

      {tostada && (
        <div className={`tostada${tostada.error ? " error" : ""}`} role="status">
          {tostada.error ? (
            <TriangleAlert size={18} className="tostada-icono" aria-hidden="true" />
          ) : (
            <CircleCheck size={18} className="tostada-icono" aria-hidden="true" />
          )}
          <span className="tostada-texto">{tostada.mensaje}</span>
          {tostada.conCarpeta && (
            <button type="button" className="btn chico" onClick={() => void abrirCarpetaReportes()}>
              <FolderOpen size={15} aria-hidden="true" />
              Abrir carpeta
            </button>
          )}
          <button
            type="button"
            className="btn-icono"
            onClick={() => setTostada(null)}
            aria-label="Cerrar aviso"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
