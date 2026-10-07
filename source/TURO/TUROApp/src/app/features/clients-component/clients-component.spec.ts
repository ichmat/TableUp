import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, signal } from '@angular/core';
import { ClientDetail } from '../../models';
import { ClientService } from '../../core/services/client/client.service';
import { ClientsComponent } from './clients-component';

@Component({ selector: 'app-client-list', template: '' })
class ListStub { selectedId = input<string | null>(null); opened = output<string>(); create = output<void>(); }
@Component({ selector: 'app-client-sheet', template: 'SHEET' })
class SheetStub { edit = output<void>(); closed = output<void>(); }
@Component({ selector: 'app-client-form', template: 'FORM' })
class FormStub { client = input<ClientDetail | null>(null); saved = output<ClientDetail>(); cancelled = output<void>(); openClient = output<string>(); }

type Page = { open(id: string): void, startCreate(): void, startEdit(): void, onSaved(c: ClientDetail): void };

describe('ClientsComponent', () => {
  let fixture: ComponentFixture<ClientsComponent>;
  const selectedId = signal<string | null>(null);
  const detail = signal<ClientDetail | null>(null);
  const clients = { selectedId, detail, select: (id: string | null) => selectedId.set(id) };
  const text = () => (fixture.nativeElement as HTMLElement).textContent!;
  const page = () => fixture.componentInstance as unknown as Page;

  beforeEach(async () => {
    selectedId.set(null);
    detail.set(null);
    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [{ provide: ClientService, useValue: clients }],
    }).overrideComponent(ClientsComponent, { set: { imports: [ListStub, SheetStub, FormStub] } }).compileComponents();

    fixture = TestBed.createComponent(ClientsComponent);
    fixture.detectChanges();
  });

  it('should show the list alone until a client is opened', () => {
    expect(text()).not.toContain('SHEET');

    page().open('c1');
    fixture.detectChanges();

    expect(selectedId()).toBe('c1');
    expect(text()).toContain('SHEET');
  });

  it('should open an empty form for a new client, then its sheet once saved', () => {
    page().open('c1');
    page().startCreate();
    fixture.detectChanges();
    expect(selectedId()).toBeNull();
    expect(text()).toContain('FORM');

    page().onSaved({ id: 'c9' } as ClientDetail);
    fixture.detectChanges();
    expect(selectedId()).toBe('c9');
    expect(text()).toContain('SHEET');
  });

  it('should edit the loaded client in the same panel', () => {
    page().open('c1');
    detail.set({ id: 'c1' } as ClientDetail);
    page().startEdit();
    fixture.detectChanges();

    expect(text()).toContain('FORM');
    expect(text()).not.toContain('SHEET');
  });
});
