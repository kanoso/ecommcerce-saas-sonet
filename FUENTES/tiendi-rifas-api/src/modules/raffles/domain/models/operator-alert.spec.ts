import { OperatorAlertType } from '../enums/raffle-status.enum';
import { OperatorAlert } from './operator-alert';

describe('OperatorAlert', () => {
  const createdAt = new Date('2026-11-01T10:00:00Z');

  const alert = () =>
    new OperatorAlert({
      id: 'alert-1',
      type: OperatorAlertType.LATE_PAYMENT_CLAIM,
      raffleId: 'raffle-1',
      raffleTitle: 'Rifa Departamento',
      orderId: 'order-1',
      amount: 100,
      createdAt,
    });

  it('starts unread', () => {
    const fresh = alert();

    expect(fresh.readAt).toBeNull();
    expect(fresh.readBy).toBeNull();
  });

  it('records who read it and when', () => {
    const read = alert();
    const now = new Date('2026-11-01T11:00:00Z');

    read.markRead('admin-1', now);

    expect(read.readAt).toEqual(now);
    expect(read.readBy).toBe('admin-1');
  });

  it('keeps the first reader when marked again', () => {
    const read = alert();
    const first = new Date('2026-11-01T11:00:00Z');
    read.markRead('admin-1', first);

    read.markRead('admin-2', new Date('2026-11-01T12:00:00Z'));

    expect(read.readAt).toEqual(first);
    expect(read.readBy).toBe('admin-1');
  });

  it('defaults reason to null if omitted', () => {
    const fresh = alert();
    expect(fresh.reason).toBeNull();
  });

  it('retains specified reason', () => {
    const withReason = new OperatorAlert({
      id: 'alert-2',
      type: OperatorAlertType.NOTIFICATION_FAILED,
      raffleId: 'raffle-1',
      raffleTitle: 'Rifa Departamento',
      orderId: 'order-1',
      amount: 100,
      createdAt,
      reason: 'El comprador no tiene correo electrónico registrado',
    });

    expect(withReason.reason).toBe('El comprador no tiene correo electrónico registrado');
  });
});

