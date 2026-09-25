import type {
  Ajustes,
  Cuenta,
  EstadoDia,
  MetodoPago,
  Modalidad,
  Paquete,
  Persona,
} from "../tipos";
import { nuevoId } from "../lib/defaults";
import { fechaOperativa } from "../lib/tiempo";
import { claveCierre, NEGOCIO, type Aviso } from "../lib/alarmas";

export type Accion =
  | { tipo: "cargar"; estado: EstadoDia }
  | { tipo: "abrirCuenta"; paqueteId: string; nombresPersonas: string[]; modalidad: Modalidad }
  | { tipo: "agregarPersona"; cuentaId: string; nombre: string; modalidad?: Modalidad; entrada?: string }
  | { tipo: "marcarSalida"; cuentaId: string; personaId: string }
  | { tipo: "deshacerSalida"; cuentaId: string; personaId: string }
  | { tipo: "editarEntrada"; cuentaId: string; personaId: string; entrada: string }
  | { tipo: "renombrarPersona"; cuentaId: string; personaId: string; nombre: string }
  | { tipo: "cambiarModalidad"; cuentaId: string; personaId: string; modalidad: Modalidad }
  | { tipo: "marcarEstudiante"; cuentaId: string; personaId: string; valor: boolean }
  | { tipo: "marcarTodosEstudiantes"; cuentaId: string; valor: boolean }
  | { tipo: "quitarPersona"; cuentaId: string; personaId: string }
  | { tipo: "editarCuenta"; cuentaId: string; cambios: Partial<Pick<Cuenta, "nombre" | "paqueteId" | "notas">> }
  | { tipo: "cerrarCuenta"; cuentaId: string; metodoPago: MetodoPago; total: number }
  | { tipo: "reabrirCuenta"; cuentaId: string }
  | { tipo: "eliminarCuenta"; cuentaId: string }
  | { tipo: "marcarAvisos"; avisos: Aviso[] }
  | { tipo: "guardarAjustes"; ajustes: Ajustes }
  | { tipo: "guardarPaquetes"; paquetes: Paquete[] }
  | { tipo: "nuevoDia" };

/** Consecutivo del día. Nunca baja: borrar una cuenta no libera su número. */
export function siguienteNumero(estado: EstadoDia): number {
  return estado.cuentas.reduce((max, c) => Math.max(max, c.numero), estado.ultimoNumero) + 1;
}

export function reducir(estado: EstadoDia, accion: Accion): EstadoDia {
  switch (accion.tipo) {
    case "cargar":
      return accion.estado;

    case "abrirCuenta": {
      const ahora = new Date().toISOString();
      const personas = accion.nombresPersonas
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => crearPersona(n, ahora, accion.modalidad));
      const numero = siguienteNumero(estado);
      const cuenta: Cuenta = {
        id: nuevoId("c"),
        numero,
        nombre: `Cuenta ${numero}`,
        paqueteId: accion.paqueteId,
        personas,
        notas: "",
        abiertaEn: ahora,
        cerradaEn: null,
        totalCobrado: null,
        metodoPago: null,
      };
      return { ...estado, ultimoNumero: numero, cuentas: [cuenta, ...estado.cuentas] };
    }

    case "agregarPersona":
      return mapCuenta(estado, accion.cuentaId, (c) => ({
        ...c,
        personas: [
          ...c.personas,
          crearPersona(
            accion.nombre,
            accion.entrada ?? new Date().toISOString(),
            // Por defecto entra como el resto de la cuenta.
            accion.modalidad ?? c.personas.at(-1)?.modalidad ?? "tiempo",
          ),
        ],
      }));

    case "marcarSalida":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) =>
        p.salida ? p : { ...p, salida: new Date().toISOString() },
      );

    case "deshacerSalida":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) => ({
        ...p,
        salida: null,
      }));

    case "editarEntrada":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) => ({
        ...p,
        entrada: accion.entrada,
        // La entrada cambió: los avisos ya dados dejan de tener sentido.
        alarmasVistas: [],
      }));

    case "renombrarPersona":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) => ({
        ...p,
        nombre: accion.nombre.trim() || p.nombre,
      }));

    case "cambiarModalidad":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) => ({
        ...p,
        modalidad: accion.modalidad,
      }));

    case "marcarEstudiante":
      return mapPersona(estado, accion.cuentaId, accion.personaId, (p) => ({
        ...p,
        estudiante: accion.valor,
      }));

    case "marcarTodosEstudiantes":
      return mapCuenta(estado, accion.cuentaId, (c) => ({
        ...c,
        personas: c.personas.map((p) => ({ ...p, estudiante: accion.valor })),
      }));

    case "quitarPersona":
      return mapCuenta(estado, accion.cuentaId, (c) => ({
        ...c,
        personas: c.personas.filter((p) => p.id !== accion.personaId),
      }));

    case "editarCuenta":
      return mapCuenta(estado, accion.cuentaId, (c) => ({ ...c, ...accion.cambios }));

    case "cerrarCuenta": {
      const ahora = new Date().toISOString();
      return mapCuenta(estado, accion.cuentaId, (c) => ({
        ...c,
        // Al cobrar se le para el reloj a quien siga adentro.
        personas: c.personas.map((p) => (p.salida ? p : { ...p, salida: ahora })),
        cerradaEn: ahora,
        totalCobrado: accion.total,
        metodoPago: accion.metodoPago,
      }));
    }

    case "reabrirCuenta":
      return mapCuenta(estado, accion.cuentaId, (c) => ({
        ...c,
        cerradaEn: null,
        totalCobrado: null,
        metodoPago: null,
      }));

    case "eliminarCuenta":
      return { ...estado, cuentas: estado.cuentas.filter((c) => c.id !== accion.cuentaId) };

    case "marcarAvisos": {
      if (accion.avisos.length === 0) return estado;
      const porPersona = new Map<string, number[]>();
      const cierres: string[] = [];
      for (const a of accion.avisos) {
        if (a.personaId === NEGOCIO) {
          cierres.push(claveCierre(a.codigo));
          continue;
        }
        const previos = porPersona.get(a.personaId) ?? [];
        porPersona.set(a.personaId, [...previos, a.codigo]);
      }
      return {
        ...estado,
        avisosCierre: [...new Set([...estado.avisosCierre, ...cierres])],
        cuentas: estado.cuentas.map((c) => ({
          ...c,
          personas: c.personas.map((p) => {
            const codigos = porPersona.get(p.id);
            if (!codigos) return p;
            return { ...p, alarmasVistas: [...new Set([...p.alarmasVistas, ...codigos])] };
          }),
        })),
      };
    }

    case "guardarAjustes":
      return { ...estado, ajustes: accion.ajustes };

    case "guardarPaquetes":
      return { ...estado, paquetes: accion.paquetes };

    case "nuevoDia":
      return { ...estado, fecha: fechaOperativa(), cuentas: [], ultimoNumero: 0, avisosCierre: [] };
  }
}

function crearPersona(nombre: string, entrada: string, modalidad: Modalidad): Persona {
  return {
    id: nuevoId("p"),
    nombre: nombre.trim() || "Invitado",
    entrada,
    salida: null,
    modalidad,
    estudiante: false,
    alarmasVistas: [],
  };
}

function mapCuenta(
  estado: EstadoDia,
  cuentaId: string,
  fn: (c: Cuenta) => Cuenta,
): EstadoDia {
  return {
    ...estado,
    cuentas: estado.cuentas.map((c) => (c.id === cuentaId ? fn(c) : c)),
  };
}

function mapPersona(
  estado: EstadoDia,
  cuentaId: string,
  personaId: string,
  fn: (p: Persona) => Persona,
): EstadoDia {
  return mapCuenta(estado, cuentaId, (c) => ({
    ...c,
    personas: c.personas.map((p) => (p.id === personaId ? fn(p) : p)),
  }));
}
