import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { aplicarTema, conTransicion, guardarTema, leerTema, type Tema } from "../lib/tema";

/** El tema elegido y cómo cambiarlo. El tema inicial ya lo aplicó main.tsx. */
export function useTema(): [Tema, (tema: Tema) => void] {
  const [tema, setTema] = useState<Tema>(leerTema);

  const cambiar = useCallback((nuevo: Tema) => {
    conTransicion(() => {
      // Síncrono: el fundido toma la foto nueva en cuanto termina esta función.
      flushSync(() => setTema(nuevo));
      aplicarTema(nuevo);
      guardarTema(nuevo);
    });
  }, []);

  return [tema, cambiar];
}
