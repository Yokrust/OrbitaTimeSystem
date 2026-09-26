interface Props {
  valor: number;
  moneda?: string;
  className?: string;
}

/**
 * Importe con los centavos aparte, para que en las cifras grandes se puedan
 * pintar más chicos y el ojo vaya directo a los pesos.
 */
export function Dinero({ valor, moneda = "MXN", className }: Props) {
  const partes = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).formatToParts(valor);
  const punto = partes.findIndex((p) => p.type === "decimal");
  const pesos = (punto === -1 ? partes : partes.slice(0, punto)).map((p) => p.value).join("");
  const centavos = punto === -1 ? "" : partes.slice(punto).map((p) => p.value).join("");

  return (
    <span className={className ? `dinero ${className}` : "dinero"}>
      {pesos}
      {centavos && <span className="dinero-centavos">{centavos}</span>}
    </span>
  );
}
