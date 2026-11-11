import { BankOrWallet, InvalidOperatorIdError } from '../../domain';
import {
  FakeAuditLog,
  FakeClock,
  InMemoryOperatorAlertRepository,
  InMemoryOrderRepository,
  InMemoryPaymentRepository,
  InMemoryRaffleRepository,
  InMemoryRefundRepository,
  InMemoryTicketLedger,
  InMemoryTicketRepository,
} from '../fakes';
import { ApprovePaymentUseCase } from './approve-payment.use-case';
import { CancelAlteredRaffleUseCase } from './cancel-altered-raffle.use-case';
import { CompleteRefundUseCase } from './complete-refund.use-case';
import { ConfirmLatePaymentUseCase } from './confirm-late-payment.use-case';
import { DismissLatePaymentUseCase } from './dismiss-late-payment.use-case';
import { MarkOperatorAlertReadUseCase } from './mark-operator-alert-read.use-case';
import { RecordExtraTransferUseCase } from './record-extra-transfer.use-case';
import { RejectPaymentUseCase } from './reject-payment.use-case';
import { RequeueFailedNotificationUseCase } from './requeue-failed-notification.use-case';

/**
 * Every use case that records an operator checks the id first, before it reads
 * or writes anything: the ids below are missing, so any later check would
 * throw a different error (DT-17).
 */
describe('operator id at the source (DT-17)', () => {
  const clock = new FakeClock(new Date('2026-11-01T10:00:00Z'));
  const orderRepo = new InMemoryOrderRepository();
  const refundRepo = new InMemoryRefundRepository();
  const alertRepo = new InMemoryOperatorAlertRepository();
  const ledger = new InMemoryTicketLedger(
    new InMemoryRaffleRepository(),
    new InMemoryTicketRepository(),
    orderRepo,
    new InMemoryPaymentRepository(),
    new FakeAuditLog(),
    refundRepo,
    alertRepo,
  );
  const money = {
    receivedAmount: 10,
    bankOrWallet: BankOrWallet.BCP,
    operationNumber: 'OP-1',
  };

  const useCases: [string, (operatorId: string) => Promise<unknown>][] = [
    [
      'ApprovePayment',
      (operatorId) =>
        new ApprovePaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'missing',
          operatorId,
          operationNumber: 'OP-1',
          receivedAmount: 10,
        }),
    ],
    [
      'RejectPayment',
      (operatorId) =>
        new RejectPaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'missing',
          operatorId,
          reason: 'No money',
          moneyReceived: false,
        }),
    ],
    [
      'ConfirmLatePayment',
      (operatorId) =>
        new ConfirmLatePaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'missing',
          operatorId,
          ...money,
        }),
    ],
    [
      'DismissLatePayment',
      (operatorId) =>
        new DismissLatePaymentUseCase(orderRepo, ledger, clock).execute({
          orderId: 'missing',
          operatorId,
          reason: 'No money',
        }),
    ],
    [
      'RecordExtraTransfer',
      (operatorId) =>
        new RecordExtraTransferUseCase(orderRepo, ledger, clock).execute({
          orderId: 'missing',
          operatorId,
          reason: 'Twice',
          ...money,
        }),
    ],
    [
      'CompleteRefund',
      (operatorId) =>
        new CompleteRefundUseCase(refundRepo, ledger, clock).execute({
          refundId: 'missing',
          operatorId,
          destination: 'Yape 1',
          operationNumber: 'R-1',
        }),
    ],
    [
      'CancelAlteredRaffle',
      (operatorId) =>
        new CancelAlteredRaffleUseCase(ledger, clock).execute({
          raffleId: 'missing',
          operatorId,
          reason: 'Altered',
        }),
    ],
    [
      'MarkOperatorAlertRead',
      (operatorId) =>
        new MarkOperatorAlertReadUseCase(alertRepo, clock).execute({
          alertId: 'missing',
          operatorId,
        }),
    ],
    [
      'RequeueFailedNotification',
      (operatorId) =>
        new RequeueFailedNotificationUseCase(ledger, clock).execute({
          notificationId: 'missing',
          operatorId,
        }),
    ],
  ];

  describe.each(useCases)('%s', (_, run) => {
    it.each([
      ['empty', ''],
      ['a space inside', 'admin 1'],
      ['a pipe', 'auth0|abc'],
      ['a non-breaking space', 'admin 1'],
    ])(
      'refuses an operator id with %s before anything else',
      async (__, id) => {
        await expect(run(id)).rejects.toThrow(InvalidOperatorIdError);
      },
    );

    it('accepts a valid id written with capitals and spaces around', async () => {
      await expect(run('  Admin-1 ')).rejects.not.toThrow(
        InvalidOperatorIdError,
      );
    });
  });
});
