import { MyTicket } from '../../core/api/api.models';
import { UNKNOWN_RAFFLE_TITLE, groupTicketsByRaffle } from './my-tickets.model';

const aTicket = (overrides: Partial<MyTicket> = {}): MyTicket => ({
  orderId: 'o-1',
  raffleId: 'r-1',
  raffleTitle: 'Smart TV',
  numbers: [7],
  status: 'PAID',
  totalAmount: 10,
  expiresAt: new Date('2026-11-03T15:15:00.000Z'),
  ...overrides,
});

describe('groupTicketsByRaffle', () => {
  it('groups the orders of each raffle under its title, newest raffle first', () => {
    const groups = groupTicketsByRaffle([
      aTicket({ orderId: 'o-3', raffleId: 'r-2', raffleTitle: 'Moto' }),
      aTicket({ orderId: 'o-2', raffleId: 'r-1' }),
      aTicket({ orderId: 'o-1', raffleId: 'r-2', raffleTitle: 'Moto' }),
    ]);
    expect(groups.map((g) => [g.raffleId, g.raffleTitle, g.orders.map((o) => o.orderId)])).toEqual([
      ['r-2', 'Moto', ['o-3', 'o-1']],
      ['r-1', 'Smart TV', ['o-2']],
    ]);
  });

  it('puts the orders that still need payment first, in their raffle and among raffles', () => {
    const groups = groupTicketsByRaffle([
      aTicket({ orderId: 'o-4', raffleId: 'r-1', status: 'PAID' }),
      aTicket({ orderId: 'o-3', raffleId: 'r-2', raffleTitle: 'Moto', status: 'REJECTED' }),
      aTicket({ orderId: 'o-2', raffleId: 'r-2', raffleTitle: 'Moto', status: 'PENDING' }),
      aTicket({ orderId: 'o-1', raffleId: 'r-1', status: 'EXPIRED' }),
    ]);
    expect(groups.map((g) => g.orders.map((o) => o.orderId))).toEqual([
      ['o-2', 'o-3'],
      ['o-4', 'o-1'],
    ]);
  });

  it('shows each order with its status label, sorted numbers and total in whole cents', () => {
    const [group] = groupTicketsByRaffle([
      aTicket({ numbers: [23, 7, 105], status: 'PENDING_VERIFICATION', totalAmount: 0.3 }),
    ]);
    expect(group.orders[0]).toEqual({
      orderId: 'o-1',
      raffleId: 'r-1',
      numbers: [7, 23, 105],
      phase: 'verifying',
      statusLabel: 'Comprobante en verificación',
      totalCents: 30,
      needsPayment: false,
      canClaimLatePayment: false,
      deadline: null,
    });
  });

  it('asks for payment only while the order awaits its proof', () => {
    const statuses = ['PENDING', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'REFUND_PENDING', 'EXPIRED', 'NEW_ONE'];
    const groups = groupTicketsByRaffle(statuses.map((status, i) => aTicket({ orderId: `o-${i}`, status })));
    const needs = Object.fromEntries(
      groups[0].orders.map((o) => [statuses[Number(o.orderId.slice(2))], o.needsPayment]),
    );
    expect(needs).toEqual({
      PENDING: true,
      PENDING_VERIFICATION: false,
      PAID: false,
      REJECTED: false,
      REFUND_PENDING: false,
      EXPIRED: false,
      NEW_ONE: false,
    });
  });

  it('keeps the reservation deadline only on an order that still needs payment', () => {
    const [group] = groupTicketsByRaffle([
      aTicket({ orderId: 'o-1', status: 'PENDING' }),
      aTicket({ orderId: 'o-2', status: 'PAID' }),
      aTicket({ orderId: 'o-3', status: 'PENDING', expiresAt: null }),
    ]);
    expect(group.orders.map((o) => [o.orderId, o.deadline])).toEqual([
      ['o-1', new Date('2026-11-03T15:15:00.000Z')],
      ['o-3', null],
      ['o-2', null],
    ]);
  });

  it('names a raffle the API no longer finds', () => {
    const [group] = groupTicketsByRaffle([aTicket({ raffleTitle: '  ' })]);
    expect(group.raffleTitle).toBe(UNKNOWN_RAFFLE_TITLE);
  });

  it('does not change the list it was given', () => {
    const tickets = [aTicket({ numbers: [9, 1] })];
    groupTicketsByRaffle(tickets);
    expect(tickets[0].numbers).toEqual([9, 1]);
  });

  it('returns no groups for no orders', () => {
    expect(groupTicketsByRaffle([])).toEqual([]);
  });
  it('allows late payment claim only on EXPIRED orders', () => {
    const statuses = ['PENDING', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'REFUND_PENDING', 'EXPIRED'];
    const groups = groupTicketsByRaffle(statuses.map((status, i) => aTicket({ orderId: `o-${i}`, status })));
    const claimable = Object.fromEntries(
      groups[0].orders.map((o) => [statuses[Number(o.orderId.slice(2))], o.canClaimLatePayment]),
    );
    expect(claimable).toEqual({
      PENDING: false,
      PENDING_VERIFICATION: false,
      PAID: false,
      REJECTED: false,
      REFUND_PENDING: false,
      EXPIRED: true,
    });
  });

});
