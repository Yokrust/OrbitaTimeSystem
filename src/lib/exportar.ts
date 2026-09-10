/**
 * Reporte del día: un CSV para abrir en Excel/Numbers y un JSON con el estado
 * completo por si después se quiere reprocesar.
 *
 * Ambos se guardan en ~/Documents/ORBTIME/.
 */
import { isTauri } from "@tauri-apps/api/core";
import type { Cuenta, EstadoDia } from "../tipos";
import {
  buscarPaquete,
  cobrarCuenta,
  NOMBRE_DESCUENTO,
  NOMBRE_MODALIDAD,
  redondearPeso,
} from "./cobro";
import { formatoFechaHora, selloArchivo } from "./tiempo";

const CARPETA = "ORBTIME";

export interface ResultadoExport {
  archivos: string[];
  /** Ruta legible para mostrarle al cajero. */
  ubicacion: string;
}

export async function exportarDia(estado: EstadoDia): Promise<ResultadoExport> {
  const sello = selloArchivo();
  const base = `ORBTIME_${sello}`;
  const csv = generarCSV(estado);
  const json = JSON.stringify(estado, null, 2);

  if (!enTauri()) {
    descargarNavegador(`${base}.csv`, csv, "text/csv;charset=utf-8");
    descargarNavegador(`${base}.json`, json, "application/json");
    return { archivos: [`${base}.csv`, `${base}.json`], ubicacion: "Descargas del navegador" };
  }

  const { writeTextFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  try {
    await mkdir(CARPETA, { baseDir: BaseDirectory.Document, recursive: true });
  } catch {
    // Ya existe.
  }
  // BOM para que Excel en Mac respete los acentos.
  await writeTextFile(`${CARPETA}/${base}.csv`, "﻿" + csv, {
    baseDir: BaseDirectory.Document,
  });
  await writeTextFile(`${CARPETA}/${base}.json`, json, { baseDir: BaseDirectory.Document });

  return {
    archivos: [`${base}.csv`, `${base}.json`],
    ubicacion: `Documentos/${CARPETA}`,
  };
}

/** Abre la carpeta de reportes en Finder. Silencioso si no se puede. */
export async function abrirCarpetaReportes(): Promise<boolean> {
  if (!enTauri()) return false;
  try {
    const { documentDir, join } = await import("@tauri-apps/api/path");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(await join(await documentDir(), CARPETA));
    return true;
  } catch (e) {
    console.error("[exportar] no se pudo abrir la carpeta:", e);
    return false;
  }
}

/**
 * Dos bloques en un solo archivo: primero el resumen del día, luego una fila
 * por persona. Es feo para un parser, pero es lo que realmente sirve cuando
 * abres el archivo el lunes por la mañana.
 */
export function generarCSV(estado: EstadoDia, ahora: number = Date.now()): string {
  const cobros = estado.cuentas.map((c) =>
    cobrarCuenta(c, estado.paquetes, estado.ajustes, ahora),
  );
  // Para una cuenta ya cobrada manda el importe que se cobró de verdad, no el
  // recálculo: si alguien reabre y toca algo, el reporte no debe moverse solo.
  const importeReal = (cuenta: Cuenta) =>
    cuenta.totalCobrado ?? cobros.find((c) => c.cuentaId === cuenta.id)?.total ?? 0;
  const totalDia = redondearPeso(estado.cuentas.reduce((a, c) => a + importeReal(c), 0));
  const totalPersonas = estado.cuentas.reduce((a, c) => a + c.personas.length, 0);
  const totalMinutos = cobros.reduce((a, c) => a + c.minutosTotales, 0);

  const filas: string[][] = [];
  filas.push(["ORBTIME — Reporte del día"]);
  filas.push(["Fecha operativa", estado.fecha]);
  filas.push(["Generado", formatoFechaHora(new Date(ahora).toISOString())]);
  filas.push(["Cuentas", String(estado.cuentas.length)]);
  filas.push(["Cuentas abiertas", String(estado.cuentas.filter((c) => !c.cerradaEn).length)]);
  filas.push(["Personas atendidas", String(totalPersonas)]);
  filas.push(["Horas vendidas", (totalMinutos / 60).toFixed(2)]);
  filas.push(["Descuentos aplicados", redondearPeso(cobros.reduce((a, c) => a + c.ahorro, 0)).toFixed(2)]);
  filas.push(["Total del día", totalDia.toFixed(2)]);
  filas.push([]);

  filas.push(["Por paquete", "Cuentas", "Personas", "Horas", "Importe"]);
  for (const paquete of estado.paquetes) {
    const delPaquete = cobros.filter((c) => c.paquete.id === paquete.id);
    if (delPaquete.length === 0) continue;
    const cuentasDelPaquete = estado.cuentas.filter((c) =>
      delPaquete.some((d) => d.cuentaId === c.id),
    );
    filas.push([
      paquete.nombre,
      String(delPaquete.length),
      String(delPaquete.reduce((a, c) => a + c.personas.length, 0)),
      (delPaquete.reduce((a, c) => a + c.minutosTotales, 0) / 60).toFixed(2),
      redondearPeso(cuentasDelPaquete.reduce((a, c) => a + importeReal(c), 0)).toFixed(2),
    ]);
  }
  filas.push([]);

  filas.push(["Por método de pago", "Cuentas", "Importe"]);
  const metodos = ["efectivo", "tarjeta", "transferencia", "sin cobrar"] as const;
  for (const metodo of metodos) {
    const cuentas = estado.cuentas.filter((c) =>
      metodo === "sin cobrar" ? !c.metodoPago : c.metodoPago === metodo,
    );
    if (cuentas.length === 0) continue;
    const importe = cuentas.reduce((a, c) => a + importeReal(c), 0);
    filas.push([metodo, String(cuentas.length), redondearPeso(importe).toFixed(2)]);
  }
  filas.push([]);

  // Ojo: estos dos bloques se calculan persona por persona con los precios de
  // hoy. Los de arriba usan lo que de verdad se cobró (`totalCobrado`), que es
  // por cuenta y no se puede repartir entre personas. En un día normal dan lo
  // mismo; si alguien reabrió una cuenta y le movió algo, aquí se ve el
  // recálculo y arriba lo que entró a la caja.
  const todosLosCobros = cobros.flatMap((c) => c.personas);

  filas.push(["Por modalidad", "Personas", "Importe calculado"]);
  for (const modalidad of ["tiempo", "dia", "all_access"] as const) {
    const delTipo = todosLosCobros.filter((p) => p.modalidad === modalidad);
    if (delTipo.length === 0) continue;
    filas.push([
      NOMBRE_MODALIDAD[modalidad],
      String(delTipo.length),
      redondearPeso(delTipo.reduce((a, p) => a + p.importe, 0)).toFixed(2),
    ]);
  }
  filas.push([]);

  filas.push(["Descuentos", "Personas", "Descontado"]);
  for (const tipo of ["estudiante", "happy_hour"] as const) {
    const conDescuento = todosLosCobros.filter((p) => p.descuento === tipo);
    if (conDescuento.length === 0) continue;
    filas.push([
      NOMBRE_DESCUENTO[tipo],
      String(conDescuento.length),
      redondearPeso(conDescuento.reduce((a, p) => a + p.ahorro, 0)).toFixed(2),
    ]);
  }
  filas.push([]);

  filas.push([
    "Cuenta",
    "Paquete",
    "Persona",
    "Modalidad",
    "Entrada",
    "Salida",
    "Minutos",
    "Horas cobradas",
    "Precio de lista",
    "Descuento",
    "Importe",
    "Estado",
    "Método de pago",
    "Notas",
  ]);
  for (const cuenta of estado.cuentas) {
    const cobro = cobros.find((c) => c.cuentaId === cuenta.id)!;
    for (const persona of cuenta.personas) {
      const cp = cobro.personas.find((p) => p.personaId === persona.id)!;
      filas.push([
        cuenta.nombre,
        cobro.paquete.nombre,
        persona.nombre,
        NOMBRE_MODALIDAD[cp.modalidad],
        formatoFechaHora(persona.entrada),
        persona.salida ? formatoFechaHora(persona.salida) : "",
        cp.minutosBrutos.toFixed(1),
        cp.modalidad === "tiempo" ? String(cp.horasFacturadas) : "",
        cp.importeBase.toFixed(2),
        NOMBRE_DESCUENTO[cp.descuento],
        cp.importe.toFixed(2),
        persona.salida ? "salió" : "adentro",
        cuenta.metodoPago ?? "",
        cuenta.notas,
      ]);
    }
    if (cuenta.personas.length === 0) {
      filas.push([
        cuenta.nombre,
        cobro.paquete.nombre,
        "(sin personas)",
        "", "", "", "0", "", "0.00", "", "0.00", "", "",
        cuenta.notas,
      ]);
    }
  }

  return filas.map((f) => f.map(celda).join(",")).join("\r\n");
}

function celda(valor: string): string {
  if (valor === "") return "";
  if (/[",\r\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** Solo se usa fuera de Tauri, para poder probar el reporte desde el navegador. */
function descargarNavegador(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const enTauri = () => {
  try {
    return isTauri();
  } catch {
    return false;
  }
};

/** Resumen corto para el ticket de una cuenta al momento de cobrar. */
export function ticketTexto(cuenta: Cuenta, estado: EstadoDia, ahora = Date.now()): string {
  const cobro = cobrarCuenta(cuenta, estado.paquetes, estado.ajustes, ahora);
  const paquete = buscarPaquete(estado.paquetes, cuenta.paqueteId);
  const lineas = [
    `${cuenta.nombre} — ${paquete.nombre}`,
    "",
    ...cobro.personas.map((p) => {
      const detalle =
        p.modalidad === "tiempo"
          ? `${p.horasFacturadas} h`
          : NOMBRE_MODALIDAD[p.modalidad];
      const desc = p.descuento === "ninguno" ? "" : ` (${NOMBRE_DESCUENTO[p.descuento]})`;
      return `${p.nombre} — ${detalle}${desc} — ${p.importe.toFixed(2)}`;
    }),
    "",
    `TOTAL: ${cobro.total.toFixed(2)}`,
  ];
  return lineas.join("\n");
}
