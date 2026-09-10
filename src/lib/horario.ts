/**
 * Horarios del negocio y ventanas de happy hour.
 *
 * Todo se resuelve con "minutos desde la medianoche" en hora local, que es
 * como está escrito el horario en la puerta. Se asume que ningún día cierra
 * después de medianoche (hoy el más tarde cierra 21:30).
 */
import type { Horario, VentanaHappyHour } from "../tipos";

export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** "08:30" -> 510. Devuelve null si el texto no es una hora válida. */
export function aMinutos(hhmm: string): number | null {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 -> "8:30 a.m." */
export function aTextoHora(minutos: number): string {
  const h24 = Math.floor(minutos / 60) % 24;
  const min = minutos % 60;
  const sufijo = h24 < 12 ? "a.m." : "p.m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${sufijo}`;
}

function minutosDeFecha(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes() + fecha.getSeconds() / 60;
}

export function horarioDe(horarios: Horario[], dia: number): Horario | undefined {
  return horarios.find((h) => h.dia === dia);
}

export interface EstadoNegocio {
  abierto: boolean;
  /** Minutos que faltan para cerrar. null si está cerrado. */
  paraCerrar: number | null;
  /** Minutos que faltan para abrir. null si está abierto. */
  paraAbrir: number | null;
  /** "Cierra 9:30 p.m." o "Abre mañana 10:00 a.m." */
  texto: string;
}

export function estadoNegocio(horarios: Horario[], ahora: number = Date.now()): EstadoNegocio {
  const fecha = new Date(ahora);
  const minutos = minutosDeFecha(fecha);
  const hoy = horarioDe(horarios, fecha.getDay());

  if (hoy) {
    const abre = aMinutos(hoy.abre);
    const cierra = aMinutos(hoy.cierra);
    if (abre !== null && cierra !== null) {
      if (minutos >= abre && minutos < cierra) {
        return {
          abierto: true,
          paraCerrar: cierra - minutos,
          paraAbrir: null,
          texto: `Cierra ${aTextoHora(cierra)}`,
        };
      }
      if (minutos < abre) {
        return {
          abierto: false,
          paraCerrar: null,
          paraAbrir: abre - minutos,
          texto: `Abre ${aTextoHora(abre)}`,
        };
      }
    }
  }

  // Ya cerró (o hoy no abre): se busca el próximo día con horario.
  for (let salto = 1; salto <= 7; salto++) {
    const dia = (fecha.getDay() + salto) % 7;
    const siguiente = horarioDe(horarios, dia);
    const abre = siguiente ? aMinutos(siguiente.abre) : null;
    if (abre === null) continue;
    const cuando = salto === 1 ? "mañana" : DIAS[dia];
    return {
      abierto: false,
      paraCerrar: null,
      paraAbrir: salto * 24 * 60 - minutos + abre,
      texto: `Abre ${cuando} ${aTextoHora(abre)}`,
    };
  }

  return { abierto: false, paraCerrar: null, paraAbrir: null, texto: "Sin horario" };
}

/**
 * ¿Este instante cae dentro de una ventana de happy hour?
 * Se evalúa con la hora de ENTRADA de la persona: el pase se compró entonces,
 * no cuando el cajero lo cobra.
 */
export function enHappyHour(ventanas: VentanaHappyHour[], momento: string | number): boolean {
  const fecha = new Date(momento);
  const dia = fecha.getDay();
  const minutos = minutosDeFecha(fecha);

  return ventanas.some((v) => {
    if (!v.dias.includes(dia)) return false;
    const desde = aMinutos(v.desde);
    const hasta = aMinutos(v.hasta);
    if (desde === null || hasta === null) return false;
    return minutos >= desde && minutos < hasta;
  });
}

/** Las ventanas de hoy, para poder enseñarlas en la interfaz. */
export function happyHourDeHoy(
  ventanas: VentanaHappyHour[],
  ahora: number = Date.now(),
): VentanaHappyHour[] {
  const dia = new Date(ahora).getDay();
  return ventanas.filter((v) => v.dias.includes(dia));
}
