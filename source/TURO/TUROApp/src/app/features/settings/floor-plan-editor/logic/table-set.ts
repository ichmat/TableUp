/** Clé d'un ensemble de tables, quel que soit l'ordre : « 12-13-14 » et « 14-12-13 » réunissent les mêmes tables */
export function tableSetKey(tableIds: readonly string[]): string {
  return [...tableIds].sort().join('|');
}

export function sameTableSet(a: readonly string[], b: readonly string[]): boolean {
  return tableSetKey(a) === tableSetKey(b);
}
