import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgendaLegend } from './agenda-legend';

describe('AgendaLegend', () => {
  let fixture: ComponentFixture<AgendaLegend>;
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(AgendaLegend);
    fixture.detectChanges();
  });

  it('shows the seven entries of the agenda', () => {
    const keys = Array.from(element().querySelectorAll('[data-legend]')).map((e) => e.getAttribute('data-legend'));
    expect(keys).toEqual(['Finished', 'Reserved', 'Occupied', 'Late', 'Ghost', 'Planned', 'Glued']);
    for (const label of ['Terminée', 'Réservée', 'Occupée', 'En retard', 'Prise via une combinaison', 'Rapprochement prévu', 'Collées']) {
      expect(element().textContent).toContain(label);
    }
  });
});
