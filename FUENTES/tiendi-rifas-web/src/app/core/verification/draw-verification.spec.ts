import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';
import { MyTicket, RaffleStatusInfo, VerificationData } from '../api/api.models';
import { OrdersApi } from '../api/orders-api';
import { RafflesApi } from '../api/raffles-api';
import { DRAND_FETCH, DRAND_SETTINGS, DrandClient, RoundPollOptions, VerifiedRound } from '../drand/drand-client';
import { ROUND_1M, RelayAnswer, fakeDrand } from '../drand/drand.testing';
import { QUICKNET } from '../drand/quicknet';
import { SESSION_STORAGE, SessionStore } from '../session/session.store';
import { memoryStorage } from '../session/testing/memory-storage';
import { CheckId, DrawVerification, VERIFICATION_TIMING } from './draw-verification';
import { DRAW_VECTORS, verificationOf, verificationWithRealRound } from './testing/verification.fixture';

const RELAYS = ['https://relay-a.test', 'https://relay-b.test'];
const roundUrl = (relay: string, round = '1000000') => `${relay}/${QUICKNET.chainHash}/public/${round}`;

interface Setup {
  verification?: () => Observable<VerificationData>;
  statusInfo?: () => Observable<RaffleStatusInfo>;
  /** A fake drand client: the round each poll answers. */
  rounds?: (round: string, options: RoundPollOptions) => Promise<VerifiedRound>;
  /** Or the real client over fake relays. */
  relays?: Record<string, RelayAnswer | RelayAnswer[]>;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  signedIn?: boolean;
  myTickets?: () => Observable<MyTicket[]>;
  storage?: Storage | null;
}

function setUp(setup: Setup) {
  const asked: string[] = [];
  const myTicketReads = { count: 0 };
  const providers: unknown[] = [
    DrawVerification,
    {
      provide: RafflesApi,
      useValue: {
        verification: setup.verification ?? (() => throwError(() => new Error('unexpected'))),
        statusInfo: setup.statusInfo ?? (() => throwError(() => new Error('unexpected'))),
      },
    },
    {
      provide: OrdersApi,
      useValue: {
        myTickets: () => {
          myTicketReads.count++;
          return (setup.myTickets ?? (() => of([])))();
        },
      },
    },
    { provide: SessionStore, useValue: { isAuthenticated: () => setup.signedIn ?? false } },
    { provide: SESSION_STORAGE, useValue: setup.storage === undefined ? memoryStorage() : setup.storage },
    {
      provide: VERIFICATION_TIMING,
      useValue: { pollIntervalMs: setup.pollIntervalMs ?? 0, maxWaitMs: setup.maxWaitMs ?? 5000 },
    },
  ];
  let calls: string[] = asked;
  if (setup.relays) {
    const drand = fakeDrand(setup.relays);
    calls = drand.calls;
    providers.push(
      { provide: DRAND_FETCH, useValue: drand.fetch },
      { provide: DRAND_SETTINGS, useValue: { relays: RELAYS, timeoutMs: 1000 } },
    );
  } else {
    const rounds = setup.rounds ?? (() => Promise.reject(new Error('unexpected')));
    providers.push({
      provide: DrandClient,
      useValue: {
        pollRound: (round: string, options: RoundPollOptions) => {
          asked.push(round);
          return rounds(round, options);
        },
      },
    });
  }
  TestBed.configureTestingModule({ providers: providers as never[] });
  return { service: TestBed.inject(DrawVerification), drandCalls: () => calls, myTicketReads };
}

/** The fake drand of the vectors: answers the vector's randomness for the round. */
const vectorRound =
  (randomness: string) =>
  async (round: string): Promise<VerifiedRound> => ({ round, randomness, signature: 'ab'.repeat(48) });

const statusOf = (service: DrawVerification, id: CheckId) => service.checks().find((c) => c.id === id)?.status;
const detailOf = (service: DrawVerification, id: CheckId) => service.checks().find((c) => c.id === id)?.detail ?? '';

const apiError = (status: number, code: string) => new ApiError(status, code, 'mensaje');

/**
 * Fake timers for the polling only: Web Crypto answers outside the timer
 * queue, so setInterval stays real and gives it a turn to finish.
 */
const useFakePollTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
const realTurn = () =>
  new Promise<void>((resolve) => {
    const turn = setInterval(() => {
      clearInterval(turn);
      resolve();
    }, 0);
  });

/** Advances the fake clock step by step until the condition holds. */
async function advanceUntil(condition: () => boolean, stepMs = 100, maxSteps = 2000): Promise<void> {
  for (let step = 0; step < maxSteps && !condition(); step++) {
    await realTurn();
    await vi.advanceTimersByTimeAsync(stepMs);
  }
  expect(condition()).toBe(true);
}

/** Advances the fake clock by a total, letting crypto finish between steps. */
async function advanceBy(totalMs: number, stepMs = 100): Promise<void> {
  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    await realTurn();
    await vi.advanceTimersByTimeAsync(stepMs);
  }
}

async function settled<T>(promise: Promise<T>): Promise<T> {
  let done = false;
  void promise.finally(() => (done = true));
  await advanceUntil(() => done);
  return promise;
}

const ticket = (overrides: Partial<MyTicket> = {}): MyTicket => ({
  orderId: 'o-1',
  raffleId: DRAW_VECTORS[0].raffleId,
  raffleTitle: 'Smart TV 55"',
  numbers: [3, 7],
  status: 'PAID',
  totalAmount: 20,
  expiresAt: null,
  ...overrides,
});

describe('DrawVerification', () => {
  afterEach(() => vi.useRealTimers());

  describe('loading the frozen data', () => {
    it('checks the commitment, the sold list and the round binding as soon as the data arrives', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({ verification: () => of(verificationOf(vector)) });

      await service.load(vector.raffleId);

      expect(service.state()).toEqual({ kind: 'loaded' });
      expect(service.data()?.raffleId).toBe(vector.raffleId);
      expect(statusOf(service, 'commitment')).toBe('passed');
      expect(statusOf(service, 'soldList')).toBe('passed');
      expect(statusOf(service, 'roundBinding')).toBe('passed');
      expect(detailOf(service, 'roundBinding')).toContain('#1000000');
      expect(statusOf(service, 'drandRound')).toBe('pending');
      expect(statusOf(service, 'winner')).toBe('pending');
      expect(statusOf(service, 'official')).toBe('pending');
      expect(service.verdict()).toBe('pending');
      expect(drandCalls()).toEqual([]);
    });

    it('is not loaded, so nothing can be recomputed, until every frozen check has finished', async () => {
      const vector = DRAW_VECTORS[0];
      const tickets = new Subject<MyTicket[]>();
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector)),
        signedIn: true,
        myTickets: () => tickets,
        rounds: vectorRound(vector.drandRandomnessHex),
      });

      const loading = service.load(vector.raffleId);
      await vi.waitFor(() => expect(statusOf(service, 'ownNumbers')).toBe('running'));

      expect(service.state()).toEqual({ kind: 'loading' });
      await service.recompute();
      expect(drandCalls()).toEqual([]);

      tickets.next([ticket()]);
      tickets.complete();
      await loading;
      expect(service.state()).toEqual({ kind: 'loaded' });
    });

    it('reports a raffle that is not drawn yet', async () => {
      const { service } = setUp({
        verification: () => throwError(() => apiError(409, 'DRAW_NOT_POSSIBLE')),
        statusInfo: () => of({ title: 'Moto', status: 'CLOSED' }),
      });

      await service.load('r-1');

      expect(service.state()).toEqual({ kind: 'not-drawn', title: 'Moto' });
    });

    it('reports a cancelled raffle', async () => {
      const { service } = setUp({
        verification: () => throwError(() => apiError(409, 'DRAW_NOT_POSSIBLE')),
        statusInfo: () => of({ title: 'Moto', status: 'CANCELLED' }),
      });

      await service.load('r-1');

      expect(service.state()).toEqual({ kind: 'cancelled', title: 'Moto' });
    });

    it('reports a raffle that does not exist', async () => {
      const { service } = setUp({ verification: () => throwError(() => apiError(404, 'RAFFLE_NOT_FOUND')) });

      await service.load('r-1');

      expect(service.state()).toEqual({ kind: 'not-found' });
    });

    it('reports any other failure with its message', async () => {
      const { service } = setUp({ verification: () => throwError(() => apiError(0, 'NETWORK_ERROR')) });

      await service.load('r-1');

      expect(service.state()).toEqual({ kind: 'error', message: 'mensaje' });
    });
  });

  describe('the round fixed at publish (DT-18)', () => {
    it('fails when the round is not the quicknet round of the draw date, and never asks drand', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { drandRound: '1000001' })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'roundBinding')).toBe('failed');
      expect(detailOf(service, 'roundBinding')).toContain('#1000001');
      expect(detailOf(service, 'roundBinding')).toContain('#1000000');
      expect(statusOf(service, 'drandRound')).toBe('skipped');
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the draw date, and so the round, is before the close of sales', async () => {
      const vector = DRAW_VECTORS[0];
      // The round matches the draw date, but that date is before the close:
      // its value was public while numbers were still on sale.
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { salesCloseAt: new Date('2023-09-27T09:00:00.000Z') })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'roundBinding')).toBe('failed');
      expect(detailOf(service, 'roundBinding')).toContain('no es posterior al cierre de ventas');
      expect(detailOf(service, 'roundBinding')).toContain('#1000612');
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the platform does not say when sales closed', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({ verification: () => of(verificationOf(vector, { salesCloseAt: null })) });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'roundBinding')).toBe('failed');
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the platform does not say when the draw is', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({ verification: () => of(verificationOf(vector, { drawAt: null })) });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'roundBinding')).toBe('failed');
      expect(service.verdict()).toBe('failed');
    });
  });

  describe('the buyer own numbers', () => {
    it('is skipped, without reading any order, when nobody is signed in', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, myTicketReads } = setUp({ verification: () => of(verificationOf(vector)) });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'ownNumbers')).toBe('skipped');
      expect(detailOf(service, 'ownNumbers')).toContain('Inicia sesión');
      expect(myTicketReads.count).toBe(0);
    });

    it('passes when every number of the paid orders of this raffle is in the sold list', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        signedIn: true,
        myTickets: () =>
          of([
            ticket(),
            ticket({ orderId: 'o-2', numbers: [10] }),
            // Unpaid orders and other raffles do not count.
            ticket({ orderId: 'o-3', numbers: [99], status: 'REJECTED' }),
            ticket({ orderId: 'o-4', numbers: [99], raffleId: 'other' }),
          ]),
      });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'ownNumbers')).toBe('passed');
      expect(detailOf(service, 'ownNumbers')).toContain('3, 7, 10');
    });

    it('fails, visibly, when a paid number is missing from the sold list', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        signedIn: true,
        myTickets: () => of([ticket({ numbers: [3, 11] })]),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'ownNumbers')).toBe('failed');
      expect(detailOf(service, 'ownNumbers')).toContain('11');
      expect(service.verdict()).toBe('failed');
    });

    it('is skipped when the buyer has no paid order in this raffle', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        signedIn: true,
        myTickets: () => of([ticket({ status: 'PENDING' })]),
      });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'ownNumbers')).toBe('skipped');
    });

    it('is skipped, not failed, when the orders cannot be read', async () => {
      const vector = DRAW_VECTORS[0];
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        signedIn: true,
        myTickets: () => throwError(() => apiError(0, 'NETWORK_ERROR')),
      });

      await service.load(vector.raffleId);

      expect(statusOf(service, 'ownNumbers')).toBe('skipped');
      expect(detailOf(service, 'ownNumbers')).toContain('No pudimos leer');
      expect(service.verdict()).toBe('pending');
    });
  });

  describe('anchors', () => {
    const vector = DRAW_VECTORS[0];
    const matchingEmail = {
      commitmentHash: vector.expected.commitmentHash.toUpperCase(),
      drandRound: '#1000000',
      drawAt: '2023-09-27T08:29:24.000Z',
      salesCloseAt: '2023-09-27T08:00:00Z',
    };

    it('is a first visit, not anchored, when nothing was pinned before', async () => {
      const { service } = setUp({ verification: () => of(verificationOf(vector)) });

      await service.load(vector.raffleId);

      expect(service.pinStatus()).toBe('first-visit');
      expect(service.anchorStatus()).toBe('first-visit');
    });

    it('is anchored on a later visit whose values match the pinned ones', async () => {
      const storage = memoryStorage();
      const { service } = setUp({ verification: () => of(verificationOf(vector)), storage });
      await service.load(vector.raffleId);

      await service.load(vector.raffleId);

      expect(service.pinStatus()).toBe('anchored');
      expect(service.anchorStatus()).toBe('anchored');
    });

    it('reports no storage when the browser keeps none, or its storage throws', async () => {
      const { service } = setUp({ verification: () => of(verificationOf(vector)), storage: null });
      await service.load(vector.raffleId);
      expect(service.pinStatus()).toBe('no-storage');

      TestBed.resetTestingModule();
      const refusing = memoryStorage();
      refusing.getItem = () => {
        throw new DOMException('denied', 'SecurityError');
      };
      const { service: other } = setUp({ verification: () => of(verificationOf(vector)), storage: refusing });
      await other.load(vector.raffleId);
      expect(other.pinStatus()).toBe('no-storage');
      expect(other.anchorStatus()).toBe('no-storage');
    });

    it('pins nothing from data whose checks failed', async () => {
      const storage = memoryStorage();
      let data = verificationOf(vector, { soldNumbers: [...vector.soldNumbers, 11] });
      const { service } = setUp({ verification: () => of(data), storage });
      await service.load(vector.raffleId);
      expect(storage.length).toBe(0);

      data = verificationOf(vector);
      await service.load(vector.raffleId);

      expect(service.pinStatus()).toBe('first-visit');
      expect(storage.length).toBe(1);
    });

    it('anchors a first visit when every value pasted from the email matches', async () => {
      const { service } = setUp({ verification: () => of(verificationOf(vector)) });
      await service.load(vector.raffleId);

      service.compareWithEmail(matchingEmail);

      expect(statusOf(service, 'emailAnchor')).toBe('passed');
      expect(service.anchorStatus()).toBe('anchored');
    });

    it('fails visibly, and so does the verdict, when one email value differs', async () => {
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);
      service.compareWithEmail({ ...matchingEmail, salesCloseAt: '2023-09-27T07:00:00.000Z' });

      await service.recompute();

      expect(statusOf(service, 'emailAnchor')).toBe('failed');
      expect(detailOf(service, 'emailAnchor')).toContain('Cierre de ventas');
      expect(statusOf(service, 'official')).toBe('passed');
      expect(service.verdict()).toBe('failed');
      expect(service.anchorStatus()).toBe('first-visit');
    });

    it('compares only what was pasted, and says when a value cannot be read', async () => {
      const { service } = setUp({ verification: () => of(verificationOf(vector)) });
      await service.load(vector.raffleId);

      service.compareWithEmail({ drandRound: '1000000' });
      expect(statusOf(service, 'emailAnchor')).toBe('passed');

      service.compareWithEmail({ drandRound: '1000000', drawAt: 'ayer' });
      expect(statusOf(service, 'emailAnchor')).toBe('pending');
      expect(detailOf(service, 'emailAnchor')).toContain('Fecha del sorteo');

      service.compareWithEmail({});
      expect(statusOf(service, 'emailAnchor')).toBe('pending');
      expect(service.anchorStatus()).toBe('first-visit');
    });
  });

  describe('values pinned in this browser', () => {
    it('warns when the commitment, round, date or list hash differ from a previous visit', async () => {
      const vector = DRAW_VECTORS[0];
      const storage = memoryStorage();
      let data = verificationOf(vector);
      const { service } = setUp({ verification: () => of(data), storage });
      await service.load(vector.raffleId);
      expect(service.pinConflicts()).toEqual([]);

      data = verificationOf(vector, { commitmentHash: 'ab'.repeat(32) });
      await service.load(vector.raffleId);

      expect(service.pinConflicts()).toEqual([
        { field: 'commitmentHash', pinned: vector.expected.commitmentHash, seen: 'ab'.repeat(32) },
      ]);
    });
  });

  describe('recomputing in the browser', () => {
    it('computes the winner of each F1 vector and finds it matches the official one', async () => {
      for (const vector of DRAW_VECTORS) {
        TestBed.resetTestingModule();
        const { service } = setUp({
          verification: () => of(verificationOf(vector)),
          rounds: vectorRound(vector.drandRandomnessHex),
        });
        await service.load(vector.raffleId);

        await service.recompute();

        expect(service.localResult()).toEqual({
          index: vector.expected.index,
          winner: vector.expected.winner,
          digestHex: vector.expected.digestHex,
        });
        expect(service.checks().map((c) => c.status)).toEqual([
          'passed',
          'passed',
          'passed',
          'skipped',
          'pending',
          'passed',
          'passed',
          'passed',
        ]);
        expect(service.verdict()).toBe('match');
        expect(detailOf(service, 'official')).toBe('Coincide con el resultado oficial.');
      }
    });

    it('fetches the real round from drand, verifies its signature and gets the official winner', async () => {
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: { [roundUrl(RELAYS[0])]: { status: 200, body: ROUND_1M } },
      });
      await service.load(DRAW_VECTORS[3].raffleId);

      await service.recompute();

      expect(drandCalls()).toEqual([roundUrl(RELAYS[0])]);
      expect(service.round()?.randomness).toBe(ROUND_1M.randomness);
      expect(service.localResult()?.winner).toBe(60);
      expect(service.verdict()).toBe('match');
    });

    it('asks the next relay when one is down', async () => {
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: {
          [roundUrl(RELAYS[0])]: 'network-error',
          [roundUrl(RELAYS[1])]: { status: 200, body: ROUND_1M },
        },
      });
      await service.load(DRAW_VECTORS[3].raffleId);

      await service.recompute();

      expect(drandCalls()).toEqual([roundUrl(RELAYS[0]), roundUrl(RELAYS[1])]);
      expect(service.verdict()).toBe('match');
    });

    it('waits for a round that is not published yet, even with a relay down', async () => {
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: {
          [roundUrl(RELAYS[0])]: [{ status: 425 }, { status: 425 }, { status: 200, body: ROUND_1M }],
          [roundUrl(RELAYS[1])]: 'network-error',
        },
      });
      await service.load(DRAW_VECTORS[3].raffleId);

      await service.recompute();

      expect(drandCalls()).toHaveLength(5);
      expect(statusOf(service, 'drandRound')).toBe('passed');
      expect(service.roundProgress()?.attempt).toBe(2);
      expect(service.verdict()).toBe('match');
    });

    it('shows the attempt and the relays while it waits for the round', async () => {
      const vector = DRAW_VECTORS[0];
      let answer: (round: VerifiedRound) => void = () => undefined;
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        rounds: (round, options) => {
          options.onProgress?.({
            attempt: 1,
            relays: [
              { relay: 'api.drand.sh', reason: 'not-yet', status: 425 },
              { relay: 'api2.drand.sh', reason: 'network' },
            ],
            elapsedMs: 0,
          });
          return new Promise((resolve) => (answer = resolve));
        },
      });
      await service.load(vector.raffleId);

      const recomputed = service.recompute();
      await vi.waitFor(() => expect(service.roundProgress()?.attempt).toBe(1));

      expect(statusOf(service, 'drandRound')).toBe('running');
      expect(detailOf(service, 'drandRound')).toContain('aún no está publicada; consultando de nuevo (intento 2)');
      answer({ round: '1000000', randomness: vector.drandRandomnessHex, signature: 'ab'.repeat(48) });
      await recomputed;
      expect(service.verdict()).toBe('match');
    });

    it('gives up on a round that never gets published, after the total wait, saying so', async () => {
      useFakePollTimers();
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: { [roundUrl(RELAYS[0])]: { status: 425 }, [roundUrl(RELAYS[1])]: { status: 425 } },
        pollIntervalMs: 1000,
        maxWaitMs: 3000,
      });
      await settled(service.load(DRAW_VECTORS[3].raffleId));

      await settled(service.recompute());

      // Passes at 0, 1, 2 and 3 s over both relays; a fifth would start after 3 s.
      expect(drandCalls()).toHaveLength(8);
      expect(statusOf(service, 'drandRound')).toBe('failed');
      expect(detailOf(service, 'drandRound')).toContain('aún no está publicada');
      expect(service.verdict()).toBe('failed');
    });

    it('refuses a round whose BLS signature is invalid and never computes a winner', async () => {
      const forged = { ...ROUND_1M, round: 1000001 };
      const { service } = setUp({
        verification: () =>
          of(verificationWithRealRound({ drandRound: '1000001', drawAt: new Date('2023-09-27T08:29:27.000Z') })),
        relays: {
          [roundUrl(RELAYS[0], '1000001')]: { status: 200, body: forged },
          [roundUrl(RELAYS[1], '1000001')]: { status: 200, body: forged },
        },
      });
      await service.load(DRAW_VECTORS[3].raffleId);

      await service.recompute();

      expect(statusOf(service, 'roundBinding')).toBe('passed');
      expect(statusOf(service, 'drandRound')).toBe('failed');
      expect(detailOf(service, 'drandRound')).toContain('relay-a.test: firma BLS inválida');
      expect(statusOf(service, 'winner')).toBe('skipped');
      expect(statusOf(service, 'official')).toBe('skipped');
      expect(service.localResult()).toBeNull();
      expect(service.verdict()).toBe('failed');
    });

    it('shows every relay that failed when none answers, and can try again', async () => {
      const relays: Record<string, RelayAnswer | RelayAnswer[]> = {
        [roundUrl(RELAYS[0])]: ['network-error', { status: 200, body: ROUND_1M }],
        [roundUrl(RELAYS[1])]: { status: 503 },
      };
      const { service } = setUp({ verification: () => of(verificationWithRealRound()), relays });
      await service.load(DRAW_VECTORS[3].raffleId);

      await service.recompute();

      expect(statusOf(service, 'drandRound')).toBe('failed');
      expect(detailOf(service, 'drandRound')).toContain('relay-a.test: sin conexión');
      expect(detailOf(service, 'drandRound')).toContain('relay-b.test: respondió HTTP 503');
      expect(service.verdict()).toBe('failed');

      await service.recompute();

      expect(service.verdict()).toBe('match');
    });

    it('fails when the seed does not match the commitment, without asking drand', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { commitmentHash: 'ab'.repeat(32) })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);
      expect(statusOf(service, 'commitment')).toBe('failed');

      await service.recompute();

      expect(statusOf(service, 'commitment')).toBe('failed');
      expect(statusOf(service, 'drandRound')).toBe('skipped');
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the sold list does not hash to the published value', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { soldNumbers: [...vector.soldNumbers, 11] })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'soldList')).toBe('failed');
      expect(detailOf(service, 'soldList')).toContain('no corresponde al hash publicado');
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the platform reports the list changed after the close (DT-11)', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { soldListVerified: false })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);
      expect(statusOf(service, 'soldList')).toBe('failed');

      await service.recompute();

      expect(statusOf(service, 'soldList')).toBe('failed');
      expect(detailOf(service, 'soldList')).toContain('ya no coincide');
      expect(service.localResult()).toBeNull();
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('fails when the raffle names another drand chain', async () => {
      const vector = DRAW_VECTORS[0];
      const { service, drandCalls } = setUp({
        verification: () => of(verificationOf(vector, { drandChainHash: 'ee'.repeat(32) })),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'drandRound')).toBe('failed');
      expect(drandCalls()).toEqual([]);
      expect(service.verdict()).toBe('failed');
    });

    it('shows a visible discrepancy when the official winner differs from the local one', async () => {
      const vector = DRAW_VECTORS[0];
      const data = verificationOf(vector);
      const { service } = setUp({
        verification: () => of({ ...data, official: { ...data.official, winningNumber: 7, winnerIndex: 6 } }),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'winner')).toBe('passed');
      expect(statusOf(service, 'official')).toBe('failed');
      expect(detailOf(service, 'official')).toBe(
        'El resultado oficial NO coincide con tu cálculo: oficial 7, tu navegador 3.',
      );
      expect(service.verdict()).toBe('mismatch');
    });

    it('treats official randomness that is not the drand value as a discrepancy', async () => {
      const vector = DRAW_VECTORS[0];
      const data = verificationOf(vector);
      const { service } = setUp({
        verification: () => of({ ...data, official: { ...data.official, drandRandomness: 'cd'.repeat(32) } }),
        rounds: vectorRound(vector.drandRandomnessHex),
      });
      await service.load(vector.raffleId);

      await service.recompute();

      expect(statusOf(service, 'official')).toBe('failed');
      expect(service.verdict()).toBe('mismatch');
    });
  });

  describe('cancellation', () => {
    const neverPublished = {
      [roundUrl(RELAYS[0])]: { status: 425 },
      [roundUrl(RELAYS[1])]: { status: 425 },
    };

    it('stops asking drand, and leaves no timer, once the page is left mid-poll', async () => {
      useFakePollTimers();
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: neverPublished,
        pollIntervalMs: 1000,
        maxWaitMs: 60_000,
      });
      await settled(service.load(DRAW_VECTORS[3].raffleId));
      const recomputed = service.recompute();
      await advanceUntil(() => (service.roundProgress()?.attempt ?? 0) >= 2);
      const asked = drandCalls().length;

      TestBed.resetTestingModule();
      await advanceBy(60_000, 1000);

      await recomputed;

      expect(drandCalls()).toHaveLength(asked);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a reload during polling stops the old run, which never writes into the new one', async () => {
      useFakePollTimers();
      const { service, drandCalls } = setUp({
        verification: () => of(verificationWithRealRound()),
        relays: neverPublished,
        pollIntervalMs: 1000,
        maxWaitMs: 4000,
      });
      await settled(service.load(DRAW_VECTORS[3].raffleId));
      const polling = service.recompute();
      await advanceUntil(() => service.roundProgress()?.attempt === 1);

      await settled(service.load(DRAW_VECTORS[3].raffleId));
      const asked = drandCalls().length;
      await advanceBy(60_000, 1000);
      await polling;

      expect(drandCalls()).toHaveLength(asked);
      expect(service.state()).toEqual({ kind: 'loaded' });
      expect(service.running()).toBe(false);
      expect(statusOf(service, 'drandRound')).toBe('pending');
      expect(service.roundProgress()).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a second recompute aborts the first, whose late answer is ignored', async () => {
      const vector = DRAW_VECTORS[0];
      const answers: ((round: VerifiedRound) => void)[] = [];
      const signals: AbortSignal[] = [];
      const { service } = setUp({
        verification: () => of(verificationOf(vector)),
        rounds: (_round, options) => {
          signals.push(options.signal as AbortSignal);
          return new Promise((resolve) => answers.push(resolve));
        },
      });
      await service.load(vector.raffleId);

      const first = service.recompute();
      await vi.waitFor(() => expect(answers).toHaveLength(1));
      const second = service.recompute();
      await vi.waitFor(() => expect(answers).toHaveLength(2));
      expect(signals[0].aborted).toBe(true);

      answers[1]({ round: '1000000', randomness: vector.drandRandomnessHex, signature: 'ab'.repeat(48) });
      await second;
      // The first run's drand answer arrives late and would not match.
      answers[0]({ round: '1000000', randomness: 'cd'.repeat(32), signature: 'ab'.repeat(48) });
      await first;

      expect(service.verdict()).toBe('match');
      expect(service.localResult()?.winner).toBe(vector.expected.winner);
      expect(service.running()).toBe(false);
    });

    it('recomputes multi-attempt sequential sampling and populates localSequence', async () => {
      const vector = DRAW_VECTORS[0];
      const baseData = verificationOf(vector);
      const multiData = {
        ...baseData,
        winningAttempt: 3,
        official: {
          ...baseData.official,
          winningNumber: 10,
          winnerIndex: 9,
          digestHex: '464f3b1aa828540e8dd2d10987b775fd7fd4472896433984cb1c9a716d89f097',
          winningAttempt: 3,
        },
      };
      const { service } = setUp({
        verification: () => of(multiData),
        rounds: vectorRound(vector.drandRandomnessHex),
      });

      await service.load(vector.raffleId);
      await service.recompute();

      expect(service.verdict()).toBe('match');
      expect(service.localSequence()).not.toBeNull();
      expect(service.localSequence()?.extractions).toHaveLength(3);
      expect(service.localSequence()?.extractions[0].isWinner).toBe(false);
      expect(service.localSequence()?.extractions[1].isWinner).toBe(false);
      expect(service.localSequence()?.extractions[2].isWinner).toBe(true);
      expect(service.localResult()?.winner).toBe(service.localSequence()?.winningTicket);
    });
  });
});
