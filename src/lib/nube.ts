/**
 * Enganche con Supabase — FASE 2 (sincronizar la Mac con el iPhone).
 *
 * ESTADO: escrito y con los tipos verificados, pero todavía NO conectado a la
 * app ni probado contra un proyecto real. El prototipo de escritorio funciona
 * 100% en local; esto es el andamio para cuando exista el segundo dispositivo,
 * que es cuando hay algo que sincronizar y forma de comprobar que sirve.
 *
 * Antes de usarlo:
 *   1. aplica supabase/schema.sql en tu proyecto
 *   2. copia .env.example a .env con tu URL y anon key, y pon esa URL
 *      (https:// y wss://) en el connect-src de la CSP (tauri.conf.json)
 *   3. resuelve el conflicto de escrituras (ver nota al final)
 *   4. falta el inicio de sesión: sin una cuenta de public.equipo, las
 *      políticas no dejan leer ni escribir nada
 */
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Cuenta, MetodoGuardado, Modalidad, Paquete, Persona } from "../tipos";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const LLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let cliente: SupabaseClient | null = null;

export function estaConfigurada(): boolean {
  return Boolean(URL && LLAVE);
}

/** Crea el cliente la primera vez que se pide. null si no hay credenciales. */
export async function obtenerCliente(): Promise<SupabaseClient | null> {
  if (!estaConfigurada()) return null;
  if (cliente) return cliente;
  const { createClient } = await import("@supabase/supabase-js");
  cliente = createClient(URL!, LLAVE!);
  return cliente;
}

// ------------------------------------------------------ filas <-> modelo ----

interface FilaCuenta {
  id: string;
  numero: number;
  nombre: string;
  paquete_id: string;
  notas: string;
  fecha: string;
  abierta_en: string;
  cerrada_en: string | null;
  total_cobrado: number | null;
  metodo_pago: MetodoGuardado | null;
}

interface FilaPersona {
  id: string;
  cuenta_id: string;
  nombre: string;
  entrada: string;
  salida: string | null;
  modalidad: Modalidad;
  estudiante: boolean;
  alarmas_vistas: number[];
}

export function cuentaAFila(cuenta: Cuenta, fecha: string): FilaCuenta {
  return {
    id: cuenta.id,
    numero: cuenta.numero,
    nombre: cuenta.nombre,
    paquete_id: cuenta.paqueteId,
    notas: cuenta.notas,
    fecha,
    abierta_en: cuenta.abiertaEn,
    cerrada_en: cuenta.cerradaEn,
    total_cobrado: cuenta.totalCobrado,
    metodo_pago: cuenta.metodoPago,
  };
}

export function filaACuenta(fila: FilaCuenta, personas: Persona[]): Cuenta {
  return {
    id: fila.id,
    numero: fila.numero,
    nombre: fila.nombre,
    paqueteId: fila.paquete_id,
    personas,
    notas: fila.notas,
    abiertaEn: fila.abierta_en,
    cerradaEn: fila.cerrada_en,
    totalCobrado: fila.total_cobrado,
    metodoPago: fila.metodo_pago,
  };
}

export function personaAFila(persona: Persona, cuentaId: string): FilaPersona {
  return {
    id: persona.id,
    cuenta_id: cuentaId,
    nombre: persona.nombre,
    entrada: persona.entrada,
    salida: persona.salida,
    modalidad: persona.modalidad,
    estudiante: persona.estudiante,
    alarmas_vistas: persona.alarmasVistas,
  };
}

export function filaAPersona(fila: FilaPersona): Persona {
  return {
    id: fila.id,
    nombre: fila.nombre,
    entrada: fila.entrada,
    salida: fila.salida,
    modalidad: fila.modalidad ?? "tiempo",
    estudiante: fila.estudiante ?? false,
    alarmasVistas: fila.alarmas_vistas ?? [],
  };
}

export function paqueteAFila(paquete: Paquete, orden: number) {
  return {
    id: paquete.id,
    nombre: paquete.nombre,
    color: paquete.color,
    precio_hora: paquete.precioHora,
    precio_dia: paquete.precioDia,
    precio_all_access: paquete.precioAllAccess,
    precio_happy_hour: paquete.precioHappyHour,
    orden,
  };
}

// ------------------------------------------------------------ operaciones ---

/** Sube una cuenta y su gente. Las tablas usan el mismo id que el modelo local. */
export async function empujarCuenta(cuenta: Cuenta, fecha: string): Promise<void> {
  const db = await obtenerCliente();
  if (!db) return;

  const { error: errorCuenta } = await db.from("cuentas").upsert(cuentaAFila(cuenta, fecha));
  if (errorCuenta) throw errorCuenta;

  if (cuenta.personas.length === 0) return;
  const { error: errorPersonas } = await db
    .from("personas")
    .upsert(cuenta.personas.map((p) => personaAFila(p, cuenta.id)));
  if (errorPersonas) throw errorPersonas;
}

export async function empujarPaquetes(paquetes: Paquete[]): Promise<void> {
  const db = await obtenerCliente();
  if (!db) return;
  const { error } = await db.from("paquetes").upsert(paquetes.map(paqueteAFila));
  if (error) throw error;
}

/**
 * Escucha los cambios que hace el otro dispositivo.
 * Devuelve la función para darse de baja.
 */
export async function suscribirse(alCambiar: () => void): Promise<() => void> {
  const db = await obtenerCliente();
  if (!db) return () => {};

  const canal: RealtimeChannel = db
    .channel("orbtime-caja")
    .on("postgres_changes", { event: "*", schema: "public", table: "cuentas" }, alCambiar)
    .on("postgres_changes", { event: "*", schema: "public", table: "personas" }, alCambiar)
    .subscribe();

  return () => {
    void db.removeChannel(canal);
  };
}

/**
 * PENDIENTE antes de encender esto en producción:
 *
 * Si la Mac y el iPhone tocan la misma cuenta a la vez, gana quien escribe al
 * final y el otro pierde su cambio. Las opciones, de menos a más trabajo:
 *
 *   a) Un solo dispositivo escribe (la Mac) y el iPhone es de solo lectura.
 *      Cubre el caso real —consultar desde el piso— con cero riesgo. La base
 *      ya lo impone si quien usa el iPhone tiene rol 'consulta'.
 *   b) Comparar `actualizado_en` antes de escribir y descartar lo viejo.
 *   c) Mover el cierre de cuenta a una función de Postgres, para que el cobro
 *      sea atómico aunque dos cajeros lo intenten al mismo tiempo.
 *
 * La (a) es la que conviene para arrancar.
 */
