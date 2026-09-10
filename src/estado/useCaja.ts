import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { EstadoDia } from "../tipos";
import { estadoVacio } from "../lib/defaults";
import { cargarEstado, guardarEstado } from "../lib/almacen";
import { avisosPendientes, notificar, prepararNotificaciones } from "../lib/alarmas";
import { reducir, type Accion } from "./acciones";

/** Cada cuánto refrescamos los cronómetros en pantalla. */
const TICK_UI_MS = 1000;
/** Cada cuánto revisamos si toca disparar una alarma. */
const TICK_ALARMAS_MS = 15_000;

/**
 * Reloj compartido para toda la interfaz. Un solo intervalo en vez de uno por
 * tarjeta, y todo el mundo pinta el mismo segundo.
 */
export function useAhora(intervalo = TICK_UI_MS): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervalo);
    // Al volver de una suspensión el intervalo puede venir atrasado:
    // se fuerza un refresco cuando la ventana recupera el foco.
    const despertar = () => setAhora(Date.now());
    window.addEventListener("focus", despertar);
    document.addEventListener("visibilitychange", despertar);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", despertar);
      document.removeEventListener("visibilitychange", despertar);
    };
  }, [intervalo]);
  return ahora;
}

export function useCaja() {
  const [estado, despachar] = useReducer(reducir, undefined, () => estadoVacio());
  const [listo, setListo] = useState(false);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  /** Avisos ya notificados en esta sesión: "personaId:codigo". */
  const yaEmitidos = useRef<Set<string>>(new Set());

  // 1. Carga inicial desde disco.
  useEffect(() => {
    let vivo = true;
    cargarEstado().then((guardado) => {
      if (!vivo) return;
      despachar({ tipo: "cargar", estado: guardado });
      setListo(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // 2. Autoguardado. Se agrupa a 400 ms para no escribir en cada tecla.
  useEffect(() => {
    if (!listo) return;
    const id = setTimeout(() => {
      guardarEstado(estado).catch((e) => console.error("[caja] no se pudo guardar:", e));
    }, 400);
    return () => clearTimeout(id);
  }, [estado, listo]);

  // 3. Permiso de notificaciones, una sola vez.
  useEffect(() => {
    if (listo) void prepararNotificaciones();
  }, [listo]);

  // 4. Revisión de alarmas. Se ejecuta por intervalo propio y también cada vez
  //    que el backend en Rust manda un latido (eso la mantiene viva aunque
  //    macOS congele los temporizadores del webview en segundo plano).
  const revisarAlarmas = useCallback(() => {
    const actual = estadoRef.current;
    const pendientes = avisosPendientes(actual.cuentas, actual.paquetes, actual.ajustes);
    // El despacho de React no es inmediato: si la revisión corre dos veces
    // seguidas, el estado todavía no trae los avisos marcados. Este candado
    // en memoria evita la notificación repetida.
    const avisos = pendientes.filter((a) => !yaEmitidos.current.has(`${a.personaId}:${a.codigo}`));
    if (avisos.length === 0) return;
    for (const aviso of avisos) {
      yaEmitidos.current.add(`${aviso.personaId}:${aviso.codigo}`);
      void notificar(aviso.titulo, aviso.cuerpo);
    }
    despachar({ tipo: "marcarAvisos", avisos });
  }, []);

  useEffect(() => {
    if (!listo) return;
    const id = setInterval(revisarAlarmas, TICK_ALARMAS_MS);
    revisarAlarmas();
    return () => clearInterval(id);
  }, [listo, revisarAlarmas]);

  useEffect(() => {
    if (!listo) return;
    let quitar: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) => listen("orbtime://latido", () => revisarAlarmas()))
      .then((fn) => {
        quitar = fn;
      })
      .catch(() => {
        // Fuera de Tauri no hay latido; basta con el intervalo propio.
      });
    return () => quitar?.();
  }, [listo, revisarAlarmas]);

  const acciones = useMemo(
    () => ({
      despachar,
      /** Guarda ya mismo, sin esperar al debounce. Para antes de salir. */
      guardarAhora: () => guardarEstado(estadoRef.current),
      leerEstado: (): EstadoDia => estadoRef.current,
    }),
    [],
  );

  return { estado, listo, ...acciones } as {
    estado: EstadoDia;
    listo: boolean;
    despachar: (a: Accion) => void;
    guardarAhora: () => Promise<void>;
    leerEstado: () => EstadoDia;
  };
}
