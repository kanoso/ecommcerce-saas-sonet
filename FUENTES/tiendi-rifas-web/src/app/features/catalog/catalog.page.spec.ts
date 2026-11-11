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

  function render() {
    responses = [];
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
