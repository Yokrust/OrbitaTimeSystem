/** Utilidades de tiempo. Todo se deriva de marcas ISO, nunca de contadores. */

export const MS_MIN = 60_000;

/** Minutos transcurridos entre dos instantes (con decimales). */
export function minutosEntre(desdeISO: string, hastaISO: string | number): number {
  const desde = new Date(desdeISO).getTime();
  const hasta = typeof hastaISO === "number" ? hastaISO : new Date(hastaISO).getTime();
  return Math.max(0, (hasta - desde) / MS_MIN);
}

/** "1h 23m" — el formato que el cajero lee de reojo. */
export function formatoDuracion(minutos: number): string {
  const total = Math.floor(minutos);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** "1:23:45" — con segundos, para el contador en vivo. */
export function formatoCronometro(minutos: number): string {
  const totalSeg = Math.max(0, Math.floor(minutos * 60));
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "10:23 a.m." */
export function formatoHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Fecha operativa local en YYYY-MM-DD (no UTC: el día del negocio es el local). */
export function fechaOperativa(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Sello para nombres de archivo: 2026-09-09_1843 */
export function selloArchivo(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fechaOperativa(d)}_${hh}${mm}`;
}

/**
 * Convierte "10:23" o "10:23 am" escrito por el cajero en un ISO de HOY.
 * Sirve para corregir una entrada cuando alguien llegó antes de que lo
 * registraran. Devuelve null si no se entiende el texto.
 */
export function horaTextoAISO(texto: string, base: Date = new Date()): string | null {
  const limpio = texto.trim().toLowerCase().replace(/\./g, "");
  const m = limpio.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm|a m|p m)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sufijo = m[3]?.replace(/\s/g, "");
  if (min > 59) return null;
  if (sufijo === "pm" && h < 12) h += 12;
  if (sufijo === "am" && h === 12) h = 0;
  if (h > 23) return null;
  const d = new Date(base);
  d.setHours(h, min, 0, 0);
  // Si la hora resultante quedó en el futuro, se asume que fue ayer
  // (turnos que cruzan la medianoche).
  if (d.getTime() > base.getTime() + MS_MIN) d.setDate(d.getDate() - 1);
  return d.toISOString();
}
