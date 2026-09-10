import { describe, expect, it } from "vitest";
import { cobrarCuenta, cobrarPersona, preciosDe } from "../cobro";
import { AJUSTES_INICIALES, PAQUETES_INICIALES } from "../defaults";
import type { Cuenta, Modalidad, Persona } from "../../tipos";

const [BLACK, BLUE, GOLD] = PAQUETES_INICIALES;
const ajustes = AJUSTES_INICIALES;

// Septiembre 2026: 07 lunes, 11 viernes, 12 sábado, 06 domingo.
const cuando = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00`).getTime();

function persona(
  entrada: number,
  salida: number | null,
  modalidad: Modalidad = "tiempo",
  estudiante = false,
): Persona {
  return {
    id: "p1",
    nombre: "Ana",
    entrada: new Date(entrada).toISOString(),
    salida: salida === null ? null : new Date(salida).toISOString(),
    modalidad,
    estudiante,
    alarmasVistas: [],
  };
}

/** Un lunes cualquiera, fuera de la happy hour. */
const DIA = cuando("2026-09-07", "13:00");
const mas = (minutos: number) => DIA + minutos * 60_000;

describe("por tiempo — se cobra la hora empezada", () => {
  it("el caso del enunciado: 10:23 a 11:43 son 80 min = 2 horas", () => {
    const p = persona(cuando("2026-09-07", "10:23"), cuando("2026-09-07", "11:43"));
    const c = cobrarPersona(p, BLACK, ajustes);
    expect(c.minutosBrutos).toBe(80);
    expect(c.horasFacturadas).toBe(2);
    expect(c.importe).toBe(118); // 2 × 59
  });

  it("una hora clavada es una hora", () => {
    expect(cobrarPersona(persona(DIA, mas(60)), BLACK, ajustes).importe).toBe(59);
  });

  it("un minuto de más ya es la segunda hora", () => {
    expect(cobrarPersona(persona(DIA, mas(61)), BLACK, ajustes).importe).toBe(118);
  });

  it("cada paquete con su tarifa", () => {
    expect(cobrarPersona(persona(DIA, mas(90)), BLACK, ajustes).importe).toBe(118);
    expect(cobrarPersona(persona(DIA, mas(90)), BLUE, ajustes).importe).toBe(150);
    expect(cobrarPersona(persona(DIA, mas(90)), GOLD, ajustes).importe).toBe(180);
  });

  it("quien acaba de entrar todavía no debe nada", () => {
    expect(cobrarPersona(persona(DIA, DIA), BLACK, ajustes).importe).toBe(0);
  });

  it("a quien sigue adentro se le cuenta hasta ahorita", () => {
    const c = cobrarPersona(persona(DIA, null), BLACK, ajustes, mas(125));
    expect(c.activa).toBe(true);
    expect(c.horasFacturadas).toBe(3);
    expect(c.importe).toBe(177);
  });

  it("una hora de entrada en el futuro no genera minutos negativos", () => {
    const c = cobrarPersona(persona(mas(30), null), BLACK, ajustes, DIA);
    expect(c.minutosBrutos).toBe(0);
    expect(c.importe).toBe(0);
  });
});

describe("pases de día", () => {
  it("el día cuesta lo mismo sin importar cuánto se queden", () => {
    for (const minutos of [10, 300, 700]) {
      expect(cobrarPersona(persona(DIA, mas(minutos), "dia"), BLACK, ajustes).importe).toBe(180);
      expect(cobrarPersona(persona(DIA, mas(minutos), "dia"), BLUE, ajustes).importe).toBe(240);
      expect(cobrarPersona(persona(DIA, mas(minutos), "dia"), GOLD, ajustes).importe).toBe(290);
    }
  });

  it("all access fuera de la happy hour", () => {
    expect(cobrarPersona(persona(DIA, mas(120), "all_access"), BLACK, ajustes).importe).toBe(200);
    expect(cobrarPersona(persona(DIA, mas(120), "all_access"), BLUE, ajustes).importe).toBe(280);
    expect(cobrarPersona(persona(DIA, mas(120), "all_access"), GOLD, ajustes).importe).toBe(330);
  });
});

describe("happy hour", () => {
  const enVentana = cuando("2026-09-07", "09:00"); // lunes 9 a.m.

  it("el all access de Gold baja a 240", () => {
    const c = cobrarPersona(persona(enVentana, null, "all_access"), GOLD, ajustes, enVentana);
    expect(c.importe).toBe(240);
    expect(c.descuento).toBe("happy_hour");
    expect(c.ahorro).toBe(90);
  });

  it("solo Gold: Black y Blue cobran igual", () => {
    expect(
      cobrarPersona(persona(enVentana, null, "all_access"), BLACK, ajustes, enVentana).importe,
    ).toBe(200);
    expect(
      cobrarPersona(persona(enVentana, null, "all_access"), BLUE, ajustes, enVentana).importe,
    ).toBe(280);
  });

  it("solo all access: el día y el tiempo de Gold no cambian", () => {
    expect(
      cobrarPersona(persona(enVentana, null, "dia"), GOLD, ajustes, enVentana).importe,
    ).toBe(290);
    expect(
      cobrarPersona(persona(enVentana, mas(0), "tiempo"), GOLD, ajustes, enVentana).descuento,
    ).toBe("ninguno");
  });

  it("manda la hora de ENTRADA, no la de cobro", () => {
    // Entra a las 9 (en ventana) y se le cobra a las 15:00, ya fuera.
    const p = persona(enVentana, cuando("2026-09-07", "15:00"), "all_access");
    expect(cobrarPersona(p, GOLD, ajustes).importe).toBe(240);

    // Al revés: entra fuera de ventana, paga completo aunque cobre a las 10.
    const q = persona(cuando("2026-09-07", "07:00"), null, "all_access");
    expect(cobrarPersona(q, GOLD, ajustes, enVentana).importe).toBe(330);
  });
});

describe("descuento de estudiante", () => {
  it("10% sobre el tiempo", () => {
    const c = cobrarPersona(persona(DIA, mas(60), "tiempo", true), BLACK, ajustes);
    expect(c.importeBase).toBe(59);
    expect(c.importe).toBe(53.1);
    expect(c.descuento).toBe("estudiante");
  });

  it("10% sobre el pase de día", () => {
    expect(cobrarPersona(persona(DIA, null, "dia", true), GOLD, ajustes).importe).toBe(261);
  });

  it("10% sobre el all access fuera de la happy hour", () => {
    expect(cobrarPersona(persona(DIA, null, "all_access", true), GOLD, ajustes).importe).toBe(297);
  });

  it("NO se acumula con la happy hour: manda el precio de happy hour", () => {
    const enVentana = cuando("2026-09-11", "11:30"); // viernes, segunda ventana
    const c = cobrarPersona(persona(enVentana, null, "all_access", true), GOLD, ajustes, enVentana);
    expect(c.importe).toBe(240);
    expect(c.descuento).toBe("happy_hour");
  });

  it("no descuenta nada de un importe en cero", () => {
    const c = cobrarPersona(persona(DIA, DIA, "tiempo", true), BLACK, ajustes);
    expect(c.importe).toBe(0);
    expect(c.descuento).toBe("ninguno");
  });
});

describe("cuenta con varias personas", () => {
  it("suma modalidades mezcladas y descuentos distintos", () => {
    const entrada = cuando("2026-09-12", "10:30"); // sábado, en happy hour
    const cuenta: Cuenta = {
      id: "c1",
      numero: 1,
      nombre: "Cuenta 1",
      paqueteId: GOLD.id,
      personas: [
        { ...persona(entrada, null, "all_access"), id: "a", nombre: "Ana" },
        { ...persona(entrada, null, "dia", true), id: "b", nombre: "Beto" },
        // Llega una hora después y paga por tiempo.
        { ...persona(entrada + 60 * 60_000, null, "tiempo"), id: "c", nombre: "Cami" },
      ],
      notas: "",
      abiertaEn: new Date(entrada).toISOString(),
      cerradaEn: null,
      totalCobrado: null,
      metodoPago: null,
    };

    const cobro = cobrarCuenta(cuenta, PAQUETES_INICIALES, ajustes, entrada + 130 * 60_000);

    expect(cobro.personas.map((p) => p.importe)).toEqual([
      240, // all access Gold en happy hour
      261, // día Gold con 10% de estudiante
      180, // 70 min por tiempo -> 2 horas × 90
    ]);
    expect(cobro.total).toBe(681);
    expect(cobro.subtotal).toBe(330 + 290 + 180);
    expect(cobro.ahorro).toBe(90 + 29);
    expect(cobro.personasActivas).toBe(3);
  });

  it("si el paquete ya no existe usa el primero en vez de reventar", () => {
    const cuenta: Cuenta = {
      id: "c2",
      numero: 9,
      nombre: "Huérfana",
      paqueteId: "paquete-borrado",
      personas: [persona(DIA, mas(60))],
      notas: "",
      abiertaEn: new Date(DIA).toISOString(),
      cerradaEn: null,
      totalCobrado: null,
      metodoPago: null,
    };
    const cobro = cobrarCuenta(cuenta, PAQUETES_INICIALES, ajustes, mas(60));
    expect(cobro.paquete.id).toBe(BLACK.id);
    expect(cobro.total).toBe(59);
  });
});

describe("precios de referencia para la barra", () => {
  it("marca la happy hour cuando toca", () => {
    const p = preciosDe(GOLD, ajustes, cuando("2026-09-11", "10:30"));
    expect(p).toEqual({ tiempo: 90, dia: 290, all_access: 240, hayHappyHour: true });
  });

  it("fuera de ventana enseña el precio de lista", () => {
    const p = preciosDe(GOLD, ajustes, cuando("2026-09-11", "16:00"));
    expect(p).toEqual({ tiempo: 90, dia: 290, all_access: 330, hayHappyHour: false });
  });
});
