/** Une fiche du panneau unique (§7.6), et le nom qu'elle prend quand on en revient (« ← Sophie Marchand ») */
export interface PanelEntry {
  kind: 'reservation' | 'client',
  id: string,
  label: string,
}

const same = (a: PanelEntry, b: PanelEntry) => a.kind === b.kind && a.id === b.id;

/**
 * §7.6 : profondeur 2 au plus. Ouvrir depuis la première fiche empile ; rouvrir la première y ramène ;
 * un troisième aller-retour n'empile pas : la fiche qu'on quitte devient l'origine
 */
export function openFrom(stack: PanelEntry[], entry: PanelEntry): PanelEntry[] {
  if (stack.length === 0) {
    return [entry];
  }
  const top = stack[stack.length - 1];
  if (same(top, entry)) {
    return stack;
  }
  if (same(stack[0], entry)) {
    return [stack[0]];
  }
  return [top, entry];
}

/** La flèche : retour à la première fiche */
export function backTo(stack: PanelEntry[]): PanelEntry[] {
  return stack.slice(0, 1);
}
