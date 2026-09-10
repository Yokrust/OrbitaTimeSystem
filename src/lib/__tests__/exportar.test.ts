import { describe, expect, it } from "vitest";
import { generarCSV } from "../exportar";
import { estadoVacio, PAQUETES_INICIALES } from "../defaults";
import type { Cuenta, EstadoDia, Modalidad } from "../../tipos";

const [BLACK, , GOLD] = PAQUETES_INICIALES;

// Lunes 7 de septiembre de 2026 a las 9 a.m.: dentro de la happy hour.
const BASE = new Date("2026-09-07T09:00:00").getTime();
const iso = (min: number) => new Date(BASE + min * 60_000).toISOString();

function persona(
  id: string,
  nombre: string,
  entrada: number,
  salida: number | null,
  modalidad: Modalidad = "tiempo",
  estudiante = false,
) {
  return {
    id,
    nombre,
    entrada: iso(entrada),
    salida: salida === null ? null : iso(salida),
    modalidad,
    estudiante,
    alarmasVistas: [] as number[],
  };
}

function estadoDePrueba(): EstadoDia {
  const base = estadoVacio("2026-09-07");
  const cuentas: Cuenta[] = [
    {
      id: "c1",
      numero: 1,
      nombre: "Cuenta 1",
      paqueteId: GOLD.id,
      personas: [
        persona("p1", "Ana", 0, 80, "all_access"),
        persona("p2", "Luis, el de siempre", 60, null, "tiempo", true),
      ],
      notas: 'Pidió "el de siempre"',
      abiertaEn: iso(0),
      cerradaEn: null,
      totalCobrado: null,
      metodoPago: null,
    },
    {
      id: "c2",
      numero: 2,
      nombre: "Cuenta 2",
      paqueteId: BLACK.id,
      personas: [persona("p3", "Sofi", 30, 90, "dia")],
      notas: "",
      abiertaEn: iso(30),
      cerradaEn: iso(90),
      totalCobrado: 180,
      metodoPago: "tarjeta",
    },
  ];
  return { ...base, cuentas };
}

describe("reporte del día en CSV", () => {
  const csv = generarCSV(estadoDePrueba(), BASE + 120 * 60_000);
  const lineas = csv.split("\r\n");

  it("abre con el resumen del día", () => {
    expect(lineas[0]).toBe("ORBTIME — Reporte del día");
    expect(csv).toContain("Fecha operativa,2026-09-07");
    expect(csv).toContain("Personas atendidas,3");
  });

  it("desglosa por modalidad", () => {
    expect(csv).toContain("Por modalidad,Personas,Importe calculado");
    expect(csv).toContain("Por tiempo,1,81.00");
    expect(csv).toContain("Día,1,180.00");
    expect(csv).toContain("All access,1,240.00");
  });

  it("desglosa los descuentos aplicados", () => {
    expect(csv).toContain("Happy hour,1,90.00"); // Gold all access: 330 -> 240
    expect(csv).toContain("Estudiante,1,9.00"); // 1 h de Gold: 90 -> 81
  });

  it("trae una fila por persona con su modalidad", () => {
    expect(csv).toContain("Ana,All access");
    expect(csv).toContain("adentro");
    expect(csv).toContain("salió");
  });

  it("escapa comas y comillas para que no se desalineen las columnas", () => {
    expect(csv).toContain('"Luis, el de siempre"');
    expect(csv).toContain('"Pidió ""el de siempre"""');
  });

  it("todas las filas de detalle tienen el mismo número de columnas", () => {
    const encabezado = lineas.findIndex((l) => l.startsWith("Cuenta,Paquete,Persona"));
    expect(encabezado).toBeGreaterThan(0);
    const columnas = contarColumnas(lineas[encabezado]);
    for (const linea of lineas.slice(encabezado + 1).filter(Boolean)) {
      expect(contarColumnas(linea)).toBe(columnas);
    }
  });

  it("un día sin movimiento no truena", () => {
    expect(() => generarCSV(estadoVacio("2026-09-07"))).not.toThrow();
  });
});

describe("los totales del reporte concuerdan entre sí", () => {
  it("el total del día es el mismo por paquete y por método de pago", () => {
    const csv = generarCSV(estadoDePrueba(), BASE + 120 * 60_000);
    const total = Number(csv.match(/Total del día,([\d.]+)/)![1]);
    const porPaquete = [...csv.matchAll(/^(Black|Blue|Gold),\d+,\d+,[\d.]+,([\d.]+)$/gm)];
    const porMetodo = [...csv.matchAll(/^(efectivo|tarjeta|transferencia|sin cobrar),\d+,([\d.]+)$/gm)];

    expect(porPaquete.length).toBe(2);
    expect(porMetodo.length).toBe(2);
    expect(suma(porPaquete)).toBeCloseTo(total, 2);
    expect(suma(porMetodo)).toBeCloseTo(total, 2);
    // El importe congelado de la cuenta cobrada se respeta.
    expect(csv).toContain("tarjeta,1,180.00");
  });
});

/** Cuenta comas que no van dentro de comillas. */
function contarColumnas(linea: string): number {
  let n = 1;
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') dentro = !dentro;
    else if (c === "," && !dentro) n++;
  }
  return n;
}

const suma = (m: RegExpMatchArray[]) => m.reduce((a, x) => a + Number(x[2]), 0);
