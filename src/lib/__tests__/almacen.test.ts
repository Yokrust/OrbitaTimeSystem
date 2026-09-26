import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cargarEstado } from "../almacen";
import { AVISO_CIERRE_30, claveCierre, NEGOCIO } from "../alarmas";
import { reducir, siguienteNumero } from "../../estado/acciones";

// Un día guardado por la v0.1 (9-sep-2026): ya decía `version: 2`, pero no
// traía ultimoNumero ni avisosCierre, y todavía se cobraba por transferencia.
const DIA_V01 = {
  fecha: "2026-09-09",
  cuentas: [
    {
      id: "c3",
      numero: 3,
      nombre: "Cuenta 3",
      paqueteId: "blue",
      personas: [
        {
          id: "p3",
          nombre: "Ana",
          entrada: "2026-09-09T18:00:00.000Z",
          salida: null,
          modalidad: "tiempo",
          estudiante: false,
          alarmasVistas: [],
        },
      ],
      notas: "",
      abiertaEn: "2026-09-09T18:00:00.000Z",
      cerradaEn: null,
      totalCobrado: null,
      metodoPago: null,
    },
    {
      id: "c1",
      numero: 1,
      nombre: "Cuenta 1",
      paqueteId: "black",
      personas: [],
      notas: "",
      abiertaEn: "2026-09-09T16:00:00.000Z",
      cerradaEn: "2026-09-09T17:00:00.000Z",
      totalCobrado: 59,
      metodoPago: "transferencia",
    },
  ],
  paquetes: [
    { id: "black", nombre: "Black", color: "#8b93a7", precioHora: 59, precioDia: 180, precioAllAccess: 200, precioHappyHour: null },
    { id: "blue", nombre: "Blue", color: "#4ea1ff", precioHora: 75, precioDia: 240, precioAllAccess: 280, precioHappyHour: null },
    { id: "gold", nombre: "Gold", color: "#ffb03a", precioHora: 90, precioDia: 290, precioAllAccess: 330, precioHappyHour: 240 },
  ],
  ajustes: { intervaloAlarmaMin: 60, avisarCierre: true, cerrarAMenuBar: true, descuentoEstudiante: 10, moneda: "MXN" },
  version: 2,
};

// Fuera de Tauri, el almacén lee de localStorage.
let guardado: string | null = null;
beforeEach(() => {
  guardado = JSON.stringify(DIA_V01);
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => guardado,
    setItem: (_: string, valor: string) => (guardado = valor),
  };
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("un día guardado por la v0.1", () => {
  it("se carga con la numeración y los avisos de cierre en cero", async () => {
    const estado = await cargarEstado();
    expect(estado.ultimoNumero).toBe(0);
    expect(estado.avisosCierre).toEqual([]);
  });

  it("la siguiente cuenta sigue después de la más alta, no es NaN", async () => {
    const estado = await cargarEstado();
    expect(siguienteNumero(estado)).toBe(4);
    const despues = reducir(estado, {
      tipo: "abrirCuenta",
      paqueteId: "gold",
      nombresPersonas: ["Luis"],
      modalidad: "tiempo",
    });
    expect(despues.cuentas[0].nombre).toBe("Cuenta 4");
    expect(despues.ultimoNumero).toBe(4);
  });

  it("puede marcar un aviso de cierre", async () => {
    const estado = await cargarEstado();
    const aviso = { cuentaId: "", personaId: NEGOCIO, codigo: AVISO_CIERRE_30, titulo: "", cuerpo: "" };
    const despues = reducir(estado, { tipo: "marcarAvisos", avisos: [aviso] });
    expect(despues.avisosCierre).toEqual([claveCierre(AVISO_CIERRE_30)]);
  });

  it("conserva la transferencia con que se cobró", async () => {
    const estado = await cargarEstado();
    expect(estado.cuentas.find((c) => c.id === "c1")?.metodoPago).toBe("transferencia");
  });
});
