import { describe, expect, it } from "vitest";
import { formatoCronometro, formatoDuracion, horaTextoAISO, minutosEntre } from "../tiempo";

describe("formatos", () => {
  it("duración legible", () => {
    expect(formatoDuracion(0)).toBe("0m");
    expect(formatoDuracion(45)).toBe("45m");
    expect(formatoDuracion(80)).toBe("1h 20m");
    expect(formatoDuracion(125.9)).toBe("2h 05m");
  });

  it("cronómetro con segundos", () => {
    expect(formatoCronometro(0)).toBe("00:00");
    expect(formatoCronometro(1.5)).toBe("01:30");
    expect(formatoCronometro(61)).toBe("1:01:00");
  });

  it("minutos entre dos marcas", () => {
    expect(minutosEntre("2026-09-09T10:23:00", "2026-09-09T11:43:00")).toBe(80);
  });
});

describe("corregir la hora de entrada a mano", () => {
  const base = new Date("2026-09-09T14:00:00");

  it("acepta 24 horas", () => {
    const iso = horaTextoAISO("10:23", base)!;
    expect(new Date(iso).getHours()).toBe(10);
    expect(new Date(iso).getMinutes()).toBe(23);
  });

  it("acepta am/pm", () => {
    expect(new Date(horaTextoAISO("1:30 pm", base)!).getHours()).toBe(13);
    expect(new Date(horaTextoAISO("12:15 am", base)!).getHours()).toBe(0);
  });

  it("una hora que todavía no llega se entiende como de ayer", () => {
    const iso = horaTextoAISO("23:30", base)!;
    expect(new Date(iso).getDate()).toBe(8);
  });

  it("rechaza lo que no es una hora", () => {
    expect(horaTextoAISO("mañana")).toBeNull();
    expect(horaTextoAISO("25:00")).toBeNull();
    expect(horaTextoAISO("10:75")).toBeNull();
  });
});
