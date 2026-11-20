import { FakeAuditLog } from './fake-audit-log';

describe('FakeAuditLog.firstOfType', () => {
  it('returns the earliest event of that type for the raffle', async () => {
    const log = new FakeAuditLog();
    await log.record({ raffleId: 'r-1', type: 'OTHER', data: {} });
    await log.record({ raffleId: 'r-2', type: 'LIVE_DRAW_STARTED', data: { n: 0 } });
    await log.record({ raffleId: 'r-1', type: 'LIVE_DRAW_STARTED', data: { n: 1 } });
    await log.record({ raffleId: 'r-1', type: 'LIVE_DRAW_STARTED', data: { n: 2 } });

    expect((await log.firstOfType('r-1', 'LIVE_DRAW_STARTED'))?.data).toEqual({ n: 1 });
    expect(await log.firstOfType('r-1', 'MISSING')).toBeNull();
  });
});
