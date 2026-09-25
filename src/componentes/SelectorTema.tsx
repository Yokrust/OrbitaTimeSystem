import { Monitor, Moon, Sun } from "lucide-react";
import type { Tema } from "../lib/tema";
import { useTema } from "../estado/useTema";
import { Segmentado, type OpcionSegmento } from "./Segmentado";

const OPCIONES: OpcionSegmento<Tema>[] = [
  { valor: "sistema", etiqueta: "Automático", icono: <Monitor size={15} aria-hidden="true" /> },
  { valor: "claro", etiqueta: "Claro", icono: <Sun size={15} aria-hidden="true" /> },
  { valor: "oscuro", etiqueta: "Oscuro", icono: <Moon size={15} aria-hidden="true" /> },
];

/** Claro, oscuro o como el sistema. Se aplica al instante y se recuerda. */
export function SelectorTema() {
  const [tema, cambiar] = useTema();
  return (
    <Segmentado etiqueta="Apariencia" opciones={OPCIONES} valor={tema} onCambio={cambiar} soloIconos />
  );
}
