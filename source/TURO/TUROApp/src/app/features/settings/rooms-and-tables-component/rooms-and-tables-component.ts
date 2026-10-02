import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Combination, FloorPlanZone, ZoneRequest } from '../../../models';
import { FloorPlanService } from '../../../core/services/floor-plan/floor-plan.service';
import { ModalService } from '../../../core/services/modal/modal.service';
import { Button } from '../../../shared/components/button/button';
import { countChanges, draftFromPublished } from '../floor-plan-editor/logic/draft-diff';
import { formatMetres } from '../floor-plan-editor/logic/units';

/** Mêmes bornes que l'API */
const MAX_ZONE_NAME_LENGTH = 40;
const MIN_ZONE_SIZE = 2;
const MAX_ZONE_SIZE = 100;

/**
 * Paramètres › Salles et tables (§13.1) : les salles se règlent ici, tout de suite. Les tables se posent
 * dans l'éditeur de plan (EDIT-05), auquel chaque salle mène
 */
@Component({
  imports: [Button, RouterLink],
  selector: 'app-rooms-and-tables-component',
  templateUrl: './rooms-and-tables-component.html',
})
export class RoomsAndTablesComponent {
  private _modalService = inject(ModalService);
  protected floorPlan = inject(FloorPlanService);
  protected readonly formatMetres = formatMetres;

  private _draft = resource({ loader: () => this.floorPlan.getDraft() });

  protected zones = this.floorPlan.zones;

  /** `null` sans brouillon : rien à signaler */
  protected draftChanges = computed(() => {
    const draft = this._draft.hasValue() ? this._draft.value().value : null;
    return draft === null ? null : countChanges(draftFromPublished(this.zones()), draft);
  });

  /** Salle de chaque table publiée : une combinaison dont les tables sont dans deux salles est inactive */
  private _tableZones = computed(() =>
    new Map(this.zones().flatMap((zone) => zone.tables.map((table) => [table.id, zone.id] as const))));

  protected isSplit(combination: Combination): boolean {
    const zones = combination.tableIds.map((id) => this._tableZones().get(id));
    return zones[0] !== zones[1];
  }

  protected activeTables(zone: FloorPlanZone) {
    return zone.tables.filter((table) => table.isActive);
  }

  protected seats(zone: FloorPlanZone): number {
    return this.activeTables(zone).reduce((sum, table) => sum + table.capacity, 0);
  }

  /** Une salle qui a porté une table (publiée ou en brouillon) reste : les tables ne se suppriment jamais */
  protected canDelete(zone: FloorPlanZone): boolean {
    const draft = this._draft.hasValue() ? this._draft.value().value : null;
    return zone.tables.length === 0 && !(draft?.tables.some((table) => table.zoneId === zone.id) ?? false);
  }

  async addZone() {
    const request: ZoneRequest = { name: '', width: 8, height: 5 };
    if (await this.zoneModal('Nouvelle salle', request)) {
      this.showError((await this.floorPlan.createZone(request)).error);
    }
  }

  async editZone(zone: FloorPlanZone) {
    const request: ZoneRequest = { name: zone.name, width: zone.width, height: zone.height };
    if (await this.zoneModal('Modifier la salle', request)) {
      this.showError((await this.floorPlan.updateZone(zone.id, request)).error);
    }
  }

  async moveZone(zone: FloorPlanZone, delta: -1 | 1) {
    const ids = this.zones().map((z) => z.id);
    const from = ids.indexOf(zone.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) {
      return;
    }
    [ids[from], ids[to]] = [ids[to], ids[from]];
    this.showError((await this.floorPlan.reorderZones(ids)).error);
  }

  async deleteZone(zone: FloorPlanZone) {
    const confirmed = await this._modalService.confirmModal(
      'Supprimer la salle',
      `La salle « ${zone.name} » et son décor seront supprimés.`,
      'Supprimer',
    );
    if (confirmed) {
      this.showError((await this.floorPlan.deleteZone(zone.id)).error);
    }
  }

  private zoneModal(title: string, request: ZoneRequest): Promise<boolean> {
    const sizeError = (value: number) => value < MIN_ZONE_SIZE || value > MAX_ZONE_SIZE
      ? `Entre ${MIN_ZONE_SIZE} et ${MAX_ZONE_SIZE} m`
      : null;
    return this._modalService.formModal(title, [
      {
        valueType: 'string', label: 'Nom', defaultValue: request.name, required: true,
        checkValue: (value) => value.trim().length > MAX_ZONE_NAME_LENGTH ? `${MAX_ZONE_NAME_LENGTH} caractères au plus` : null,
        setValue: (value) => request.name = value.trim(),
      },
      {
        valueType: 'number', label: 'Largeur (m)', defaultValue: request.width, required: true,
        checkValue: sizeError, setValue: (value) => request.width = value,
      },
      {
        valueType: 'number', label: 'Profondeur (m)', defaultValue: request.height, required: true,
        checkValue: sizeError, setValue: (value) => request.height = value,
      },
    ], 'Les dimensions réelles de la salle : le plan est à l\'échelle.');
  }

  private showError(error: string | null) {
    if (error !== null) {
      this._modalService.infoModal('Erreur', error);
    }
  }
}
