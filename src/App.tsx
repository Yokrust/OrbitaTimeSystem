import { useCallback, useEffect, useState } from "react";
import type { Cuenta, MetodoPago } from "./tipos";
import { useAhora, useCaja } from "./estado/useCaja";
import { abrirCarpetaReportes, exportarDia } from "./lib/exportar";
import { BarraSuperior } from "./componentes/BarraSuperior";
import { NuevaCuenta } from "./componentes/NuevaCuenta";
import { TarjetaCuenta } from "./componentes/TarjetaCuenta";
import { ModalCobro } from "./componentes/ModalCobro";
import { ModalCierreDia } from "./componentes/ModalCierreDia";
import { PanelAjustes } from "./componentes/PanelAjustes";

export default function App() {
  const { estado, listo, despachar, guardarAhora, leerEstado } = useCaja();
  const ahora = useAhora();

  const [cobrando, setCobrando] = useState<string | null>(null);
  const [verAjustes, setVerAjustes] = useState(false);
  const [verCierre, setVerCierre] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [tostada, setTostada] = useState<{ mensaje: string; conCarpeta: boolean } | null>(null);

  const avisar = useCallback((mensaje: string, conCarpeta = false) => {
    setTostada({ mensaje, conCarpeta });
    setTimeout(() => setTostada((t) => (t?.mensaje === mensaje ? null : t)), 6000);
  }, []);

  /** Exporta el día. `limpiar` deja la caja vacía para la jornada siguiente. */
  const exportar = useCallback(
    async (limpiar: boolean) => {
      setExportando(true);
      try {
        const resultado = await exportarDia(leerEstado());
        if (limpiar) despachar({ tipo: "nuevoDia" });
        setVerCierre(false);
        avisar(`Reporte guardado en ${resultado.ubicacion}`, true);
        return true;
      } catch (e) {
        console.error("[app] falló la exportación:", e);
        avisar("No se pudo guardar el reporte. Revisa los permisos de la carpeta Documentos.");
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
    const quitar: Array<() => void> = [];

    import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        quitar.push(await listen("orbtime://exportar", () => void exportar(false)));
        // Rust aplaza el cierre hasta que el reporte esté en disco. Pase lo
        // que pase hay que llamar a salir_app, o la app se queda colgada.
        quitar.push(
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

    return () => quitar.forEach((fn) => fn());
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

  if (!listo) {
    return (
      <div className="vacio" style={{ paddingTop: 160 }}>
        <p>Cargando la caja…</p>
      </div>
    );
  }

  const abiertas = estado.cuentas.filter((c) => !c.cerradaEn);
  const cerradas = estado.cuentas.filter((c) => c.cerradaEn);
  const cuentaCobrando = estado.cuentas.find((c) => c.id === cobrando) ?? null;

  function cobrar(cuenta: Cuenta, metodo: MetodoPago, total: number) {
    despachar({ tipo: "cerrarCuenta", cuentaId: cuenta.id, metodoPago: metodo, total });
    setCobrando(null);
    avisar(`${cuenta.nombre} cobrada.`);
  }

  return (
    <div className="app">
      <BarraSuperior
        estado={estado}
        ahora={ahora}
        onAjustes={() => setVerAjustes(true)}
        onCerrarDia={() => setVerCierre(true)}
      />

      <main className="contenido">
        <NuevaCuenta
          paquetes={estado.paquetes}
          ajustes={estado.ajustes}
          ahora={ahora}
          onAbrir={(paqueteId, personas, modalidad) =>
            despachar({ tipo: "abrirCuenta", paqueteId, nombresPersonas: personas, modalidad })
          }
        />

        {abiertas.length === 0 && cerradas.length === 0 ? (
          <div className="vacio">
            <h2>No hay nadie todavía</h2>
            <p>Abre una cuenta arriba y el reloj empieza a correr solo.</p>
          </div>
        ) : (
          <div className="rejilla">
            {abiertas.map((cuenta) => (
              <TarjetaCuenta
                key={cuenta.id}
                cuenta={cuenta}
                estado={estado}
                ahora={ahora}
                despachar={despachar}
                onCobrar={() => setCobrando(cuenta.id)}
              />
            ))}
          </div>
        )}

        {cerradas.length > 0 && (
          <>
            <h2 className="seccion-titulo">Cobradas hoy ({cerradas.length})</h2>
            <div className="rejilla">
              {cerradas.map((cuenta) => (
                <TarjetaCuenta
                  key={cuenta.id}
                  cuenta={cuenta}
                  estado={estado}
                  ahora={ahora}
                  despachar={despachar}
                  onCobrar={() => setCobrando(cuenta.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

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
            avisar("Ajustes guardados.");
          }}
        />
      )}

      {tostada && (
        <div className="tostada">
          <span>{tostada.mensaje}</span>
          {tostada.conCarpeta && (
            <button className="btn chico fantasma" onClick={() => void abrirCarpetaReportes()}>
              Abrir carpeta
            </button>
          )}
          <button className="btn chico fantasma" onClick={() => setTostada(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
