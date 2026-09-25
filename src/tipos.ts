/**
 * Modelo de dominio de ORBTIME.
 *
 * Regla base: NUNCA guardamos contadores que "avanzan". Guardamos marcas de
 * tiempo ISO y todo lo demás se deriva. Así el conteo sigue siendo correcto
 * aunque la app se duerma, se minimice o se reinicie la Mac.
 */

/** Cómo paga una persona. Se elige al entrar y se puede cambiar en cualquier momento. */
export type Modalidad = "tiempo" | "dia" | "all_access";

/** Un paquete: Black, Blue o Gold. */
export interface Paquete {
  id: string;
  nombre: string;
  /** Color de acento (hex) para identificarlo de un vistazo. */
  color: string;
  /** Tarifa por hora. Se cobra la hora empezada. */
  precioHora: number;
  /** Pase de día completo. */
  precioDia: number;
  /** Pase de día all access. */
  precioAllAccess: number;
  /**
   * Precio del all access en happy hour. null = este paquete no tiene
   * happy hour (hoy solo la tiene Gold).
   */
  precioHappyHour: number | null;
}

/** Una persona dentro de una cuenta. Cada quien con su propio reloj. */
export interface Persona {
  id: string;
  nombre: string;
  /** ISO 8601. Momento en que se le abrió el reloj. */
  entrada: string;
  /** ISO 8601, o null si sigue adentro. */
  salida: string | null;
  modalidad: Modalidad;
  /** Descuento de estudiante (10%). Se marca al cobrar. */
  estudiante: boolean;
  /**
   * Umbrales de alarma (en minutos) que ya se avisaron para esta persona.
   * Evita notificar dos veces lo mismo tras un reinicio o un catch-up.
   */
  alarmasVistas: number[];
}

/**
 * Una cuenta es un grupo. Varias personas pueden entrar a la misma cuenta en
 * momentos distintos; cada una corre su propio tiempo y al final se suman
 * todas para el total de la cuenta.
 */
export interface Cuenta {
  id: string;
  /** Consecutivo del día: 1, 2, 3… Es lo que le da el nombre a la cuenta. */
  numero: number;
  /** "Cuenta 3" por defecto; el cajero puede reescribirlo si le sirve. */
  nombre: string;
  paqueteId: string;
  personas: Persona[];
  notas: string;
  abiertaEn: string;
  /** ISO cuando se cobró y cerró. null = sigue activa. */
  cerradaEn: string | null;
  /** Foto del cobro en el momento del cierre, para que no cambie después. */
  totalCobrado: number | null;
  metodoPago: MetodoPago | null;
}

export type MetodoPago = "efectivo" | "tarjeta";

/** Qué descuento terminó aplicándose. Nunca se acumulan. */
export type TipoDescuento = "ninguno" | "estudiante" | "happy_hour";

/** Horario de apertura de un día de la semana. */
export interface Horario {
  /** 0 = domingo … 6 = sábado */
  dia: number;
  /** "08:30" */
  abre: string;
  /** "21:30" */
  cierra: string;
}

/** Ventana en la que el all access de Gold baja de precio. */
export interface VentanaHappyHour {
  /** Días de la semana en los que aplica (0 = domingo). */
  dias: number[];
  desde: string;
  hasta: string;
}

export interface Ajustes {
  /** Cada cuántos minutos recordarle al cajero el tiempo de cada persona. */
  intervaloAlarmaMin: number;
  /** Avisar cuando falta poco para cerrar y todavía hay gente adentro. */
  avisarCierre: boolean;
  /** Al cerrar la ventana: ocultarse a la barra de menús en vez de salir. */
  cerrarAMenuBar: boolean;
  /** Descuento de estudiante, en porcentaje. */
  descuentoEstudiante: number;
  horarios: Horario[];
  happyHour: VentanaHappyHour[];
  moneda: string;
}

/** Todo el estado del día en curso. Es lo que se guarda en disco. */
export interface EstadoDia {
  /** Fecha operativa en formato YYYY-MM-DD. */
  fecha: string;
  cuentas: Cuenta[];
  /** Último consecutivo repartido. No baja al borrar una cuenta. */
  ultimoNumero: number;
  /** Avisos de cierre ya dados, como "2026-09-22:-30". No cuelgan de ninguna persona. */
  avisosCierre: string[];
  paquetes: Paquete[];
  ajustes: Ajustes;
  /** Versión del formato, para migraciones futuras. */
  version: number;
}

/** Desglose de cobro de una persona. Todo derivado, nada guardado. */
export interface CobroPersona {
  personaId: string;
  nombre: string;
  modalidad: Modalidad;
  minutosBrutos: number;
  /** Horas cobradas (solo en modalidad "tiempo"). */
  horasFacturadas: number;
  /** Lo que costaría sin descuento. */
  importeBase: number;
  descuento: TipoDescuento;
  /** Cuánto se descontó, en pesos. */
  ahorro: number;
  importe: number;
  activa: boolean;
}

export interface CobroCuenta {
  cuentaId: string;
  paquete: Paquete;
  personas: CobroPersona[];
  subtotal: number;
  ahorro: number;
  total: number;
  minutosTotales: number;
  personasActivas: number;
}
