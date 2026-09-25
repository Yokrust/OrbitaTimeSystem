import type {
  Ajustes,
  CobroCuenta,
  CobroPersona,
  Cuenta,
  Paquete,
  Persona,
  TipoDescuento,
} from "../tipos";
import { enHappyHour } from "./horario";
import { minutosEntre } from "./tiempo";

/**
 * Bloque de cobro de la modalidad por tiempo, en minutos.
 *
 * Hoy la hora empezada se cobra completa: 40 min de Black son $59, y 1h 10m
 * son $118. Cuando definan el prorrateo (medias horas, cuartos), basta cambiar
 * este número: 30 cobraría por medias horas, 15 por cuartos, 1 al minuto.
 */
export const BLOQUE_MINUTOS = 60;

/**
 * Cobro de UNA persona.
 *
 * Tres modalidades:
 *   tiempo      -> tarifa por hora, cobrando la hora empezada
 *   dia         -> pase de día, precio fijo
 *   all_access  -> pase all access, precio fijo (con happy hour si toca)
 *
 * Los descuentos NUNCA se acumulan: si entró en happy hour manda ese precio y
 * el 10% de estudiante ya no se aplica encima.
 */
export function cobrarPersona(
  persona: Persona,
  paquete: Paquete,
  ajustes: Ajustes,
  ahora: number = Date.now(),
): CobroPersona {
  const fin = persona.salida ?? ahora;
  const minutosBrutos = minutosEntre(persona.entrada, fin);

  let importeBase: number;
  let horasFacturadas = 0;
  let descuento: TipoDescuento = "ninguno";
  let importe: number;

  if (persona.modalidad === "tiempo") {
    const bloques = Math.ceil(minutosBrutos / BLOQUE_MINUTOS);
    horasFacturadas = (bloques * BLOQUE_MINUTOS) / 60;
    importeBase = horasFacturadas * paquete.precioHora;
    importe = importeBase;
  } else if (persona.modalidad === "dia") {
    importeBase = paquete.precioDia;
    importe = importeBase;
  } else {
    importeBase = paquete.precioAllAccess;
    importe = importeBase;
    // La happy hour se juzga por la hora de ENTRADA: ahí se compró el pase.
    if (paquete.precioHappyHour !== null && enHappyHour(ajustes.happyHour, persona.entrada)) {
      importe = paquete.precioHappyHour;
      descuento = "happy_hour";
    }
  }

  if (descuento === "ninguno" && persona.estudiante && importeBase > 0) {
    importe = importeBase * (1 - ajustes.descuentoEstudiante / 100);
    descuento = "estudiante";
  }

  importe = redondearPeso(importe);
  importeBase = redondearPeso(importeBase);

  return {
    personaId: persona.id,
    nombre: persona.nombre,
    modalidad: persona.modalidad,
    minutosBrutos,
    horasFacturadas,
    importeBase,
    descuento,
    ahorro: redondearPeso(importeBase - importe),
    importe,
    activa: persona.salida === null,
  };
}

/** Cobro de la cuenta completa = suma de sus personas. */
export function cobrarCuenta(
  cuenta: Cuenta,
  paquetes: Paquete[],
  ajustes: Ajustes,
  ahora: number = Date.now(),
): CobroCuenta {
  const paquete = buscarPaquete(paquetes, cuenta.paqueteId);
  const personas = cuenta.personas.map((p) => cobrarPersona(p, paquete, ajustes, ahora));
  return {
    cuentaId: cuenta.id,
    paquete,
    personas,
    subtotal: redondearPeso(personas.reduce((a, p) => a + p.importeBase, 0)),
    ahorro: redondearPeso(personas.reduce((a, p) => a + p.ahorro, 0)),
    total: redondearPeso(personas.reduce((a, p) => a + p.importe, 0)),
    minutosTotales: personas.reduce((a, p) => a + p.minutosBrutos, 0),
    personasActivas: personas.filter((p) => p.activa).length,
  };
}

/**
 * Siempre devuelve un paquete: si el id no existe (paquete renombrado en
 * Ajustes con cuentas abiertas), cae al primero en vez de reventar la caja.
 */
export function buscarPaquete(paquetes: Paquete[], id: string): Paquete {
  return paquetes.find((p) => p.id === id) ?? paquetes[0];
}

/** Cuánto costaría cada modalidad ahora mismo. Para decidir en la barra. */
export function preciosDe(
  paquete: Paquete,
  ajustes: Ajustes,
  momento: string | number = Date.now(),
): { tiempo: number; dia: number; all_access: number; hayHappyHour: boolean } {
  const hayHappyHour =
    paquete.precioHappyHour !== null && enHappyHour(ajustes.happyHour, momento);
  return {
    tiempo: paquete.precioHora,
    dia: paquete.precioDia,
    all_access: hayHappyHour ? paquete.precioHappyHour! : paquete.precioAllAccess,
    hayHappyHour,
  };
}

/** A pesos con dos decimales, sin errores de coma flotante. */
export function redondearPeso(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatoDinero(n: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(n);
}

export const NOMBRE_MODALIDAD: Record<Persona["modalidad"], string> = {
  tiempo: "Por tiempo",
  dia: "Día",
  all_access: "All access",
};

/** "$59" si el precio es cerrado, "$59.50" si trae centavos. Para precios de lista. */
export function formatoPrecio(n: number, moneda = "MXN"): string {
  const cerrado = Number.isInteger(n);
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: cerrado ? 0 : 2,
    maximumFractionDigits: cerrado ? 0 : 2,
  }).format(n);
}

/** Para la interfaz. El reporte usa NOMBRE_MODALIDAD. */
export const NOMBRE_MODALIDAD_CORTO: Record<Persona["modalidad"], string> = {
  tiempo: "Por hora",
  dia: "Día",
  all_access: "All access",
};

export const NOMBRE_DESCUENTO: Record<TipoDescuento, string> = {
  ninguno: "",
  estudiante: "Estudiante",
  happy_hour: "Happy hour",
};
