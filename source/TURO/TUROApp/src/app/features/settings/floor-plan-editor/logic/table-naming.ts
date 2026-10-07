/** Nom automatique d'une table posée : le plus petit « T n » libre, casse et espaces ignorés (EDIT-04) */
export function nextTableName(names: Iterable<string>): string {
  const taken = new Set(Array.from(names, (name) => name.trim().toLowerCase()));
  let number = 1;
  while (taken.has(`t${number}`)) {
    number++;
  }
  return `T${number}`;
}
