/** "martes" -> "Martes" */
export function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Cierra 9:30 p.m." -> "cierra 9:30 p.m.", para meterlo a media frase. */
export function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
