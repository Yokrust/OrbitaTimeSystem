/**
 * Persistencia del día en curso.
 *
 * Dentro de Tauri escribe un JSON en la carpeta de datos de la app.
 * Fuera de Tauri (npm run dev en el navegador) cae a localStorage, para poder
 * trabajar la interfaz sin levantar la app nativa.
 *
 * Se guarda en cada cambio: si la Mac se apaga a media tarde, al abrir de
 * nuevo están todas las cuentas con sus horas de entrada intactas.
 */
import type { Cuenta, EstadoDia } from "../tipos";
import { estadoVacio, VERSION_ESTADO } from "./defaults";
import { enTauri } from "./entorno";
import { fechaOperativa } from "./tiempo";

const CARPETA = "ORBTIME";
const ARCHIVO = `${CARPETA}/dia-actual.json`;
const CLAVE_LOCAL = "orbtime:dia-actual";

export async function cargarEstado(): Promise<EstadoDia> {
  const crudo = await leerCrudo();
  if (!crudo) return estadoVacio();

  try {
    const datos = JSON.parse(crudo) as EstadoDia;
    return migrar(datos);
  } catch (e) {
    console.error("[almacen] JSON corrupto, se empieza en limpio:", e);
    return estadoVacio();
  }
}

export async function guardarEstado(estado: EstadoDia): Promise<void> {
  const contenido = JSON.stringify(estado, null, 2);
  if (!enTauri()) {
    localStorage.setItem(CLAVE_LOCAL, contenido);
    return;
  }
  const { writeTextFile, mkdir, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  try {
    await mkdir(CARPETA, { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // La carpeta ya existía; seguimos.
  }
  await writeTextFile(ARCHIVO, contenido, { baseDir: BaseDirectory.AppData });
}

async function leerCrudo(): Promise<string | null> {
  if (!enTauri()) return localStorage.getItem(CLAVE_LOCAL);
  const { readTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
  try {
    return await readTextFile(ARCHIVO, { baseDir: BaseDirectory.AppData });
  } catch {
    // Primer arranque: todavía no hay archivo.
    return null;
  }
}

/**
 * Rellena campos que falten (por si el archivo viene de una versión anterior)
 * y respeta la fecha guardada: NO se borra el día solo, para no perder cuentas
 * de un turno que cruzó la medianoche. El corte lo hace el cajero a mano.
 */
function migrar(datos: Partial<EstadoDia>): EstadoDia {
  const base = estadoVacio(datos.fecha ?? fechaOperativa());
  const guardadas = datos.cuentas ?? [];

  // Las cuentas se guardan de la más nueva a la más vieja, así que la
  // numeración de las que vienen sin número se reparte al revés.
  const total = guardadas.length;
  const cuentas: Cuenta[] = guardadas.map((c, i) => ({
    ...c,
    numero: c.numero ?? total - i,
    nombre: c.nombre || `Cuenta ${c.numero ?? total - i}`,
    notas: c.notas ?? "",
    personas: (c.personas ?? []).map((p) => ({
      ...p,
      // Antes de la v2 todo el mundo pagaba por tiempo.
      modalidad: p.modalidad ?? "tiempo",
      estudiante: p.estudiante ?? false,
      alarmasVistas: p.alarmasVistas ?? [],
    })),
  }));

  // Un paquete sin todos sus precios (los de la v1, o uno tocado a mano) no se
  // puede rescatar: un NaN llegaría al cobro. Se vuelve a los del negocio.
  const paquetesValidos =
    (datos.version ?? 0) >= 2 &&
    datos.paquetes?.length &&
    datos.paquetes.every(
      (p) =>
        [p.precioHora, p.precioDia, p.precioAllAccess].every(Number.isFinite) &&
        (p.precioHappyHour === null || Number.isFinite(p.precioHappyHour)),
    );

  return {
    ...base,
    ...datos,
    fecha: datos.fecha ?? base.fecha,
    cuentas,
    paquetes: paquetesValidos ? datos.paquetes! : base.paquetes,
    ajustes: {
      ...base.ajustes,
      ...(datos.ajustes ?? {}),
      // Estos llegaron en la v2; si vienen vacíos se usan los del negocio.
      horarios: datos.ajustes?.horarios?.length ? datos.ajustes.horarios : base.ajustes.horarios,
      happyHour: datos.ajustes?.happyHour?.length ? datos.ajustes.happyHour : base.ajustes.happyHour,
    },
    version: VERSION_ESTADO,
  };
}
