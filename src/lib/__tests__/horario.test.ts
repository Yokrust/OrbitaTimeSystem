import { describe, expect, it } from "vitest";
import { aMinutos, aTextoHora, enHappyHour, estadoNegocio } from "../horario";
import { AJUSTES_INICIALES } from "../defaults";

const { horarios, happyHour } = AJUSTES_INICIALES;

// En septiembre de 2026: 06 domingo, 07 lunes … 11 viernes, 12 sábado.
const cuando = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00`).getTime();

describe("conversión de horas", () => {
  it("lee HH:MM", () => {
    expect(aMinutos("08:30")).toBe(510);
    expect(aMinutos("00:00")).toBe(0);
    expect(aMinutos("21:30")).toBe(1290);
  });

  it("rechaza basura", () => {
    expect(aMinutos("25:00")).toBeNull();
    expect(aMinutos("8:70")).toBeNull();
    expect(aMinutos("mañana")).toBeNull();
  });

  it("escribe la hora como se lee en la puerta", () => {
    expect(aTextoHora(510)).toBe("8:30 a.m.");
    expect(aTextoHora(1290)).toBe("9:30 p.m.");
    expect(aTextoHora(720)).toBe("12:00 p.m.");
    expect(aTextoHora(0)).toBe("12:00 a.m.");
  });
});

describe("horario del negocio", () => {
  it("entre semana abre 8:30 y cierra 21:30", () => {
    expect(estadoNegocio(horarios, cuando("2026-09-07", "08:29")).abierto).toBe(false);
    expect(estadoNegocio(horarios, cuando("2026-09-07", "08:30")).abierto).toBe(true);
    expect(estadoNegocio(horarios, cuando("2026-09-07", "21:29")).abierto).toBe(true);
    expect(estadoNegocio(horarios, cuando("2026-09-07", "21:30")).abierto).toBe(false);
  });

  it("el sábado abre hasta las 10 y cierra a las 9", () => {
    expect(estadoNegocio(horarios, cuando("2026-09-12", "09:30")).abierto).toBe(false);
    expect(estadoNegocio(horarios, cuando("2026-09-12", "10:00")).abierto).toBe(true);
    expect(estadoNegocio(horarios, cuando("2026-09-12", "21:00")).abierto).toBe(false);
  });

  it("el domingo abre hasta el mediodía", () => {
    expect(estadoNegocio(horarios, cuando("2026-09-06", "11:00")).abierto).toBe(false);
    expect(estadoNegocio(horarios, cuando("2026-09-06", "12:00")).abierto).toBe(true);
  });

  it("dice cuánto falta para cerrar", () => {
    const e = estadoNegocio(horarios, cuando("2026-09-07", "21:00"));
    expect(e.paraCerrar).toBe(30);
    expect(e.texto).toBe("Cierra 9:30 p.m.");
  });

  it("antes de abrir dice a qué hora abre hoy", () => {
    const e = estadoNegocio(horarios, cuando("2026-09-12", "08:00"));
    expect(e.paraAbrir).toBe(120);
    expect(e.texto).toBe("Abre 10:00 a.m.");
  });

  it("ya cerrado apunta al día siguiente", () => {
    // Viernes en la noche -> el sábado abre a las 10.
    const e = estadoNegocio(horarios, cuando("2026-09-11", "22:00"));
    expect(e.abierto).toBe(false);
    expect(e.texto).toBe("Abre mañana 10:00 a.m.");
    expect(e.paraAbrir).toBe(12 * 60);
  });
});

describe("happy hour", () => {
  it("entre semana es de 8:30 a 11", () => {
    expect(enHappyHour(happyHour, cuando("2026-09-07", "08:30"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-07", "10:59"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-07", "11:00"))).toBe(false);
    expect(enHappyHour(happyHour, cuando("2026-09-07", "08:29"))).toBe(false);
  });

  it("el viernes tiene las dos ventanas", () => {
    expect(enHappyHour(happyHour, cuando("2026-09-11", "09:00"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-11", "11:30"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-11", "12:00"))).toBe(false);
  });

  it("el sábado solo de 10 a 12", () => {
    expect(enHappyHour(happyHour, cuando("2026-09-12", "09:00"))).toBe(false);
    expect(enHappyHour(happyHour, cuando("2026-09-12", "10:00"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-12", "11:59"))).toBe(true);
    expect(enHappyHour(happyHour, cuando("2026-09-12", "12:00"))).toBe(false);
  });

  it("el domingo no hay", () => {
    expect(enHappyHour(happyHour, cuando("2026-09-06", "10:00"))).toBe(false);
    expect(enHappyHour(happyHour, cuando("2026-09-06", "13:00"))).toBe(false);
  });
});
