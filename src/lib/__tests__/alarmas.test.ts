import { describe, expect, it } from "vitest";
import { AVISO_CIERRE_15, AVISO_CIERRE_30, avisosPendientes, NEGOCIO } from "../alarmas";
import { AJUSTES_INICIALES, PAQUETES_INICIALES } from "../defaults";
import type { Cuenta, Modalidad } from "../../tipos";

const [BLACK] = PAQUETES_INICIALES;
const ajustes = { ...AJUSTES_INICIALES, intervaloAlarmaMin: 60 };

// Lunes 7 de septiembre de 2026 a la 1 de la tarde: bien lejos del cierre.
const BASE = new Date("2026-09-07T13:00:00").getTime();
const mas = (min: number) => BASE + min * 60_000;

function cuentaCon(
  opciones: {
    alarmasVistas?: number[];
    salida?: string | null;
    modalidad?: Modalidad;
    cerradaEn?: string | null;
    entrada?: number;
  } = {},
): Cuenta {
  return {
    id: "c1",
    numero: 1,
    nombre: "Cuenta 1",
    paqueteId: BLACK.id,
    personas: [
      {
        id: "p1",
        nombre: "Ana",
        entrada: new Date(opciones.entrada ?? BASE).toISOString(),
        salida: opciones.salida ?? null,
        modalidad: opciones.modalidad ?? "tiempo",
        estudiante: false,
        alarmasVistas: opciones.alarmasVistas ?? [],
      },
    ],
    notas: "",
    abiertaEn: new Date(BASE).toISOString(),
    cerradaEn: opciones.cerradaEn ?? null,
    totalCobrado: null,
    metodoPago: null,
  };
}

const revisar = (cuenta: Cuenta, ahora: number, aj = ajustes) =>
  avisosPendientes([cuenta], PAQUETES_INICIALES, aj, ahora);

describe("recordatorio de tiempo", () => {
  it("no avisa nada antes del primer umbral", () => {
    expect(revisar(cuentaCon(), mas(30))).toHaveLength(0);
  });

  it("avisa al cumplir el intervalo, con lo que lleva acumulado", () => {
    const avisos = revisar(cuentaCon(), mas(61));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].codigo).toBe(60);
    // 61 min ya son 2 horas de Black.
    expect(avisos[0].cuerpo).toContain("$118");
  });

  it("no repite un aviso ya dado", () => {
    expect(revisar(cuentaCon({ alarmasVistas: [60] }), mas(75))).toHaveLength(0);
  });

  it("tras una suspensión larga manda un solo aviso, no la ristra completa", () => {
    const avisos = revisar(cuentaCon(), mas(310));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].codigo).toBe(300);
  });

  it("a quien ya se fue no se le avisa", () => {
    const salida = new Date(mas(30)).toISOString();
    expect(revisar(cuentaCon({ salida }), mas(400))).toHaveLength(0);
  });

  it("una cuenta cerrada no genera avisos", () => {
    const cerradaEn = new Date(mas(20)).toISOString();
    expect(revisar(cuentaCon({ cerradaEn }), mas(400))).toHaveLength(0);
  });

  it("con pase de día no se avisa: el precio ya está cerrado", () => {
    expect(revisar(cuentaCon({ modalidad: "dia" }), mas(310))).toHaveLength(0);
    expect(revisar(cuentaCon({ modalidad: "all_access" }), mas(310))).toHaveLength(0);
  });
});

describe("aviso de cierre", () => {
  const casi = (hora: string) => new Date(`2026-09-07T${hora}:00`).getTime();

  it("avisa a media hora del cierre si queda gente", () => {
    // Lunes cierra 21:30.
    const avisos = revisar(cuentaCon({ alarmasVistas: [60, 120, 180, 240, 300, 360, 420, 480] }), casi("21:05"));
    const cierre = avisos.filter((a) => a.personaId === NEGOCIO);
    expect(cierre).toHaveLength(1);
    expect(cierre[0].codigo).toBe(AVISO_CIERRE_30);
  });

  it("a menos de 15 sube al aviso urgente", () => {
    const avisos = revisar(cuentaCon({ alarmasVistas: [60, 120, 180, 240, 300, 360, 420, 480] }), casi("21:20"));
    const cierre = avisos.filter((a) => a.personaId === NEGOCIO);
    expect(cierre).toHaveLength(1);
    expect(cierre[0].codigo).toBe(AVISO_CIERRE_15);
  });

  it("sin gente adentro no molesta", () => {
    const salida = new Date(casi("20:00")).toISOString();
    const avisos = revisar(cuentaCon({ salida }), casi("21:20"));
    expect(avisos.filter((a) => a.personaId === NEGOCIO)).toHaveLength(0);
  });

  it("se puede apagar", () => {
    const avisos = revisar(
      cuentaCon({ alarmasVistas: [60, 120, 180, 240, 300, 360, 420, 480] }),
      casi("21:20"),
      { ...ajustes, avisarCierre: false },
    );
    expect(avisos.filter((a) => a.personaId === NEGOCIO)).toHaveLength(0);
  });

  it("lejos del cierre no dice nada", () => {
    expect(revisar(cuentaCon(), mas(30)).filter((a) => a.personaId === NEGOCIO)).toHaveLength(0);
  });
});
