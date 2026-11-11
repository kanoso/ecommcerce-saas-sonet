import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { ApiError } from '../../core/api/api-error';
import { RaffleStatusInfo, VerificationData } from '../../core/api/api.models';
import { RafflesApi } from '../../core/api/raffles-api';
import { OrdersApi } from '../../core/api/orders-api';
import { DrandClient, DrandRoundUnavailableError, VerifiedRound } from '../../core/drand/drand-client';
import { SESSION_STORAGE } from '../../core/session/session.store';
import { memoryStorage } from '../../core/session/testing/memory-storage';
import { DrawVerification, VERIFICATION_TIMING } from '../../core/verification/draw-verification';
import { DRAW_VECTORS, verificationOf } from '../../core/verification/testing/verification.fixture';
import { VerificationPage } from './verification.page';

const VECTOR = DRAW_VECTORS[0];
const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

interface Setup {
  verification?: () => Observable<VerificationData>;
  statusInfo?: () => Observable<RaffleStatusInfo>;
  getRound?: (round: string) => Promise<VerifiedRound>;
  storage?: Storage | null;
}

async function render(setup: Setup = {}) {
  TestBed.configureTestingModule({
    imports: [VerificationPage],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: VECTOR.raffleId }) } } },
      {
        provide: RafflesApi,
        useValue: {
          verification: setup.verification ?? (() => of(verificationOf(VECTOR))),
          statusInfo: setup.statusInfo ?? (() => throwError(() => new Error('unexpected'))),
        },
      },
      { provide: OrdersApi, useValue: { myTickets: () => of([]) } },
      { provide: SESSION_STORAGE, useValue: setup.storage === undefined ? memoryStorage() : setup.storage },
      {
        provide: DrandClient,
        useValue: {
          pollRound:
            setup.getRound ??
            (async (round: string) => ({ round, randomness: VECTOR.drandRandomnessHex, signature: 'ab'.repeat(48) })),
        },
      },
      { provide: VERIFICATION_TIMING, useValue: { pollIntervalMs: 0, maxWaitMs: 0 } },
    ],
  });
  const fixture = TestBed.createComponent(VerificationPage);
  fixture.detectChanges();
  await settle(fixture);
  return fixture;
}

/** Web Crypto answers asynchronously: wait until nothing is loading or running. */
async function settle(fixture: { debugElement: { injector: { get<T>(token: unknown): T } }; detectChanges(): void }) {
  const verification = fixture.debugElement.injector.get<DrawVerification>(DrawVerification);
  await vi.waitFor(() => {
    const busy =
      verification.state().kind === 'loading' ||
      verification.running() ||
      verification.checks().some((check) => check.status === 'running');
    if (busy) {
      throw new Error('still verifying');
    }
  });
  fixture.detectChanges();
}

type Fixture = Awaited<ReturnType<typeof render>>;
const el = (fixture: Fixture): HTMLElement => fixture.nativeElement;
const button = (fixture: Fixture, name: string) =>
  [...el(fixture).querySelectorAll('button')].find((b) => textOf(b) === name) as HTMLButtonElement | undefined;
const checkItem = (fixture: Fixture, label: string) =>
  [...el(fixture).querySelectorAll('[aria-label="Comprobaciones en tu navegador"] li')].find((li) =>
    textOf(li).startsWith(label),
  );

async function recompute(fixture: Fixture) {
  button(fixture, 'Recalcular en mi navegador')?.click();
  await settle(fixture);
}

describe('VerificationPage', () => {
  it('shows the official winner, the public data and the algorithm with its values', async () => {
    const fixture = await render();
    const page = el(fixture);

    expect(textOf(page.querySelector('h1'))).toBe('Verificación del sorteo');
    expect(textOf(page.querySelector('.winner__number'))).toBe('3');
    expect(textOf(page.querySelector('.winner'))).toContain('Smart TV 55"');
    // 01:30:03 UTC is 20:30:03 of the day before in Lima.
    expect(textOf(page.querySelector('.winner'))).toContain('Sorteado el 15 nov., 20:30:03');
    const data = textOf(page.querySelector('[aria-label="Datos públicos"]'));
    for (const value of [
      VECTOR.expected.commitmentHash,
      VECTOR.seedHex,
      VECTOR.expected.soldListHash,
      '#1000000',
      VECTOR.drandRandomnessHex,
      'v1',
      'RD-123-2026',
    ]) {
      expect(data).toContain(value);
    }
    expect(data).toContain('10 vendidos');
    const algorithm = textOf(page.querySelector('.algorithm'));
    expect(algorithm).toContain(VECTOR.expected.digestHex);
    expect(algorithm).toContain('i = h mod 10 = 2');
    expect(algorithm).toContain('ganador = vendidos[2] = 3');
  });

  it('checks the commitment and the list on arrival and leaves drand for the button', async () => {
    const fixture = await render();

    expect(textOf(checkItem(fixture, 'Semilla y compromiso') ?? null)).toContain('Correcto');
    expect(textOf(checkItem(fixture, 'Lista de vendidos') ?? null)).toContain('Correcto');
    expect(textOf(checkItem(fixture, 'Ronda de drand y firma BLS') ?? null)).toContain('Pendiente');
  });

  it('recomputes everything in the browser and says it matches the official result', async () => {
    const fixture = await render();

    await recompute(fixture);

    expect(textOf(checkItem(fixture, 'Ronda de drand y firma BLS') ?? null)).toContain('Correcto');
    expect(textOf(checkItem(fixture, 'Ganador calculado en tu navegador') ?? null)).toContain('Número 3');
    const verdict = el(fixture).querySelector('.verdict--match');
    expect(verdict?.getAttribute('role')).toBe('status');
    expect(textOf(verdict)).toContain('Tu navegador obtuvo el mismo ganador: 3');
    expect(textOf(verdict)).toContain('Coincide con el resultado oficial');
    expect(textOf(el(fixture).querySelector('[aria-label="Datos públicos"]'))).toContain('Firma BLS');
  });

  it('alerts when the official result does not match the local one', async () => {
    const data = verificationOf(VECTOR);
    const fixture = await render({
      verification: () => of({ ...data, official: { ...data.official, winningNumber: 7 } }),
    });

    await recompute(fixture);

    const alert = el(fixture).querySelector('.verdict--mismatch');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(textOf(alert)).toContain('El resultado oficial NO coincide con tu cálculo');
  });

  it('shows a failed verification, not a winner, when the platform reports the list changed (DT-11)', async () => {
    const fixture = await render({ verification: () => of(verificationOf(VECTOR, { soldListVerified: false })) });
    const page = el(fixture);

    expect(page.querySelector('.winner__number')).toBeNull();
    const alert = page.querySelector('.verdict--failed');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(textOf(alert)).toContain('Verificación fallida');
    expect(textOf(alert)).toContain('ya no coincide');
  });

  it('shows why drand could not be read, and lets the user try again', async () => {
    let calls = 0;
    const fixture = await render({
      getRound: async (round) => {
        calls++;
        if (calls === 1) {
          throw new DrandRoundUnavailableError(round, [{ relay: 'api.drand.sh', reason: 'timeout' }], false);
        }
        return { round, randomness: VECTOR.drandRandomnessHex, signature: 'ab'.repeat(48) };
      },
    });

    await recompute(fixture);

    expect(textOf(el(fixture).querySelector('.verdict--failed'))).toContain('api.drand.sh: no respondió a tiempo');

    await recompute(fixture);

    expect(el(fixture).querySelector('.verdict--match')).not.toBeNull();
  });

  const badge = (fixture: Fixture) => textOf(el(fixture).querySelector('.winner__label'));
  const anchorNote = (fixture: Fixture) => textOf(el(fixture).querySelector('.winner__anchor'));
  const pinnedBefore = (values: Record<string, string>) => {
    const storage = memoryStorage();
    storage.setItem(`tiendi-rifas.pins.${VECTOR.raffleId}`, JSON.stringify(values));
    return storage;
  };
  const typeInto = (fixture: Fixture, label: string, value: string) => {
    const input = [...el(fixture).querySelectorAll('input')].find(
      (i) => textOf(el(fixture).querySelector(`label[for="${i.id}"]`)) === label,
    ) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('on a first visit, a match only says it agrees with drand, not that the winner is verified', async () => {
    const fixture = await render();

    expect(badge(fixture)).toBe('Resultado oficial (sin verificar)');

    await recompute(fixture);

    expect(badge(fixture)).toBe('Coincide con drand');
    expect(anchorNote(fixture)).toBe('(sin ancla previa: compara con los datos de tu correo)');
  });

  it('verifies the winner on a later visit whose values match the ones pinned before', async () => {
    const fixture = await render({ storage: pinnedBefore({ commitmentHash: VECTOR.expected.commitmentHash }) });

    await recompute(fixture);

    expect(badge(fixture)).toBe('Ganador verificado');
    expect(el(fixture).querySelector('.winner__anchor')).toBeNull();
  });

  it('says when the browser keeps no data to anchor with', async () => {
    const fixture = await render({ storage: null });

    await recompute(fixture);

    expect(badge(fixture)).toBe('Coincide con drand');
    expect(anchorNote(fixture)).toContain('tu navegador no guarda datos');
  });

  it('says when the storage throws and does not crash', async () => {
    const refusing = memoryStorage();
    refusing.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const fixture = await render({ storage: refusing });

    await recompute(fixture);

    expect(badge(fixture)).toBe('Coincide con drand');
    expect(anchorNote(fixture)).toContain('tu navegador no guarda datos');
  });

  it('verifies the winner on a first visit when the email values match', async () => {
    const fixture = await render();

    typeInto(fixture, 'Compromiso', VECTOR.expected.commitmentHash);
    typeInto(fixture, 'Ronda de drand', '#1000000');
    typeInto(fixture, 'Fecha del sorteo (ISO 8601)', '2023-09-27T08:29:24.000Z');
    typeInto(fixture, 'Cierre de ventas (ISO 8601)', '2023-09-27T08:00:00.000Z');
    await recompute(fixture);

    const section = el(fixture).querySelector('[aria-label="Datos para verificar tu sorteo"]');
    expect(textOf(section?.querySelector('[role="status"]') ?? null)).toContain('Coincide con tu correo');
    expect(badge(fixture)).toBe('Ganador verificado');
  });

  it('fails visibly, and verifies nothing, when an email value differs', async () => {
    const fixture = await render();

    typeInto(fixture, 'Ronda de drand', '1000001');
    await recompute(fixture);

    const section = el(fixture).querySelector('[aria-label="Datos para verificar tu sorteo"]');
    expect(textOf(section?.querySelector('[role="alert"]') ?? null)).toContain('NO coinciden con tu correo');
    expect(textOf(checkItem(fixture, 'Datos de tu correo') ?? null)).toContain('Falló');
    expect(textOf(el(fixture).querySelector('.verdict--failed'))).toContain('Verificación fallida');
    expect(badge(fixture)).toBe('Resultado oficial (sin verificar)');
  });

  it('says in the result when the buyer numbers were not checked', async () => {
    const fixture = await render();

    await recompute(fixture);

    expect(textOf(el(fixture).querySelector('.verdict--match'))).toContain(
      'No se comprobaron tus números: Inicia sesión para comprobar que tus números están en la lista.',
    );
  });

  it('keeps the official winner unverified when the result does not match', async () => {
    const data = verificationOf(VECTOR);
    const fixture = await render({
      verification: () => of({ ...data, official: { ...data.official, winningNumber: 7 } }),
    });

    await recompute(fixture);

    expect(badge(fixture)).toBe('Resultado oficial (sin verificar)');
  });

  it('lists the round binding and the own-numbers checks', async () => {
    const fixture = await render();

    expect(textOf(checkItem(fixture, 'Ronda fijada por la fecha del sorteo') ?? null)).toContain('Correcto');
    expect(textOf(checkItem(fixture, 'Tus números están en la lista') ?? null)).toContain('Inicia sesión');
  });

  it('warns prominently, and verifies nothing, when the data changed since an earlier visit', async () => {
    const storage = memoryStorage();
    storage.setItem(
      `tiendi-rifas.pins.${VECTOR.raffleId}`,
      JSON.stringify({ commitmentHash: 'ab'.repeat(32), drandRound: '1000000' }),
    );
    const fixture = await render({ storage });

    const alert = el(fixture).querySelector('.pins[role="alert"]');
    expect(textOf(alert)).toContain('cambiaron desde tu visita anterior');
    expect(textOf(alert)).toContain('ab'.repeat(32));
    expect(textOf(alert)).toContain(VECTOR.expected.commitmentHash);

    await recompute(fixture);

    expect(textOf(el(fixture).querySelector('.winner__label'))).toBe('Resultado oficial (sin verificar)');
  });

  it('compares the commitment pasted from the payment email with the published one', async () => {
    const fixture = await render();
    const section = el(fixture).querySelector('[aria-label="Datos para verificar tu sorteo"]') as HTMLElement;
    expect(textOf(section)).toContain('Datos para verificar tu sorteo');

    typeInto(fixture, 'Compromiso', `  ${VECTOR.expected.commitmentHash.toUpperCase()} `);
    expect(textOf(section.querySelector('[role="status"]'))).toContain('Coincide con tu correo: Compromiso');

    typeInto(fixture, 'Compromiso', 'ab'.repeat(32));
    expect(textOf(section.querySelector('[role="alert"]'))).toContain('NO coinciden con tu correo');
  });

  it('offers the sold list as a file whose SHA-256 is the published list hash', async () => {
    const fixture = await render();
    const link = [...el(fixture).querySelectorAll('a')].find((a) => textOf(a) === 'Descargar lista (CSV)');

    expect(link?.getAttribute('download')).toBe(`lista-vendidos-${VECTOR.raffleId}.csv`);
    expect(decodeURIComponent(link?.getAttribute('href') ?? '')).toBe('data:text/csv;charset=utf-8,1,2,3,4,5,6,7,8,9,10');
  });

  it('says when the raffle is not drawn yet', async () => {
    const fixture = await render({
      verification: () => throwError(() => new ApiError(409, 'DRAW_NOT_POSSIBLE', 'x')),
      statusInfo: () => of({ title: 'Moto', status: 'ACTIVE' }),
    });

    expect(textOf(el(fixture).querySelector('[role="status"]'))).toContain('Moto aún no se sortea');
    expect(button(fixture, 'Recalcular en mi navegador')).toBeUndefined();
  });

  it('says when the raffle was cancelled', async () => {
    const fixture = await render({
      verification: () => throwError(() => new ApiError(409, 'DRAW_NOT_POSSIBLE', 'x')),
      statusInfo: () => of({ title: 'Moto', status: 'CANCELLED' }),
    });

    expect(textOf(el(fixture).querySelector('[role="status"]'))).toContain('Moto fue cancelada');
  });

  it('shows a load failure with a retry', async () => {
    const fixture = await render({
      verification: () => throwError(() => new ApiError(0, 'NETWORK_ERROR', 'No pudimos conectarnos.')),
    });

    expect(textOf(el(fixture).querySelector('[role="alert"]'))).toContain('No pudimos conectarnos.');
    expect(button(fixture, 'Reintentar')).toBeDefined();
  });

  it('renders the interactive audit stack for multi-attempt extractions', async () => {
    const multiData: VerificationData = {
      ...verificationOf(VECTOR),
      winningAttempt: 3,
      extractions: [
        { attempt: 1, number: 3, index: 2, digestHex: '51431b5cdb2205f0058716eca1cf52f8f8761482cecfb730ac70dcbef992857c', isWinner: false },
        { attempt: 2, number: 8, index: 7, digestHex: '62da4920caf73dfd33e18a62d462df1fb000af1f3cc2fa7b646d70c371f2ffb4', isWinner: false },
        { attempt: 3, number: 10, index: 9, digestHex: '464f3b1aa828540e8dd2d10987b775fd7fd4472896433984cb1c9a716d89f097', isWinner: true },
      ],
      official: {
        ...verificationOf(VECTOR).official,
        winningNumber: 10,
        winnerIndex: 9,
        digestHex: '464f3b1aa828540e8dd2d10987b775fd7fd4472896433984cb1c9a716d89f097',
        winningAttempt: 3,
      },
    };
    const fixture = await render({ verification: () => of(multiData) });
    const page = el(fixture);

    const auditSection = page.querySelector('.extractions-audit');
    expect(auditSection).not.toBeNull();
    expect(textOf(auditSection)).toContain('Auditoría de intentos sucesivos (3 intentos)');
    expect(textOf(auditSection)).toContain('Intento #1');
    expect(textOf(auditSection)).toContain('¡Al agua!');
    expect(textOf(auditSection)).toContain('Intento #3');
    expect(textOf(auditSection)).toContain('¡Ganador Oficial!');
  });
});
