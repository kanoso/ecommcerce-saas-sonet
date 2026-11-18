import { RaffleValidationError, WinnerExclusionMode } from '../../domain';
import { FakeAuditLog, FakeClock, InMemoryRaffleRepository } from '../fakes';
import { CreateRaffleUseCase } from './create-raffle.use-case';
import { UpdateDraftRaffleUseCase } from './update-draft-raffle.use-case';

describe('Raffle prize commands', () => {
  let raffleRepo: InMemoryRaffleRepository;
  let auditLog: FakeAuditLog;
  let create: CreateRaffleUseCase;
  let update: UpdateDraftRaffleUseCase;

  beforeEach(() => {
    raffleRepo = new InMemoryRaffleRepository();
    auditLog = new FakeAuditLog();
    const clock = new FakeClock(new Date('2026-11-17T10:00:00Z'));
    create = new CreateRaffleUseCase(raffleRepo, auditLog, clock);
    update = new UpdateDraftRaffleUseCase(raffleRepo, auditLog, clock);
  });

  const base = {
    id: 'r-1',
    title: 'Rifa',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 100,
  };

  it('creates a raffle with an ordered prize list and an exclusion mode', async () => {
    const raffle = await create.execute({
      ...base,
      prizes: [
        { title: 'Auto', description: 'Rojo', images: ['https://x/a.png'] },
        { title: 'Moto' },
      ],
      winnerExclusionMode: WinnerExclusionMode.BUYER,
    });

    expect(raffle.prizes.map((p) => [p.position, p.title])).toEqual([
      [1, 'Auto'],
      [2, 'Moto'],
    ]);
    expect(new Set(raffle.prizes.map((p) => p.id)).size).toBe(2);
    expect(raffle.prize).toBe('Auto');
    expect(raffle.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
    const created = (await auditLog.findByRaffleId('r-1')).find((e) => e.type === 'RAFFLE_CREATED');
    expect(created?.data).toMatchObject({
      winnerExclusionMode: 'BUYER',
      prizes: [
        { position: 1, title: 'Auto' },
        { position: 2, title: 'Moto' },
      ],
    });
  });

  it('still creates a single-prize raffle from the legacy prize field', async () => {
    const raffle = await create.execute({ ...base, prize: 'Auto' });
    expect(raffle.prizes).toHaveLength(1);
    expect(raffle.prizes[0].title).toBe('Auto');
    expect(raffle.winnerExclusionMode).toBe(WinnerExclusionMode.TICKET_ONLY);
  });

  it('requires a prize', async () => {
    await expect(create.execute({ ...base })).rejects.toBeInstanceOf(RaffleValidationError);
  });

  it('replaces the prize list of a draft and audits it', async () => {
    await create.execute({ ...base, prize: 'Auto' });

    const raffle = await update.execute({
      raffleId: 'r-1',
      prizes: [{ title: 'Moto' }, { title: 'Auto' }, { title: 'Bici' }],
      winnerExclusionMode: WinnerExclusionMode.BUYER,
    });

    expect(raffle.prizes.map((p) => p.title)).toEqual(['Moto', 'Auto', 'Bici']);
    expect(raffle.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
    const updated = (await auditLog.findByRaffleId('r-1')).find(
      (e) => e.type === 'RAFFLE_DRAFT_UPDATED',
    );
    expect(updated?.data).toMatchObject({ winnerExclusionMode: 'BUYER' });
    expect((updated?.data as { prizes: unknown[] }).prizes).toHaveLength(3);
  });
});
