import type { Ajustes, EstadoDia, Horario, Paquete, VentanaHappyHour } from "../tipos";
import { fechaOperativa } from "./tiempo";

export const VERSION_ESTADO = 2;

/** Los tres paquetes, del más barato al más caro. */
export const PAQUETES_INICIALES: Paquete[] = [
  {
    id: "black",
    nombre: "Black",
    color: "#8b93a7",
    precioHora: 59,
    precioDia: 180,
    precioAllAccess: 200,
    precioHappyHour: null,
  },
  {
    id: "blue",
    nombre: "Blue",
    color: "#4ea1ff",
    precioHora: 75,
    precioDia: 240,
    precioAllAccess: 280,
    precioHappyHour: null,
  },
  {
    id: "gold",
    nombre: "Gold",
    color: "#ffb03a",
    precioHora: 90,
    precioDia: 290,
    precioAllAccess: 330,
    // Único paquete con happy hour, y solo sobre el all access.
    precioHappyHour: 240,
  },
];

/** Lunes a viernes 8:30–21:30, sábado 10:00–21:00, domingo 12:00–21:00. */
export const HORARIOS_INICIALES: Horario[] = [
  { dia: 0, abre: "12:00", cierra: "21:00" },
  { dia: 1, abre: "08:30", cierra: "21:30" },
  { dia: 2, abre: "08:30", cierra: "21:30" },
  { dia: 3, abre: "08:30", cierra: "21:30" },
  { dia: 4, abre: "08:30", cierra: "21:30" },
  { dia: 5, abre: "08:30", cierra: "21:30" },
  { dia: 6, abre: "10:00", cierra: "21:00" },
];

/**
 * Happy hour del all access Gold.
 * De lunes a viernes por la mañana, y una segunda ventana los viernes y
 * sábados de 10 a 12 (por eso el viernes aparece en las dos).
 */
export const HAPPY_HOUR_INICIAL: VentanaHappyHour[] = [
  { dias: [1, 2, 3, 4, 5], desde: "08:30", hasta: "11:00" },
  { dias: [5, 6], desde: "10:00", hasta: "12:00" },
];

export const AJUSTES_INICIALES: Ajustes = {
  intervaloAlarmaMin: 60,
  avisarCierre: true,
  cerrarAMenuBar: true,
  descuentoEstudiante: 10,
  horarios: HORARIOS_INICIALES.map((h) => ({ ...h })),
  happyHour: HAPPY_HOUR_INICIAL.map((v) => ({ ...v, dias: [...v.dias] })),
  moneda: "MXN",
};

export function estadoVacio(fecha = fechaOperativa()): EstadoDia {
  return {
    fecha,
    cuentas: [],
    paquetes: PAQUETES_INICIALES.map((p) => ({ ...p })),
    ajustes: {
      ...AJUSTES_INICIALES,
      horarios: HORARIOS_INICIALES.map((h) => ({ ...h })),
      happyHour: HAPPY_HOUR_INICIAL.map((v) => ({ ...v, dias: [...v.dias] })),
    },
    version: VERSION_ESTADO,
  };
}

/** id corto y legible, suficiente para una caja de un solo local. */
export function nuevoId(prefijo: string): string {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}${azar}`;
}
