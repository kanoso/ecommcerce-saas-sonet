import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { RaffleSummary } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';
import { CatalogStore } from './catalog.store';
import { aRaffle } from './testing/raffle.fixture';

describe('CatalogStore', () => {
  let responses: Subject<RaffleSummary[]>[];
  let store: InstanceType<typeof CatalogStore>;

  beforeEach(() => {
    responses = [];
    TestBed.configureTestingModule({
      providers: [
        CatalogStore,
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
    store = TestBed.inject(CatalogStore);
  });

  const answer = (raffles: RaffleSummary[]) => {
    responses.at(-1)?.next(raffles);
    responses.at(-1)?.complete();
  };

  it('is loading while the request is pending', () => {
    store.load();
    expect(store.status()).toBe('loading');
  });

  it('holds the raffles once loaded', () => {
    store.load();
    answer([aRaffle({ id: 'a' }), aRaffle({ id: 'b' })]);
    expect(store.status()).toBe('ready');
    expect(store.raffles().map((r) => r.id)).toEqual(['a', 'b']);
    expect(store.isEmpty()).toBe(false);
  });

  it('is empty when there are no active raffles', () => {
    store.load();
    answer([]);
    expect(store.status()).toBe('ready');
    expect(store.isEmpty()).toBe(true);
  });

  it('keeps the user message of a failure', () => {
    store.load();
    responses[0].error(new ApiError(0, 'NETWORK_ERROR', 'Sin conexión'));
    expect(store.status()).toBe('error');
    expect(store.errorMessage()).toBe('Sin conexión');
  });

  it('can retry after a failure', () => {
    store.load();
    responses[0].error(new ApiError(500, 'INTERNAL_ERROR', 'Falló'));
    store.load();
    expect(store.status()).toBe('loading');
    answer([aRaffle()]);
    expect(store.status()).toBe('ready');
    expect(store.errorMessage()).toBeNull();
  });
});
