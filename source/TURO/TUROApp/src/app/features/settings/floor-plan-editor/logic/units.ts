/** « 8,00 m » : les dimensions d'une salle s'affichent en mètres */
export function formatMetres(metres: number): string {
  return `${metres.toFixed(2).replace('.', ',')} m`;
}

/** Les dimensions d'une table s'affichent en centimètres ; la donnée reste en mètres */
export function toCentimetres(metres: number): number {
  return Math.round(metres * 100);
}

export function fromCentimetres(centimetres: number): number {
  return Math.round(centimetres) / 100;
}
