import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { RaffleSummary } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';
import { CatalogStore } from './catalog.store';
import { aRaffle } from './testing/raffle.fixture';

describe('CatalogStore', () => {
  let responses: Subject<RaffleSummary[]>[];
  let pending: Subject<RaffleSummary[]>;
  let finished: Subject<RaffleSummary[]>;
  let store: InstanceType<typeof CatalogStore>;

  beforeEach(() => {
    responses = [];
    pending = new Subject<RaffleSummary[]>();
    finished = new Subject<RaffleSummary[]>();
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
            listPendingDraw: () => pending,
            listFinished: () => finished,
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

  it('holds the raffles waiting for their draw and the finished ones (DT-23)', () => {
    store.load();
    answer([aRaffle({ id: 'a' })]);
    pending.next([aRaffle({ id: 'live', status: 'DRAWN', liveDrawInProgress: true }), aRaffle({ id: 'closed', status: 'CLOSED' })]);
    finished.next([aRaffle({ id: 'drawn', status: 'DRAWN' }), aRaffle({ id: 'cancelled', status: 'CANCELLED' })]);

    expect(store.pendingRaffles().map((r) => r.id)).toEqual(['live', 'closed']);
    expect(store.finishedRaffles().map((r) => r.id)).toEqual(['drawn', 'cancelled']);
    expect(store.liveCount()).toBe(1);
  });

  it('keeps the active raffles when the other lists fail', () => {
    store.load();
    pending.error(new ApiError(500, 'INTERNAL_ERROR', 'Falló'));
    finished.error(new ApiError(500, 'INTERNAL_ERROR', 'Falló'));
    answer([aRaffle({ id: 'a' })]);

    expect(store.status()).toBe('ready');
    expect(store.pendingRaffles()).toEqual([]);
    expect(store.finishedRaffles()).toEqual([]);
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
