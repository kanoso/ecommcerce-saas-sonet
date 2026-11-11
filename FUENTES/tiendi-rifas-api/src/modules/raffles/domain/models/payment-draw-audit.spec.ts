import { AuditEvent } from './audit-event';
import { Draw } from './draw';
import { Payment } from './payment';

describe('Payment, Draw, and AuditEvent Domain Models', () => {
  it('instantiates Payment with all properties correctly', () => {
    const payment = new Payment({
      id: 'pay-1',
      orderId: 'order-1',
      provider: 'YAPE',
      externalId: 'OP-123',
      status: 'PAID',
      payload: { amount: 5000 },
      receivedAt: new Date('2026-11-01T10:05:00Z'),
    });

    expect(payment.id).toBe('pay-1');
    expect(payment.orderId).toBe('order-1');
    expect(payment.provider).toBe('YAPE');
    expect(payment.externalId).toBe('OP-123');
    expect(payment.status).toBe('PAID');
    expect(payment.payload).toEqual({ amount: 5000 });
    expect(payment.receivedAt).toEqual(new Date('2026-11-01T10:05:00Z'));
  });

  it('instantiates Draw with all properties correctly', () => {
    const draw = new Draw({
      id: 'draw-1',
      raffleId: 'raffle-1',
      algorithmVersion: 'v1',
      seedRevealed: 'seed123',
      drandRandomness: 'drand123',
      drandRound: 1000n,
      digestHex: 'digest123',
      totalSold: 10,
      winningTicketId: 'ticket-7',
      winningNumber: 7,
      winnerIndex: 2,
      executedAt: new Date('2026-11-01T20:00:00Z'),
    });

    expect(draw.id).toBe('draw-1');
    expect(draw.raffleId).toBe('raffle-1');
    expect(draw.algorithmVersion).toBe('v1');
    expect(draw.seedRevealed).toBe('seed123');
    expect(draw.drandRandomness).toBe('drand123');
    expect(draw.drandRound).toBe(1000n);
    expect(draw.digestHex).toBe('digest123');
    expect(draw.totalSold).toBe(10);
    expect(draw.winningTicketId).toBe('ticket-7');
    expect(draw.winningNumber).toBe(7);
    expect(draw.winnerIndex).toBe(2);
    expect(draw.executedAt).toEqual(new Date('2026-11-01T20:00:00Z'));
  });

  it('instantiates AuditEvent with immutable properties', () => {
    const event = new AuditEvent({
      id: 'evt-1',
      raffleId: 'raffle-1',
      type: 'TICKETS_RESERVED',
      data: { numbers: [1, 2] },
      occurredAt: new Date('2026-11-01T10:00:00Z'),
    });

    expect(event.id).toBe('evt-1');
    expect(event.raffleId).toBe('raffle-1');
    expect(event.type).toBe('TICKETS_RESERVED');
    expect(event.data).toEqual({ numbers: [1, 2] });
    expect(event.occurredAt).toEqual(new Date('2026-11-01T10:00:00Z'));
  });
});
