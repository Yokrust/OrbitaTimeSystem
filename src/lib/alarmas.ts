/**
 * Alarmas: recordatorios automáticos al cajero.
 *
 * Los umbrales se deducen del tiempo transcurrido, no de un temporizador que
 * va contando. Si la Mac se durmió tres horas, al despertar se disparan (una
 * sola vez) los avisos que se hubieran perdido, con el texto correcto.
 */
import type { Ajustes, Cuenta, Paquete } from "../tipos";
import { buscarPaquete } from "./cobro";
import { enTauri } from "./entorno";
import { estadoNegocio } from "./horario";
import { fechaOperativa, formatoDuracion, minutosEntre } from "./tiempo";

/** Códigos reservados. Los de cierre no cuelgan de ninguna persona. */
export const AVISO_CIERRE_30 = -30;
export const AVISO_CIERRE_15 = -15;
/** personaId que usan los avisos del negocio, no de una persona concreta. */
export const NEGOCIO = "__negocio__";

/** A cuántos minutos del cierre se avisa, si todavía hay gente adentro. */
const AVISOS_CIERRE: Array<{ minutos: number; codigo: number }> = [
  { minutos: 30, codigo: AVISO_CIERRE_30 },
  { minutos: 15, codigo: AVISO_CIERRE_15 },
];

export interface Aviso {
  cuentaId: string;
  personaId: string;
  /** Umbral en minutos, o uno de los códigos reservados. */
  codigo: number;
  titulo: string;
  cuerpo: string;
}

/** Los avisos de cierre se recuerdan por día: mañana vuelven a sonar. */
export function claveCierre(codigo: number, ahora: number = Date.now()): string {
  return `${fechaOperativa(new Date(ahora))}:${codigo}`;
}

/**
 * Revisa todas las cuentas abiertas y devuelve los avisos pendientes.
 * Función pura: no notifica ni muta nada, solo dice qué habría que avisar.
 */
export function avisosPendientes(
  cuentas: Cuenta[],
  paquetes: Paquete[],
  ajustes: Ajustes,
  ahora: number = Date.now(),
  cierresVistos: string[] = [],
): Aviso[] {
  const avisos: Aviso[] = [];
  const intervalo = Math.max(1, ajustes.intervaloAlarmaMin);
  let genteAdentro = 0;

  for (const cuenta of cuentas) {
    if (cuenta.cerradaEn) continue;
    const paquete = buscarPaquete(paquetes, cuenta.paqueteId);

    for (const persona of cuenta.personas) {
      if (persona.salida) continue;
      genteAdentro++;

      // Solo se vigila a quien paga por tiempo: es a quien le sigue subiendo
      // la cuenta. Con pase de día el precio ya está cerrado y avisar sería
      // ruido.
      if (persona.modalidad !== "tiempo") continue;

      const minutos = minutosEntre(persona.entrada, ahora);
      const vistas = new Set(persona.alarmasVistas);

      // Solo el umbral más alto ya alcanzado, para no soltar cinco
      // notificaciones de golpe tras una suspensión larga.
      const alcanzado = Math.floor(minutos / intervalo) * intervalo;
      if (alcanzado >= intervalo && !vistas.has(alcanzado)) {
        const horasCobradas = Math.ceil(minutos / 60);
        avisos.push({
          cuentaId: cuenta.id,
          personaId: persona.id,
          codigo: alcanzado,
          titulo: `${formatoDuracion(alcanzado)} · ${persona.nombre}`,
          cuerpo:
            `${cuenta.nombre} — lleva ${formatoDuracion(minutos)}. ` +
            `Van ${horasCobradas} h de ${paquete.nombre}: $${horasCobradas * paquete.precioHora}.`,
        });
      }
    }
  }

  if (ajustes.avisarCierre && genteAdentro > 0) {
    const negocio = estadoNegocio(ajustes.horarios, ahora);
    if (negocio.paraCerrar !== null) {
      // El más urgente que ya se alcanzó (15 antes que 30).
      const tocado = AVISOS_CIERRE.filter((a) => negocio.paraCerrar! <= a.minutos).pop();
      if (tocado && !cierresVistos.includes(claveCierre(tocado.codigo, ahora))) {
        avisos.push({
          cuentaId: "",
          personaId: NEGOCIO,
          codigo: tocado.codigo,
          titulo: `Cierra en ${Math.round(negocio.paraCerrar)} min`,
          cuerpo: `Todavía hay ${genteAdentro} ${genteAdentro === 1 ? "persona" : "personas"} adentro.`,
        });
      }
    }
  }

  return avisos;
}

let permisoConcedido: boolean | null = null;

/** Pide permiso de notificaciones una sola vez por sesión. */
export async function prepararNotificaciones(): Promise<boolean> {
  if (permisoConcedido !== null) return permisoConcedido;

  if (!enTauri()) {
    if (typeof Notification === "undefined") return (permisoConcedido = false);
    if (Notification.permission === "granted") return (permisoConcedido = true);
    const r = await Notification.requestPermission();
    return (permisoConcedido = r === "granted");
  }

  try {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    return (permisoConcedido = ok);
  } catch (e) {
    console.error("[alarmas] no hay notificaciones disponibles:", e);
    return (permisoConcedido = false);
  }
}

export async function notificar(titulo: string, cuerpo: string): Promise<void> {
  const ok = await prepararNotificaciones();
  if (!ok) return;

  if (!enTauri()) {
    new Notification(titulo, { body: cuerpo });
    return;
  }
  const { sendNotification } = await import("@tauri-apps/plugin-notification");
  sendNotification({ title: titulo, body: cuerpo });
}
