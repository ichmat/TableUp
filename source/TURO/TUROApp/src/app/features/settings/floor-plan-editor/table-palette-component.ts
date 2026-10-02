import { Component, input, output } from '@angular/core';
import { DECOR_LABELS, DecorPaletteEntry, paletteDimensions, paletteLabel, TablePaletteEntry } from './logic/palette';

/** Un type de table attrapé dans la palette, à suivre jusqu'au dépôt */
export interface PalettePick {
  entry: TablePaletteEntry,
  event: PointerEvent,
}

/** Un type de décor attrapé dans la palette */
export interface DecorPalettePick {
  entry: DecorPaletteEntry,
  event: PointerEvent,
}

/** La palette des tables et du décor (EDIT-04, EDIT-06, EDIT-08) : on attrape un type et on le lâche sur le plan */
@Component({
  selector: 'app-table-palette-component',
  templateUrl: './table-palette-component.html',
})
export class TablePaletteComponent {
  entries = input.required<readonly TablePaletteEntry[]>();
  decorEntries = input<readonly DecorPaletteEntry[]>([]);
  pick = output<PalettePick>();
  pickDecor = output<DecorPalettePick>();

  protected readonly label = paletteLabel;
  protected readonly dimensions = paletteDimensions;
  protected readonly decorLabels = DECOR_LABELS;

  protected onPointerDown(entry: TablePaletteEntry, event: PointerEvent) {
    event.preventDefault();
    this.pick.emit({ entry, event });
  }

  protected onDecorPointerDown(entry: DecorPaletteEntry, event: PointerEvent) {
    event.preventDefault();
    this.pickDecor.emit({ entry, event });
  }
}
