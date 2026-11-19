import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { RaffleSummary } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';
import { CatalogPage } from './catalog.page';
import { aRaffle } from './testing/raffle.fixture';

describe('CatalogPage', () => {
  let responses: Subject<RaffleSummary[]>[];
  let pending: Subject<RaffleSummary[]>;
  let finished: Subject<RaffleSummary[]>;

  function render() {
    responses = [];
    pending = new Subject<RaffleSummary[]>();
    finished = new Subject<RaffleSummary[]>();
    TestBed.configureTestingModule({
      imports: [CatalogPage],
      providers: [
        provideRouter([]),
        {
          provide: RafflesApi,
          useValue: {
            listActive: () => {
              const response = new Subject<RaffleSummary[]>();
              responses.push(response);
              return response;
            },
            listPendingDraw: () => pending,
            listFinished: () => finished,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CatalogPage);
    fixture.detectChanges();
    return fixture;
  }

  it('shows a loading state while raffles are requested', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Cargando rifas');
  });

  it('lists the active raffles', () => {
    const fixture = render();
    responses[0].next([aRaffle({ id: 'a', title: 'Moto' }), aRaffle({ id: 'b', title: 'Canasta' })]);
    fixture.detectChanges();
    const titles = [...fixture.nativeElement.querySelectorAll('article h2')].map((h) => h.textContent);
    expect(titles).toEqual(['Moto', 'Canasta']);
  });

  it('has three tabs: on sale, to be drawn and finished (DT-23)', () => {
    const fixture = render();
    responses[0].next([aRaffle({ id: 'a', title: 'Moto' })]);
    pending.next([aRaffle({ id: 'p', title: 'Olla', status: 'CLOSED' })]);
    finished.next([
      aRaffle({ id: 'd', title: 'Licuadora', status: 'DRAWN' }),
      aRaffle({ id: 'c', title: 'Canasta', status: 'CANCELLED' }),
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = [...el.querySelectorAll('[role="tab"]')] as HTMLButtonElement[];
    const titles = () => [...el.querySelectorAll('article h2')].map((h) => h.textContent);

    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['En venta (1)', 'Por sortear (1)', 'Finalizadas (2)']);
    expect(titles()).toEqual(['Moto']);

    tabs[1].click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Olla']);

    tabs[2].click();
    fixture.detectChanges();
    expect(titles()).toEqual(['Licuadora', 'Canasta']);
  });

  it('says so when no raffle waits for its draw', () => {
    const fixture = render();
    responses[0].next([]);
    pending.next([]);
    fixture.detectChanges();
    ((fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay rifas por sortear');
  });

  it('says so when there are no active raffles', () => {
    const fixture = render();
    responses[0].next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay rifas activas por ahora');
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
  });

  it('shows the error and retries on demand', () => {
    const fixture = render();
    responses[0].error(new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos.'));
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos conectarnos.');

    alert.querySelector('button').click();
    fixture.detectChanges();
    expect(responses).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Cargando rifas');
  });
});
