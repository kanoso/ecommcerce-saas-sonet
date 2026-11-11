import { Logger } from '@nestjs/common';
import { soldListHash } from '@kanoso/raffle-draw';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  FakeNotifier,
  FakeRandomnessBeacon,
  FakeSeedVault,
} from '../src/modules/raffles/application/fakes';
import {
  LedgerTransaction,
  NotificationMessage,
  NotificationStatus,
  NotificationType,
  TicketLedger,
} from '../src/modules/raffles/application/ports';
import { AlertOverdueVerificationsUseCase } from '../src/modules/raffles/application/use-cases/alert-overdue-verifications.use-case';
import {
  ApprovePaymentCommand,
  ApprovePaymentUseCase,
} from '../src/modules/raffles/application/use-cases/approve-payment.use-case';
import { CancelAlteredRaffleUseCase } from '../src/modules/raffles/application/use-cases/cancel-altered-raffle.use-case';
import { CancelRaffleUseCase } from '../src/modules/raffles/application/use-cases/cancel-raffle.use-case';
import { ClaimLatePaymentUseCase } from '../src/modules/raffles/application/use-cases/claim-late-payment.use-case';
import { CloseSalesUseCase } from '../src/modules/raffles/application/use-cases/close-sales.use-case';
import { CompleteRefundUseCase } from '../src/modules/raffles/application/use-cases/complete-refund.use-case';
import { ConfirmLatePaymentUseCase } from '../src/modules/raffles/application/use-cases/confirm-late-payment.use-case';
import { DismissLatePaymentUseCase } from '../src/modules/raffles/application/use-cases/dismiss-late-payment.use-case';
import { DispatchNotificationsUseCase } from '../src/modules/raffles/application/use-cases/dispatch-notifications.use-case';
import { PurgeSentNotificationsUseCase } from '../src/modules/raffles/application/use-cases/purge-sent-notifications.use-case';
import { RequeueFailedNotificationUseCase } from '../src/modules/raffles/application/use-cases/requeue-failed-notification.use-case';
import { ExecuteDrawUseCase } from '../src/modules/raffles/application/use-cases/execute-draw.use-case';
import { GetPaymentProofUseCase } from '../src/modules/raffles/application/use-cases/get-payment-proof.use-case';
import { GetVerificationDataUseCase } from '../src/modules/raffles/application/use-cases/get-verification-data.use-case';
import { ListLatePaymentClaimsUseCase } from '../src/modules/raffles/application/use-cases/list-late-payment-claims.use-case';
import { ListOperationCollisionsUseCase } from '../src/modules/raffles/application/use-cases/list-operation-collisions.use-case';
import { ListUnreadOperatorAlertsUseCase } from '../src/modules/raffles/application/use-cases/list-unread-operator-alerts.use-case';
import { MarkOperatorAlertReadUseCase } from '../src/modules/raffles/application/use-cases/mark-operator-alert-read.use-case';
import { PublishRaffleUseCase } from '../src/modules/raffles/application/use-cases/publish-raffle.use-case';
import { RAFFLE_CANCELLED_BUYER_REASON } from '../src/modules/raffles/application/use-cases/buyer-reasons';
import { RecordExtraTransferUseCase } from '../src/modules/raffles/application/use-cases/record-extra-transfer.use-case';
import { RejectPaymentUseCase } from '../src/modules/raffles/application/use-cases/reject-payment.use-case';
import { ReleaseExpiredReservationsUseCase } from '../src/modules/raffles/application/use-cases/release-expired-reservations.use-case';
import { ReserveTicketsUseCase } from '../src/modules/raffles/application/use-cases/reserve-tickets.use-case';
import { SubmitPaymentProofUseCase } from '../src/modules/raffles/application/use-cases/submit-payment-proof.use-case';
import {
  BankOrWallet,
  ConflictingRejectionError,
  DuplicateOperatorAlertError,
  DuplicatePaymentError,
  ExtraTransferNotAcceptedError,
  PaymentAmountMismatchError,
  PaymentAccountChangedError,
  PaymentAccountUnavailableError,
  InvalidOperationCollisionError,
  InvalidOperationNumberError,
  InvalidOrderTransitionError,
  InvalidPaymentProofError,
  InvalidRaffleTransitionError,
  NotOrderOwnerError,
  OperatorAlert,
  OperatorAlertNotFoundError,
  OperatorAlertType,
  OrderStatus,
  OverpaymentNotConfirmedError,
  SameOperatorRefundError,
  InvalidOperatorIdError,
  IntegrityGuardError,
  OrderMoneyAlreadyRecordedError,
  Payment,
  NotificationRetryPolicy,
  ProofPolicy,
  RaffleNotActiveError,
  Refund,
  ReservationPolicy,
  ReservationsClosedError,
  SalesClosedError,
  SoldListIntactError,
  SoldListMismatchError,
  StaleStateError,
  TicketNotAvailableError,
  TicketOrder,
  TicketReservationLimitError,
  TicketStatus,
} from '../src/modules/raffles/domain';
import { PrismaAuditLog } from '../src/modules/raffles/infrastructure/persistence/prisma-audit-log';
import {
  PrismaNotificationOutbox,
  claimDueSql,
  exhaustedSql,
} from '../src/modules/raffles/infrastructure/persistence/prisma-notification-outbox';
import { Prisma } from '@prisma/client';
import { PrismaDrawRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-draw.repository';
import { PrismaOperatorAlertRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-operator-alert.repository';
import { PrismaOrderRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-order.repository';
import { PrismaPaymentRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-payment.repository';
import { PrismaRaffleRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-raffle.repository';
import { PrismaRefundRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-refund.repository';
import { PrismaReservationStore } from '../src/modules/raffles/infrastructure/persistence/prisma-reservation.store';
import { PrismaTicketLedger } from '../src/modules/raffles/infrastructure/persistence/prisma-ticket-ledger';
import { PrismaTicketRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-ticket.repository';
import { PrismaService } from '../src/modules/raffles/infrastructure/persistence/prisma.service';
import { PrismaPaymentAccountRepository } from '../src/modules/raffles/infrastructure/persistence/prisma-payment-account.repository';
import {
  ApprovePaymentAccountChangeUseCase,
  ProposePaymentAccountUseCase,
  SetPaymentAccountActiveUseCase,
  UpdatePaymentAccountUseCase,
} from '../src/modules/raffles/application/use-cases/payment-accounts.use-case';
import { LocalProofStorage } from '../src/modules/raffles/infrastructure/storage/local-proof-storage';

/** What a test asks to approve: the amount defaults to the order total. */
type ApprovalRequest = Omit<ApprovePaymentCommand, 'receivedAmount'> & {
  receivedAmount?: number;
};

describe('Raffle persistence on real PostgreSQL', () => {
  const prisma = new PrismaService();
  const clock = { now: () => new Date() };
  const raffleRepo = new PrismaRaffleRepository(prisma);
  const ticketRepo = new PrismaTicketRepository(prisma);
  const orderRepo = new PrismaOrderRepository(prisma);
  const paymentRepo = new PrismaPaymentRepository(prisma);
  const refundRepo = new PrismaRefundRepository(prisma);
  const alertRepo = new PrismaOperatorAlertRepository(prisma);
  const reservationStore = new PrismaReservationStore(prisma);
  const ledger = new PrismaTicketLedger(prisma);
  const paymentAccounts = new PrismaPaymentAccountRepository(prisma);
  /** The account buyers pay to, approved by two operators in beforeAll (DT-19). */
  let paidToAccountId: string;
  const seedVault = new FakeSeedVault();
  const proofPolicy = new ProofPolicy();
  const reserveTickets = new ReserveTicketsUseCase(
    raffleRepo,
    reservationStore,
    clock,
    proofPolicy,
  );

  const proofDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rifas-proofs-'));
  const proofStorage = new LocalProofStorage(proofDirectory);
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

  beforeAll(async () => {
    await prisma.$connect();
    const mobile = `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const change = await new ProposePaymentAccountUseCase(paymentAccounts, clock).execute({
      operatorId: 'admin-1',
      fields: { method: BankOrWallet.YAPE, holderName: 'Rifas Tiendi SAC', accountNumber: mobile },
    });
    paidToAccountId = (
      await new ApprovePaymentAccountChangeUseCase(paymentAccounts, clock).execute({
        changeId: change.id,
        operatorId: 'admin-2',
      })
    ).account.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    fs.rmSync(proofDirectory, { recursive: true, force: true });
  });

  // Every test builds its own raffle and buyers, so no cleanup is needed and
  // the append-only trigger on AuditEvent is never fought.
  async function givenActiveRaffle(
    numbers: number[],
    salesCloseAt = new Date(Date.now() + 7 * 24 * 3_600_000),
    published: { commitmentHash: string; drandRound: bigint; drawAt: Date } | null = null,
  ): Promise<string> {
    const raffle = await prisma.raffle.create({
      data: {
        ...published,
        title: 'Integration raffle',
        prize: 'Prize',
        ticketPrice: 10,
        numberMin: 1,
        numberMax: 100,
        status: 'ACTIVE',
        salesCloseAt,
      },
    });
    await prisma.ticket.createMany({
      data: numbers.map((number) => ({ raffleId: raffle.id, number })),
    });
    return raffle.id;
  }

  /**
   * The close of sales is fixed once published (trg_raffle_schedule_immutable).
   * Only here is that guard off, to stand for the moment the close arrives.
   */
  async function moveCloseOfSales(raffleId: string, salesCloseAt: Date) {
    await prisma.$executeRaw`ALTER TABLE "Raffle" DISABLE TRIGGER trg_raffle_schedule_immutable`;
    try {
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { salesCloseAt },
      });
    } finally {
      await prisma.$executeRaw`ALTER TABLE "Raffle" ENABLE TRIGGER trg_raffle_schedule_immutable`;
    }
  }

  async function givenBuyers(count: number): Promise<string[]> {
    const ids = Array.from({ length: count }, () => randomUUID());
    await prisma.user.createMany({
      data: ids.map((id) => ({ id, email: `${id}@test.local` })),
    });
    return ids;
  }

  function reserve(raffleId: string, userId: string, numbers: number[]) {
    return reserveTickets.execute({ raffleId, userId, numbers });
  }

  function reservedTickets(raffleId: string) {
    return prisma.ticket.findMany({
      where: { raffleId, status: 'RESERVED' },
      orderBy: { number: 'asc' },
    });
  }

  function isConflict(result: PromiseSettledResult<unknown>): boolean {
    return (
      result.status === 'rejected' &&
      result.reason instanceof TicketNotAvailableError
    );
  }

  function ticketOf(raffleId: string, number: number) {
    return prisma.ticket.findUniqueOrThrow({
      where: { raffleId_number: { raffleId, number } },
    });
  }

  async function expireReservation(orderId: string): Promise<void> {
    await prisma.ticket.updateMany({
      where: { orderId },
      data: { reservedUntil: new Date(Date.now() - 60_000) },
    });
  }

  /** Moves an order in verification past its review deadline. */
  async function passReviewDeadline(orderId: string): Promise<void> {
    await expireReservation(orderId);
    await prisma.ticketOrder.update({
      where: { id: orderId },
      data: { verificationDueAt: new Date(Date.now() - 60_000) },
    });
  }

  function auditTypes(raffleId: string): Promise<string[]> {
    return prisma.auditEvent
      .findMany({ where: { raffleId }, orderBy: { occurredAt: 'asc' } })
      .then((events) => events.map((e) => e.type));
  }

  /** Fails right before the last write of a transaction, after all the others. */
  const ledgerFailingOnAudit: TicketLedger = {
    run: (work) =>
      ledger.run((tx) => {
        const sabotaged = Object.create(tx) as LedgerTransaction;
        sabotaged.recordAudit = () => Promise.reject(new Error('audit down'));
        return work(sabotaged);
      }),
  };

  /** Keeps a transaction open at its last write until the gate is released. */
  function ledgerHeldAtAudit(gate: Promise<void>, reached: () => void) {
    const held: TicketLedger = {
      run: (work) =>
        ledger.run((tx) => {
          const paused = Object.create(tx) as LedgerTransaction;
          paused.recordAudit = async (event) => {
            reached();
            await gate;
            return tx.recordAudit(event);
          };
          return work(paused);
        }),
    };
    return held;
  }

  function gate() {
    let open: () => void = () => undefined;
    const opened = new Promise<void>((resolve) => {
      open = resolve;
    });
    return { opened, open };
  }

  /** Resolves true if the promise is still running after half a second. */
  async function stillRunning(work: Promise<unknown>): Promise<boolean> {
    let finished = false;
    const tracked = work.then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      },
    );
    await Promise.race([
      tracked,
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
    return !finished;
  }

  function submitProofWith(usedLedger: TicketLedger = ledger) {
    return new SubmitPaymentProofUseCase(
      orderRepo,
      usedLedger,
      proofStorage,
      clock,
      proofPolicy,
      paymentAccounts,
    );
  }

  function approveWith(usedLedger: TicketLedger = ledger) {
    const useCase = new ApprovePaymentUseCase(orderRepo, usedLedger, clock);
    // Unless a test says otherwise, the bank shows exactly the total.
    return {
      execute: async (command: ApprovalRequest) => {
        const order = await orderRepo.findById(command.orderId);
        return useCase.execute({
          receivedAmount: order?.totalAmount ?? 0,
          ...command,
        });
      },
    };
  }

  function rejectWith(usedLedger: TicketLedger = ledger) {
    return new RejectPaymentUseCase(orderRepo, usedLedger, clock);
  }

  function closeSalesWith(usedLedger: TicketLedger = ledger) {
    return new CloseSalesUseCase(raffleRepo, usedLedger, seedVault, clock);
  }

  function cancelWith(usedLedger: TicketLedger = ledger) {
    return new CancelRaffleUseCase(usedLedger, clock);
  }

  function releaseExpired() {
    return new ReleaseExpiredReservationsUseCase(ticketRepo, ledger, clock);
  }

  function completeRefundWith(usedLedger: TicketLedger = ledger) {
    return new CompleteRefundUseCase(refundRepo, usedLedger, clock);
  }

  /** Emails queued for a raffle, oldest first (DT-13). */
  function queued(raffleId: string, type?: NotificationType) {
    return prisma.notificationOutbox.findMany({
      where: { raffleId, ...(type && { type }) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  function declaration(orderId: string, userId: string, declaredAmount = 10) {
    return {
      orderId,
      userId,
      file: PNG,
      operationNumber: 'OP-1',
      bankOrWallet: BankOrWallet.YAPE,
      declaredAmount,
      paymentAccountId: paidToAccountId,
      paymentAccountVersion: 1,
    };
  }

  function approval(orderId: string, operationNumber: string = randomUUID()) {
    return { orderId, operatorId: 'admin-1', operationNumber };
  }

  async function givenOrderInVerification(
    raffleId: string,
    numbers: number[],
    bankOrWallet = BankOrWallet.YAPE,
  ): Promise<{ orderId: string; buyer: string }> {
    const [buyer] = await givenBuyers(1);
    const order = await reserve(raffleId, buyer, numbers);
    await submitProofWith().execute({
      ...declaration(order.id, buyer, order.totalAmount),
      bankOrWallet,
    });
    return { orderId: order.id, buyer };
  }

  async function givenPaidOrder(
    raffleId: string,
    numbers: number[],
  ): Promise<string> {
    const { orderId } = await givenOrderInVerification(raffleId, numbers);
    await approveWith().execute(approval(orderId));
    return orderId;
  }

  async function givenClosableRaffle(numbers: number[]): Promise<string> {
    const raffleId = await givenActiveRaffle(numbers);
    const { seedCiphertext } = await seedVault.generateAndStoreSeed(raffleId);
    await prisma.raffle.update({
      where: { id: raffleId },
      data: { seedCiphertext },
    });
    return raffleId;
  }

  describe('fixed schedule once published (F5)', () => {
    it('refuses to move the close of sales or the draw time of an active raffle', async () => {
      const raffleId = await givenActiveRaffle([1]);

      await expect(
        prisma.raffle.update({
          where: { id: raffleId },
          data: { salesCloseAt: new Date(Date.now() + 3_600_000) },
        }),
      ).rejects.toThrow('Raffle_schedule_immutable');
      await expect(
        prisma.raffle.update({
          where: { id: raffleId },
          data: { drawAt: new Date(Date.now() + 3_600_000) },
        }),
      ).rejects.toThrow('Raffle_schedule_immutable');
    });

    it('lets a draft change its dates', async () => {
      const draft = await prisma.raffle.create({
        data: {
          title: 'Draft',
          prize: 'Prize',
          ticketPrice: 10,
          numberMin: 1,
          numberMax: 10,
          status: 'DRAFT',
        },
      });

      await expect(
        prisma.raffle.update({
          where: { id: draft.id },
          data: { salesCloseAt: new Date(), drawAt: new Date() },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('reservation near the close of sales (DT-05)', () => {
    const salesCloseAt = new Date(Date.now() + 24 * 3_600_000);
    const proofDeadline = proofPolicy.paymentDeadline(salesCloseAt);
    // One reservation TTL before the proof deadline, so each keeps its time.
    const cutoff = proofPolicy.reservationCutoff(
      salesCloseAt,
      new ReservationPolicy(),
    );

    function givenRaffleClosingAt(closeAt: Date): Promise<string> {
      return givenActiveRaffle([1], closeAt);
    }

    async function reserveAt(at: Date, raffleId: string, buyer: string) {
      return new ReserveTicketsUseCase(
        raffleRepo,
        reservationStore,
        { now: () => at },
        proofPolicy,
      ).execute({ raffleId, userId: buyer, numbers: [1] });
    }

    async function expectNothingReserved(raffleId: string, buyer: string) {
      expect(
        await prisma.ticketOrder.count({ where: { userId: buyer } }),
      ).toBe(0);
      expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');
      expect(await auditTypes(raffleId)).toEqual([]);
    }

    it('reserves one millisecond before the cutoff, expiring by the proof deadline', async () => {
      const raffleId = await givenRaffleClosingAt(salesCloseAt);
      const [buyer] = await givenBuyers(1);

      const order = await reserveAt(
        new Date(cutoff.getTime() - 1),
        raffleId,
        buyer,
      );

      const ticket = await ticketOf(raffleId, 1);
      expect(ticket.orderId).toBe(order.id);
      expect(ticket.reservedUntil?.getTime()).toBeLessThanOrEqual(
        proofDeadline.getTime(),
      );
      expect(await auditTypes(raffleId)).toEqual(['TICKETS_RESERVED']);
    });

    it('refuses a reservation at the cutoff', async () => {
      const raffleId = await givenRaffleClosingAt(salesCloseAt);
      const [buyer] = await givenBuyers(1);

      await expect(reserveAt(cutoff, raffleId, buyer)).rejects.toThrow(
        ReservationsClosedError,
      );
      await expectNothingReserved(raffleId, buyer);
    });

    it('refuses a reservation whose TTL would run past the proof deadline', async () => {
      const raffleId = await givenRaffleClosingAt(salesCloseAt);
      const [buyer] = await givenBuyers(1);

      await expect(
        reserveAt(new Date(proofDeadline.getTime() - 1), raffleId, buyer),
      ).rejects.toThrow(ReservationsClosedError);
      await expectNothingReserved(raffleId, buyer);
    });

    it('refuses a reservation after the close of sales, before CloseSales runs', async () => {
      const raffleId = await givenRaffleClosingAt(salesCloseAt);
      const [buyer] = await givenBuyers(1);

      await expect(
        reserveAt(new Date(salesCloseAt.getTime() + 1_000), raffleId, buyer),
      ).rejects.toThrow(ReservationsClosedError);
      await expectNothingReserved(raffleId, buyer);
    });

    it('reads the close of sales inside the transaction, not from a stale view', async () => {
      const raffleId = await givenRaffleClosingAt(salesCloseAt);
      const [buyer] = await givenBuyers(1);
      const stale = await raffleRepo.findById(raffleId);
      await moveCloseOfSales(raffleId, new Date(Date.now() - 1_000));

      await expect(
        new ReserveTicketsUseCase(
          { findById: async () => stale } as unknown as PrismaRaffleRepository,
          reservationStore,
          clock,
          proofPolicy,
        ).execute({ raffleId, userId: buyer, numbers: [1] }),
      ).rejects.toThrow(ReservationsClosedError);
      await expectNothingReserved(raffleId, buyer);
    });
  });

  describe('reservation', () => {
    it('persists the order, tickets and audit event together', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      const [buyer] = await givenBuyers(1);

      const order = await reserve(raffleId, buyer, [3, 1]);

      const tickets = await reservedTickets(raffleId);
      expect(tickets.map((t) => t.number)).toEqual([1, 3]);
      for (const ticket of tickets) {
        expect(ticket.orderId).toBe(order.id);
        expect(ticket.reservedUntil).toEqual(order.expiresAt);
      }

      const stored = await prisma.ticketOrder.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(stored.numbers).toEqual([1, 3]);
      expect(stored.totalAmount.toNumber()).toBe(20);

      const events = await prisma.auditEvent.findMany({ where: { raffleId } });
      expect(events.map((e) => e.type)).toEqual(['TICKETS_RESERVED']);
    });

    it('50 simultaneous reservations of one number: 1 wins, 49 conflict, 1 order', async () => {
      const raffleId = await givenActiveRaffle([7]);
      const buyers = await givenBuyers(50);

      const results = await Promise.allSettled(
        buyers.map((buyer) => reserve(raffleId, buyer, [7])),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(isConflict)).toHaveLength(49);
      expect(await prisma.ticketOrder.count({ where: { raffleId } })).toBe(1);
      expect(await reservedTickets(raffleId)).toHaveLength(1);
      expect(await prisma.auditEvent.count({ where: { raffleId } })).toBe(1);
    });

    it('crossed [1, 2] vs [2, 3]: one wins whole, the other leaves no trace', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      const [buyerA, buyerB] = await givenBuyers(2);

      const results = await Promise.allSettled([
        reserve(raffleId, buyerA, [1, 2]),
        reserve(raffleId, buyerB, [2, 3]),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(isConflict)).toHaveLength(1);

      const [order, ...orphans] = await prisma.ticketOrder.findMany({
        where: { raffleId },
      });
      expect(orphans).toEqual([]);
      const tickets = await reservedTickets(raffleId);
      expect(tickets.map((t) => t.number)).toEqual(order.numbers);
      expect(tickets.every((t) => t.orderId === order.id)).toBe(true);
    });

    it('reversed overlaps reach the store unsorted and resolve without deadlock', async () => {
      const policy = new ReservationPolicy();
      const reserveDirectly = (
        raffleId: string,
        userId: string,
        numbers: number[],
      ) => {
        const order = new TicketOrder({
          id: randomUUID(),
          raffleId,
          userId,
          numbers,
          totalAmount: numbers.length * 10,
          expiresAt: new Date(Date.now() + 60_000),
        });
        return reservationStore.reserve(
          order,
          { raffleId, type: 'TICKETS_RESERVED', data: {} },
          policy,
          proofPolicy,
        );
      };
      const ascending = Array.from({ length: 20 }, (_, i) => i + 1);

      for (let round = 0; round < 30; round++) {
        const raffleId = await givenActiveRaffle(ascending);
        const [buyerA, buyerB, buyerC, buyerD] = await givenBuyers(4);

        const results = await Promise.allSettled([
          reserveDirectly(raffleId, buyerA, ascending),
          reserveDirectly(raffleId, buyerB, [...ascending].reverse()),
          reserveDirectly(raffleId, buyerC, [...ascending].reverse()),
          reserveDirectly(raffleId, buyerD, ascending),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter(isConflict)).toHaveLength(3);
      }
    });

    it('keeps a buyer within the limit across simultaneous requests', async () => {
      const numbers = Array.from({ length: 40 }, (_, i) => i + 1);
      const raffleId = await givenActiveRaffle(numbers);
      const [buyer] = await givenBuyers(1);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) =>
          reserve(raffleId, buyer, numbers.slice(i * 5, i * 5 + 5)),
        ),
      );

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected).toHaveLength(4);
      for (const { reason } of rejected) {
        expect(reason).toBeInstanceOf(TicketReservationLimitError);
      }
      expect(await reservedTickets(raffleId)).toHaveLength(20);
    });

    it('ignores expired reservations when counting the buyer limit', async () => {
      const numbers = Array.from({ length: 40 }, (_, i) => i + 1);
      const raffleId = await givenActiveRaffle(numbers);
      const [buyer] = await givenBuyers(1);
      const expired = await reserve(raffleId, buyer, numbers.slice(0, 20));
      await expireReservation(expired.id);

      await expect(
        reserve(raffleId, buyer, numbers.slice(20, 25)),
      ).resolves.toBeDefined();
    });

    it('rejects a reservation that was waiting on a raffle being closed', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      let commitClose: () => void = () => undefined;
      const closeMayCommit = new Promise<void>((resolve) => {
        commitClose = resolve;
      });
      let markUpdated: () => void = () => undefined;
      const statusUpdated = new Promise<void>((resolve) => {
        markUpdated = resolve;
      });
      const closing = prisma.$transaction(
        async (tx) => {
          await tx.raffle.update({
            where: { id: raffleId },
            data: { status: 'CLOSED' },
          });
          markUpdated();
          await closeMayCommit;
        },
        { timeout: 15_000 },
      );
      await statusUpdated;

      let finished = false;
      const outcome = reserve(raffleId, buyer, [1]).then(
        () => {
          finished = true;
          return null as unknown;
        },
        (error: unknown) => {
          finished = true;
          return error;
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(finished).toBe(false);
      commitClose();
      await closing;
      expect(await outcome).toBeInstanceOf(RaffleNotActiveError);
      expect(await prisma.ticketOrder.count({ where: { raffleId } })).toBe(0);
      expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');
    });

    it('never leaves a reservation half done while CloseSales runs', async () => {
      for (let round = 0; round < 10; round++) {
        const raffleId = await givenClosableRaffle([1]);
        const [buyer] = await givenBuyers(1);

        const [reservation, close] = await Promise.allSettled([
          reserve(raffleId, buyer, [1]),
          closeSalesWith().execute(raffleId),
        ]);

        expect(close.status).toBe('fulfilled');
        const orders = await prisma.ticketOrder.count({ where: { raffleId } });
        if (reservation.status === 'fulfilled') {
          expect(orders).toBe(1);
          // Closing found it open and expired it: nothing stays held.
          expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');
        } else {
          expect(reservation.reason).toBeInstanceOf(RaffleNotActiveError);
          expect(orders).toBe(0);
        }
      }
    });

    it('reports every lost number and rolls back the available ones', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      const [holder, latecomer] = await givenBuyers(2);
      await reserve(raffleId, holder, [2, 3]);

      const error = await reserve(raffleId, latecomer, [1, 2, 3, 99]).catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(TicketNotAvailableError);
      expect((error as TicketNotAvailableError).numbers).toEqual([2, 3, 99]);
      expect(
        await prisma.ticketOrder.count({ where: { userId: latecomer } }),
      ).toBe(0);
      expect(await prisma.auditEvent.count({ where: { raffleId } })).toBe(1);
      const ticket1 = await prisma.ticket.findUniqueOrThrow({
        where: { raffleId_number: { raffleId, number: 1 } },
      });
      expect(ticket1.status).toBe('AVAILABLE');
    });
  });

  describe('payment proof', () => {
    it('moves the order and extends the tickets as one unit', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1, 2]);

      await submitProofWith().execute(declaration(order.id, buyer));

      const stored = await prisma.ticketOrder.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(stored.status).toBe('PENDING_VERIFICATION');
      expect(stored.declaredAmount?.toNumber()).toBe(10);
      expect(stored.bankOrWallet).toBe('YAPE');
      // The account the buyer paid to, copied on the order (DT-19).
      expect(stored.paidToAccountId).toBe(paidToAccountId);
      expect(stored.paidToAccount).toMatchObject({ accountId: paidToAccountId, method: 'YAPE' });
      expect((await ticketOf(raffleId, 1)).reservedUntil).toEqual(
        stored.verificationDueAt,
      );
      expect(stored.verificationDueAt!.getTime()).toBeGreaterThan(
        order.expiresAt.getTime(),
      );
      expect(stored.expiresAt).toEqual(order.expiresAt);
      expect(fs.existsSync(path.join(proofDirectory, stored.proofUrl!))).toBe(
        true,
      );
      expect(await auditTypes(raffleId)).toContain('PAYMENT_PROOF_SUBMITTED');
    });

    describe('the account it was paid to, checked under a lock (DT-19)', () => {
      async function anotherLiveAccount(): Promise<string> {
        const mobile = `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
        const change = await new ProposePaymentAccountUseCase(paymentAccounts, clock).execute({
          operatorId: 'admin-1',
          fields: { method: BankOrWallet.PLIN, holderName: 'Rifas Tiendi SAC', accountNumber: mobile },
        });
        const approved = await new ApprovePaymentAccountChangeUseCase(paymentAccounts, clock).execute({
          changeId: change.id,
          operatorId: 'admin-2',
        });
        return approved.account.id;
      }

      /** Commits `meanwhile` after the check before the transaction, before the transaction. */
      const ledgerAfter = (meanwhile: () => Promise<unknown>): TicketLedger => ({
        run: async (work) => {
          await meanwhile();
          return ledger.run(work);
        },
      });

      it('refuses the proof when a deactivation commits before its transaction', async () => {
        const accountId = await anotherLiveAccount();
        const raffleId = await givenActiveRaffle([1]);
        const [buyer] = await givenBuyers(1);
        const order = await reserve(raffleId, buyer, [1]);
        const deactivate = () =>
          new SetPaymentAccountActiveUseCase(paymentAccounts, clock).execute({
            accountId,
            operatorId: 'admin-3',
            active: false,
          });

        await expect(
          submitProofWith(ledgerAfter(deactivate)).execute({
            ...declaration(order.id, buyer),
            paymentAccountId: accountId,
          }),
        ).rejects.toBeInstanceOf(PaymentAccountUnavailableError);

        const stored = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(stored).toMatchObject({ status: 'PENDING', paidToAccountId: null, paidToAccount: null });
      });

      it('refuses the proof when an approved change commits before its transaction', async () => {
        const accountId = await anotherLiveAccount();
        const raffleId = await givenActiveRaffle([1]);
        const [buyer] = await givenBuyers(1);
        const order = await reserve(raffleId, buyer, [1]);
        const changeNumber = async () => {
          const outcome = await new UpdatePaymentAccountUseCase(paymentAccounts, clock).execute({
            accountId,
            operatorId: 'admin-3',
            changes: { holderName: 'Otra Persona' },
          });
          await new ApprovePaymentAccountChangeUseCase(paymentAccounts, clock).execute({
            changeId: outcome.pending!.id,
            operatorId: 'admin-4',
          });
        };

        await expect(
          submitProofWith(ledgerAfter(changeNumber)).execute({
            ...declaration(order.id, buyer),
            paymentAccountId: accountId,
          }),
        ).rejects.toBeInstanceOf(PaymentAccountChangedError);

        const stored = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(stored.paidToAccount).toBeNull();
      });

      it('keeps the version the buyer paid to in the copy', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const [buyer] = await givenBuyers(1);
        const order = await reserve(raffleId, buyer, [1]);

        await submitProofWith().execute(declaration(order.id, buyer));

        const stored = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } });
        expect(stored.paidToAccount).toMatchObject({ accountId: paidToAccountId, version: 1 });
      });
    });

    it('rolls back and removes the file when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);
      const filesBefore = fs.readdirSync(proofDirectory);

      await expect(
        submitProofWith(ledgerFailingOnAudit).execute(
          declaration(order.id, buyer),
        ),
      ).rejects.toThrow('audit down');

      const stored = await orderRepo.findById(order.id);
      expect(stored?.status).toBe('PENDING');
      expect(stored?.proofUrl).toBeNull();
      expect((await ticketOf(raffleId, 1)).reservedUntil).toEqual(
        order.expiresAt,
      );
      expect(fs.readdirSync(proofDirectory)).toEqual(filesBefore);
    });

    it('shows the file to its owner and an admin, and to nobody else', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId, buyer } = await givenOrderInVerification(raffleId, [1]);
      const getProof = new GetPaymentProofUseCase(orderRepo, proofStorage);

      const proof = await getProof.execute({
        orderId,
        userId: buyer,
        isAdmin: false,
      });
      expect(Buffer.from(proof.content)).toEqual(PNG);
      await expect(
        getProof.execute({ orderId, userId: 'admin', isAdmin: true }),
      ).resolves.toBeDefined();
      await expect(
        getProof.execute({ orderId, userId: 'stranger', isAdmin: false }),
      ).rejects.toThrow(NotOrderOwnerError);
    });
  });

  describe('payment approval', () => {
    it('sells the tickets and pays the order as one unit', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { orderId } = await givenOrderInVerification(raffleId, [1, 2]);

      const operation = randomUUID();
      await approveWith().execute(approval(orderId, ` op-${operation} `));
      const canonical = `OP${operation.replaceAll('-', '').toUpperCase()}`;

      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
      expect((await ticketOf(raffleId, 2)).orderId).toBe(orderId);
      const stored = await orderRepo.findById(orderId);
      expect(stored?.status).toBe('PAID');
      expect(stored?.verifiedBy).toBe('admin-1');
      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(payment.provider).toBe('YAPE');
      expect(payment.externalId).toBe(canonical);
      const event = await prisma.auditEvent.findFirstOrThrow({
        where: { raffleId, type: 'PAYMENT_APPROVED' },
      });
      expect(event.data).toMatchObject({
        operatorId: 'admin-1',
        operationNumber: canonical,
      });
      expect(await queued(raffleId, NotificationType.TICKET_CONFIRMATION)).toHaveLength(1);
    });

    it('rolls everything back when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        approveWith(ledgerFailingOnAudit).execute(approval(orderId)),
      ).rejects.toThrow('audit down');

      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(await queued(raffleId)).toEqual([]);
    });

    it('turns 10 simultaneous approvals into one sale', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const approve = approveWith();
      const operation = randomUUID();

      await Promise.all(
        Array.from({ length: 10 }, () =>
          approve.execute(approval(orderId, operation)),
        ),
      );

      expect(await paymentRepo.findByOrderId(orderId)).toHaveLength(1);
      expect(await queued(raffleId, NotificationType.TICKET_CONFIRMATION)).toHaveLength(1);
      const events = await auditTypes(raffleId);
      expect(events.filter((e) => e === 'PAYMENT_APPROVED')).toHaveLength(1);
    });

    it('refuses an operation number used by another order', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenOrderInVerification(raffleId, [1]);
      const second = await givenOrderInVerification(raffleId, [2]);
      const operation = randomUUID();
      await approveWith().execute(approval(first.orderId, operation));

      await expect(
        approveWith().execute(approval(second.orderId, operation)),
      ).rejects.toThrow(DuplicatePaymentError);

      expect((await ticketOf(raffleId, 2)).status).toBe('RESERVED');
      expect((await orderRepo.findById(second.orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
    });

    describe('received amount (DT-12)', () => {
      async function givenDeclared(declaredAmount: number | null) {
        const raffleId = await givenActiveRaffle([1, 2]);
        const { orderId } = await givenOrderInVerification(raffleId, [1, 2]);
        await prisma.ticketOrder.update({
          where: { id: orderId },
          data: { declaredAmount },
        });
        return { raffleId, orderId };
      }

      it('approves the same value written with other decimals', async () => {
        const { orderId } = await givenDeclared(20);
        await prisma.$executeRaw`
          UPDATE "TicketOrder"
          SET "totalAmount" = '20.0'::numeric
          WHERE id = ${orderId}`;

        await approveWith().execute({
          ...approval(orderId),
          receivedAmount: 20.0,
        });

        expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
      });

      it('approves a total with cents', async () => {
        const { orderId } = await givenDeclared(12.35);
        await prisma.ticketOrder.update({
          where: { id: orderId },
          data: { totalAmount: '12.35' },
        });

        await approveWith().execute({
          ...approval(orderId),
          receivedAmount: 12.35,
        });

        expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
      });

      it.each([
        ['an underpayment', 19.99],
        ['an overpayment', 20.01],
      ])('refuses %s and touches nothing', async (_case, receivedAmount) => {
        const { raffleId, orderId } = await givenDeclared(20);

        await expect(
          approveWith().execute({
            ...approval(orderId),
            receivedAmount,
          }),
        ).rejects.toThrow(PaymentAmountMismatchError);

        const stored = await orderRepo.findById(orderId);
        expect(stored?.status).toBe('PENDING_VERIFICATION');
        expect(stored?.verifiedBy).toBeNull();
        expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
        expect((await ticketOf(raffleId, 2)).orderId).toBe(orderId);
        expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
        expect(await auditTypes(raffleId)).not.toContain('PAYMENT_APPROVED');
        expect(await queued(raffleId)).toEqual([]);
      });

      it('refuses a missing amount', async () => {
        const { orderId } = await givenDeclared(20);
        const useCase = new ApprovePaymentUseCase(
          orderRepo,
          ledger,
          clock,
        );

        await expect(
          useCase.execute(approval(orderId) as ApprovePaymentCommand),
        ).rejects.toThrow(InvalidPaymentProofError);

        expect((await orderRepo.findById(orderId))?.status).toBe(
          'PENDING_VERIFICATION',
        );
      });

      it.each([
        ['a different amount', 15],
        ['no amount', null],
      ])(
        'approves a buyer who declared %s and audits both figures',
        async (_case, declared) => {
          const { raffleId, orderId } = await givenDeclared(declared);

          await approveWith().execute({
            ...approval(orderId),
            receivedAmount: 20,
          });

          expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
          const [payment] = await paymentRepo.findByOrderId(orderId);
          expect(payment.payload.receivedAmount).toBe(20);
          const [event] = await prisma.auditEvent.findMany({
            where: { raffleId, type: 'PAYMENT_APPROVED' },
          });
          expect(event.data).toMatchObject({
            receivedAmount: 20,
            declaredAmount: declared,
          });
        },
      );
    });

    it('refuses an order that never submitted a proof', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);

      await expect(
        approveWith().execute(approval(order.id)),
      ).rejects.toThrow(InvalidOrderTransitionError);

      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
    });

    it('settles an approval racing a rejection in exactly one way', async () => {
      for (let round = 0; round < 10; round++) {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await Promise.all([
          approveWith().execute(approval(orderId)),
          rejectWith().execute({
            orderId,
            operatorId: 'admin-2',
            reason: 'Not found in the bank',
            moneyReceived: false,
          }),
        ]);

        const order = await orderRepo.findById(orderId);
        const ticket = await ticketOf(raffleId, 1);
        const payments = await paymentRepo.findByOrderId(orderId);
        if (order?.status === 'PAID') {
          expect(ticket.status).toBe('SOLD');
          expect(payments).toHaveLength(1);
        } else {
          expect(order?.status).toBe('REJECTED');
          expect(ticket.status).toBe('AVAILABLE');
          expect(payments).toEqual([]);
        }
      }
    });

    it('an approval always wins over the expiry job past the deadline', async () => {
      for (let round = 0; round < 10; round++) {
        const raffleId = await givenActiveRaffle([1, 2]);
        const { orderId } = await givenOrderInVerification(raffleId, [1, 2]);
        await passReviewDeadline(orderId);

        const [released, approved] = await Promise.allSettled([
          releaseExpired().execute(raffleId),
          approveWith().execute(approval(orderId)),
        ]);

        expect(released).toEqual({ status: 'fulfilled', value: 0 });
        expect(approved.status).toBe('fulfilled');
        expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
        expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
        expect((await ticketOf(raffleId, 2)).status).toBe('SOLD');
        expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      }
    });
  });

  describe('payment rejection', () => {
    it('frees the numbers at once, so another buyer can take them', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await rejectWith().execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'Illegible',
        moneyReceived: false,
      });

      const stored = await orderRepo.findById(orderId);
      expect(stored?.status).toBe('REJECTED');
      expect(stored?.rejectionReason).toBe('Illegible');
      expect(await queued(raffleId, NotificationType.PAYMENT_REJECTED)).toHaveLength(1);
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      const [other] = await givenBuyers(1);
      await expect(reserve(raffleId, other, [1])).resolves.toBeDefined();
    });

    it('rolls everything back when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        rejectWith(ledgerFailingOnAudit).execute({
          orderId,
          operatorId: 'admin-1',
          reason: 'Illegible',
          moneyReceived: false,
        }),
      ).rejects.toThrow('audit down');

      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
    });

    describe('with the money received (DT-08)', () => {
      const received = (orderId: string, operationNumber = `BANK-${orderId}`) => ({
        orderId,
        operatorId: 'admin-1',
        reason: 'Amount does not match',
        moneyReceived: true as const,
        receivedAmount: 7.5,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber,
      });

      it('refunds the amount of the operator and frees the numbers', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenOrderInVerification(raffleId, [1]);

        await rejectWith().execute(received(orderId));

        const stored = await orderRepo.findById(orderId);
        expect(stored?.status).toBe('REFUND_PENDING');
        expect(stored?.declaredAmount).toBe(10);
        expect(stored?.rejectionReason).toBe('Amount does not match');
        expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(7.5);
        const [notice] = await queued(raffleId, NotificationType.REFUND_PENDING);
        expect(notice.recipient).toBe(buyer);
        expect(notice.payload).toMatchObject({ orderId, amount: 7.5 });

        const payment = await paymentRepo.findByExternalId(
          `BANK${orderId.replaceAll('-', '')}`.toUpperCase(),
        );
        expect(payment?.orderId).toBe(orderId);
        expect(payment?.status).toBe('REJECTED_RECEIVED');

        const [other] = await givenBuyers(1);
        await expect(reserve(raffleId, other, [1])).resolves.toBeDefined();
      });

      it('audits the operator, the reason and the money', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await rejectWith().execute(received(orderId));

        const [event] = await prisma.auditEvent.findMany({
          where: { raffleId, type: 'PAYMENT_REJECTED' },
        });
        expect(event.data).toMatchObject({
          orderId,
          operatorId: 'admin-1',
          reason: 'Amount does not match',
          moneyReceived: true,
          receivedAmount: 7.5,
          declaredAmount: 10,
        });
      });

      it('leaves everything held when the operation was already used', async () => {
        const raffleId = await givenActiveRaffle([1, 2]);
        const first = await givenOrderInVerification(raffleId, [1]);
        const second = await givenOrderInVerification(raffleId, [2]);
        const shared = randomUUID();
        await rejectWith().execute(received(first.orderId, shared));

        await expect(
          rejectWith().execute(received(second.orderId, shared)),
        ).rejects.toThrow(DuplicatePaymentError);

        const stored = await orderRepo.findById(second.orderId);
        expect(stored?.status).toBe('PENDING_VERIFICATION');
        expect(stored?.rejectionReason).toBeNull();
        const ticket = await ticketOf(raffleId, 2);
        expect(ticket.status).toBe('RESERVED');
        expect(ticket.orderId).toBe(second.orderId);
        expect(await refundRepo.findByOrderId(second.orderId)).toBeNull();
        expect(
          (await queued(raffleId)).filter((n) => n.orderId === second.orderId),
        ).toEqual([]);
      });

      it('refuses an operation that already backs a sale', async () => {
        const raffleId = await givenActiveRaffle([1, 2]);
        const sold = await givenOrderInVerification(raffleId, [1]);
        const other = await givenOrderInVerification(raffleId, [2]);
        const operation = randomUUID().toUpperCase();
        await approveWith().execute(approval(sold.orderId, operation));

        await expect(
          rejectWith().execute({
            ...received(other.orderId, operation),
            bankOrWallet: BankOrWallet.YAPE,
          }),
        ).rejects.toThrow(DuplicatePaymentError);

        expect((await ticketOf(raffleId, 2)).status).toBe('RESERVED');
      });

      it('rolls everything back when the last write fails', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await expect(
          rejectWith(ledgerFailingOnAudit).execute(
            received(orderId),
          ),
        ).rejects.toThrow('audit down');

        expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
        expect(await refundRepo.findByOrderId(orderId)).toBeNull();
        expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      });

      it('settles an approval racing a rejection in exactly one way', async () => {
        for (let round = 0; round < 10; round++) {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);

          const results = await Promise.allSettled([
            approveWith().execute(approval(orderId)),
            rejectWith().execute(received(orderId)),
          ]);

          expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
          const order = await orderRepo.findById(orderId);
          const ticket = await ticketOf(raffleId, 1);
          const refund = await refundRepo.findByOrderId(orderId);
          expect(await paymentRepo.findByOrderId(orderId)).toHaveLength(1);
          if (order?.status === 'PAID') {
            expect(ticket.status).toBe('SOLD');
            expect(refund).toBeNull();
          } else {
            expect(order?.status).toBe('REFUND_PENDING');
            expect(ticket.status).toBe('AVAILABLE');
            expect(refund?.amount).toBe(7.5);
          }
        }
      });

      it('opens one refund when two operators reject at once', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await Promise.all(
          Array.from({ length: 4 }, () =>
            rejectWith().execute(received(orderId)),
          ),
        );

        expect(await paymentRepo.findByOrderId(orderId)).toHaveLength(1);
        expect(
          await prisma.auditEvent.count({
            where: { raffleId, type: 'PAYMENT_REJECTED' },
          }),
        ).toBe(1);
      });

      describe('repeated', () => {
        const refusedEvents = (raffleId: string) =>
          prisma.auditEvent.findMany({
            where: { raffleId, type: 'PAYMENT_REJECTION_REFUSED' },
          });

        const rejectedEvents = (raffleId: string) =>
          prisma.auditEvent.count({
            where: { raffleId, type: 'PAYMENT_REJECTED' },
          });

        it('adds nothing when identical, however the number is typed', async () => {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);
          const operation = `op-${randomUUID()}`;
          await rejectWith().execute(received(orderId, operation));

          await rejectWith().execute(
            received(orderId, operation.toUpperCase().replaceAll('-', ' ')),
          );

          expect(await paymentRepo.findByOrderId(orderId)).toHaveLength(1);
          expect(await prisma.refund.count({ where: { orderId } })).toBe(1);
          expect(await rejectedEvents(raffleId)).toBe(1);
          expect(await refusedEvents(raffleId)).toEqual([]);
          // Only the first rejection queued an email (DT-13).
          expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toHaveLength(1);
        });

        it.each([
          ['operation number', { operationNumber: 'OTHER-OPERATION' }],
          ['amount', { receivedAmount: 7.51 }],
          ['bank', { bankOrWallet: BankOrWallet.BBVA }],
        ])('refuses another %s and keeps the evidence', async (_, change) => {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);
          await rejectWith().execute(received(orderId));
          const [payment] = await paymentRepo.findByOrderId(orderId);
          const refund = await refundRepo.findByOrderId(orderId);
          const attempt = { ...received(orderId), ...change };

          await expect(rejectWith().execute(attempt)).rejects.toThrow(
            ConflictingRejectionError,
          );

          expect(await paymentRepo.findByOrderId(orderId)).toEqual([payment]);
          expect(await refundRepo.findByOrderId(orderId)).toEqual(refund);
          expect((await orderRepo.findById(orderId))?.status).toBe(
            'REFUND_PENDING',
          );
          expect(await rejectedEvents(raffleId)).toBe(1);
          // Only the first rejection queued an email (DT-13).
          expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toHaveLength(1);

          const [event] = await refusedEvents(raffleId);
          expect(event.data).toMatchObject({
            orderId,
            operatorId: 'admin-1',
            receivedAmount: attempt.receivedAmount,
            bankOrWallet: attempt.bankOrWallet,
            recordedPaymentId: payment.id,
          });
        });

        it('keeps one payment when two different rejections race', async () => {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);

          const results = await Promise.allSettled([
            rejectWith().execute(received(orderId, `A-${randomUUID()}`)),
            rejectWith().execute(received(orderId, `B-${randomUUID()}`)),
          ]);

          expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
          const failed = results.find((r) => r.status === 'rejected');
          expect((failed as PromiseRejectedResult).reason).toBeInstanceOf(
            ConflictingRejectionError,
          );
          expect(await paymentRepo.findByOrderId(orderId)).toHaveLength(1);
          expect(await prisma.refund.count({ where: { orderId } })).toBe(1);
          expect(await refusedEvents(raffleId)).toHaveLength(1);
        });

        it('does not take the payment of a sale for a repeat', async () => {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);
          await approveWith().execute(approval(orderId));

          await expect(
            rejectWith().execute(received(orderId)),
          ).rejects.toThrow(InvalidOrderTransitionError);

          expect(await refusedEvents(raffleId)).toEqual([]);
          expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
        });

        it('refuses a refund that came from another origin', async () => {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenOrderInVerification(raffleId, [1]);
          await prisma.ticketOrder.update({
            where: { id: orderId },
            data: { status: 'REFUND_PENDING', rejectionReason: 'Left by hand' },
          });

          await expect(
            rejectWith().execute(received(orderId)),
          ).rejects.toThrow(InvalidOrderTransitionError);

          expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
          expect(await refusedEvents(raffleId)).toEqual([]);
        });
      });

      it('finishes through CompleteRefund without touching another buyer', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);
        await rejectWith().execute(received(orderId));
        const [other] = await givenBuyers(1);
        const otherOrder = await reserve(raffleId, other, [1]);
        const refund = await refundRepo.findByOrderId(orderId);

        await completeRefundWith().execute({
          refundId: refund?.id as string,
          operatorId: 'admin-2',
          destination: 'YAPE 999',
          operationNumber: 'REF-1',
        });

        expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
        expect((await ticketOf(raffleId, 1)).orderId).toBe(otherOrder.id);
        expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      });
    });
  });

  describe('close of sales', () => {
    it('freezes only what was sold and resolves everything left open', async () => {
      const raffleId = await givenClosableRaffle([1, 2, 3]);
      await givenPaidOrder(raffleId, [1]);
      const verifying = await givenOrderInVerification(raffleId, [2]);
      const [buyer] = await givenBuyers(1);
      const unpaid = await reserve(raffleId, buyer, [3]);

      const closed = await closeSalesWith().execute(raffleId);

      expect(closed.soldListHash).toBe(await soldListHash([1]));
      expect((await orderRepo.findById(verifying.orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await refundRepo.findByOrderId(verifying.orderId)).toBeNull();
      expect((await orderRepo.findById(unpaid.id))?.status).toBe('EXPIRED');
      expect(await refundRepo.findByOrderId(unpaid.id)).toBeNull();
      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await ticketOf(raffleId, 3)).status).toBe('AVAILABLE');
    });

    it('rolls everything back when the last write fails', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        closeSalesWith(ledgerFailingOnAudit).execute(raffleId),
      ).rejects.toThrow('audit down');

      const raffle = await raffleRepo.findById(raffleId);
      expect(raffle?.status).toBe('ACTIVE');
      expect(raffle?.soldListHash).toBeNull();
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect(await prisma.operatorAlert.count({ where: { orderId } })).toBe(0);
    });

    it('an approval arriving during the close waits, fails and changes no list', async () => {
      const raffleId = await givenClosableRaffle([1, 2]);
      await givenPaidOrder(raffleId, [1]);
      const late = await givenOrderInVerification(raffleId, [2]);
      const closeReachedAudit = gate();
      const closeMayCommit = gate();
      const closing = closeSalesWith(
        ledgerHeldAtAudit(closeMayCommit.opened, closeReachedAudit.open),
      ).execute(raffleId);
      await closeReachedAudit.opened;

      const approving = approveWith().execute(approval(late.orderId));
      const outcome = approving.catch((error: unknown) => error);

      expect(await stillRunning(approving)).toBe(true);
      closeMayCommit.open();
      const closed = await closing;

      expect(await outcome).toBeInstanceOf(RaffleNotActiveError);
      expect(closed.soldListHash).toBe(await soldListHash([1]));
      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await orderRepo.findById(late.orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await paymentRepo.findByOrderId(late.orderId)).toEqual([]);
      const verification = await ticketRepo.findSoldByRaffleId(raffleId);
      expect(verification.map((t) => t.number)).toEqual([1]);
    });

    it('a close arriving during an approval waits and freezes that sale', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const approvalReachedAudit = gate();
      const approvalMayCommit = gate();
      const approving = approveWith(
        ledgerHeldAtAudit(approvalMayCommit.opened, approvalReachedAudit.open),
      ).execute(approval(orderId));
      await approvalReachedAudit.opened;

      const closing = closeSalesWith().execute(raffleId);

      expect(await stillRunning(closing)).toBe(true);
      approvalMayCommit.open();
      await approving;

      expect((await closing).soldListHash).toBe(await soldListHash([1]));
      expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
      expect(await prisma.operatorAlert.count({ where: { orderId } })).toBe(0);
    });

    it('refuses an approval after the close, without touching the list', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await closeSalesWith().execute(raffleId);

      await expect(
        approveWith().execute(approval(orderId)),
      ).rejects.toThrow(RaffleNotActiveError);

      expect(await ticketRepo.findSoldByRaffleId(raffleId)).toEqual([]);
    });

    it('the database refuses a sale on a closed raffle from any writer', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);
      await prisma.raffle.update({
        where: { id: raffleId },
        data: { status: 'CLOSED' },
      });

      await expect(
        prisma.ticket.updateMany({
          where: { orderId: order.id },
          data: { status: 'SOLD' },
        }),
      ).rejects.toThrow(/Invalid ticket transition/);
    });
  });

  describe('late payment review (DT-07)', () => {
    const claimUseCase = () =>
      claimWith(ledger);
    const claimWith = (usedLedger: TicketLedger) =>
      new ClaimLatePaymentUseCase(
        orderRepo,
        usedLedger,
        proofStorage,
        proofPolicy,
        clock,
      );
    const confirmWith = () =>
      new ConfirmLatePaymentUseCase(orderRepo, ledger, clock);
    const dismissWith = () =>
      new DismissLatePaymentUseCase(orderRepo, ledger, clock);

    const confirmation = (orderId: string) => ({
      orderId,
      operatorId: 'admin-1',
      receivedAmount: 7.5,
      bankOrWallet: BankOrWallet.BCP,
      operationNumber: `BANK-${orderId}`,
    });

    const dismissal = (orderId: string) => ({
      orderId,
      operatorId: 'admin-1',
      reason: 'No deposit found',
    });

    async function givenExpiredOrder(
      raffleId: string,
      numbers: number[],
    ): Promise<{ orderId: string; buyer: string }> {
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, numbers);
      await expireReservation(order.id);
      await releaseExpired().execute(raffleId);
      return { orderId: order.id, buyer };
    }

    async function givenClaim(
      raffleId: string,
      numbers: number[],
    ): Promise<{ orderId: string; buyer: string }> {
      const expired = await givenExpiredOrder(raffleId, numbers);
      await claimUseCase().execute({
        ...declaration(expired.orderId, expired.buyer),
        declaredAmount: 5000,
      });
      return expired;
    }

    function auditEvents(raffleId: string, type: string) {
      return prisma.auditEvent.findMany({ where: { raffleId, type } });
    }

    it('queues a claim with no refund and leaves the numbers alone', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenClaim(raffleId, [1]);
      const [other] = await givenBuyers(1);
      const otherOrder = await reserve(raffleId, other, [1]);

      const stored = await orderRepo.findById(orderId);
      expect(stored?.status).toBe('LATE_PAYMENT_REVIEW');
      expect(stored?.declaredAmount).toBe(5000);
      expect(stored?.proofUrl).not.toBeNull();
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect((await ticketOf(raffleId, 1)).orderId).toBe(otherOrder.id);
    });

    it('lets one of many simultaneous claims through and keeps its file', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId, buyer } = await givenExpiredOrder(raffleId, [1]);

      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          claimUseCase().execute(declaration(orderId, buyer)),
        ),
      );

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected).toHaveLength(4);
      for (const { reason } of rejected) {
        expect(reason).toBeInstanceOf(InvalidOrderTransitionError);
      }
      expect(await auditEvents(raffleId, 'LATE_PAYMENT_CLAIMED')).toHaveLength(
        1,
      );
      const stored = await orderRepo.findById(orderId);
      await expect(
        proofStorage.read(stored?.proofUrl as string),
      ).resolves.toEqual(expect.anything());
    });

    it('refunds the amount of the operator, even when the buyer declared more', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId, buyer } = await givenClaim(raffleId, [1]);

      await confirmWith().execute(confirmation(orderId));

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'REFUND_PENDING',
      );
      expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(7.5);
      const [notice] = await queued(raffleId, NotificationType.REFUND_PENDING);
      expect(notice.recipient).toBe(buyer);
      expect(notice.payload).toMatchObject({ orderId, amount: 7.5 });
      expect(
        await paymentRepo.findByExternalId(
          `BANK${orderId.replaceAll('-', '')}`.toUpperCase(),
        ),
      ).not.toBeNull();

      const [event] = await auditEvents(raffleId, 'LATE_PAYMENT_CONFIRMED');
      expect(event.data).toMatchObject({
        orderId,
        operatorId: 'admin-1',
        receivedAmount: 7.5,
        declaredAmount: 5000,
      });
    });

    it('finishes through CompleteRefund without touching another buyer', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenClaim(raffleId, [1]);
      const [other] = await givenBuyers(1);
      const otherOrder = await reserve(raffleId, other, [1]);
      await confirmWith().execute(confirmation(orderId));
      const refund = await refundRepo.findByOrderId(orderId);

      await completeRefundWith().execute({
        refundId: refund?.id as string,
        operatorId: 'admin-2',
        destination: 'YAPE 999',
        operationNumber: 'REF-1',
      });

      expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
      expect((await ticketOf(raffleId, 1)).orderId).toBe(otherOrder.id);
    });

    it('rolls back a confirmation when the audit fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenClaim(raffleId, [1]);

      await expect(
        new ConfirmLatePaymentUseCase(
          orderRepo,
          ledgerFailingOnAudit,
          clock,
        ).execute(confirmation(orderId)),
      ).rejects.toThrow('audit down');

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
    });

    it('dismisses for good: no refund, audited, no second claim', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId, buyer } = await givenClaim(raffleId, [1]);

      await dismissWith().execute(dismissal(orderId));

      const stored = await orderRepo.findById(orderId);
      expect(stored?.status).toBe('LATE_PAYMENT_DISMISSED');
      expect(stored?.rejectionReason).toBe('No deposit found');
      expect(stored?.verifiedBy).toBe('admin-1');
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      const [notice] = await queued(raffleId, NotificationType.PAYMENT_REJECTED);
      expect(notice.payload).toMatchObject({ reason: 'No deposit found' });
      const [event] = await auditEvents(raffleId, 'LATE_PAYMENT_DISMISSED');
      expect(event.data).toMatchObject({
        orderId,
        operatorId: 'admin-1',
        reason: 'No deposit found',
      });

      await expect(
        claimUseCase().execute(declaration(orderId, buyer)),
      ).rejects.toThrow(InvalidOrderTransitionError);
      await expect(
        confirmWith().execute(confirmation(orderId)),
      ).rejects.toThrow(InvalidOrderTransitionError);
    });

    it('lets one decision win when confirm and dismiss race', async () => {
      for (let round = 0; round < 10; round++) {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        const results = await Promise.allSettled([
          confirmWith().execute(confirmation(orderId)),
          dismissWith().execute(dismissal(orderId)),
        ]);

        const rejected = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toBeInstanceOf(InvalidOrderTransitionError);

        const status = (await orderRepo.findById(orderId))?.status;
        const refund = await refundRepo.findByOrderId(orderId);
        if (results[0].status === 'fulfilled') {
          expect(status).toBe('REFUND_PENDING');
          expect(refund).not.toBeNull();
        } else {
          expect(status).toBe('LATE_PAYMENT_DISMISSED');
          expect(refund).toBeNull();
        }
      }
    });

    it('survives closing sales without changing the sold list', async () => {
      const raffleId = await givenClosableRaffle([1, 2]);
      const { orderId } = await givenClaim(raffleId, [1]);
      await givenPaidOrder(raffleId, [2]);

      const closed = await closeSalesWith().execute(raffleId);

      expect(closed.soldListHash).toBe(await soldListHash([2]));
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');

      await confirmWith().execute(confirmation(orderId));
      expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(7.5);
    });

    it('survives a cancellation and can still be dismissed', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenClaim(raffleId, [1]);

      await cancelWith().execute({ raffleId, reason: 'Called off' });

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();

      await dismissWith().execute(dismissal(orderId));
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_DISMISSED',
      );
    });

    it('lists open claims, oldest first, and nothing else', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3, 4]);
      const first = await givenClaim(raffleId, [1]);
      const second = await givenClaim(raffleId, [2]);
      const dismissed = await givenClaim(raffleId, [3]);
      const unclaimed = await givenExpiredOrder(raffleId, [4]);
      await dismissWith().execute(dismissal(dismissed.orderId));

      const claims = await new ListLatePaymentClaimsUseCase(orderRepo).execute();

      const ids = claims.map((o) => o.id);
      expect(ids).toContain(first.orderId);
      expect(ids.indexOf(first.orderId)).toBeLessThan(
        ids.indexOf(second.orderId),
      );
      expect(ids).not.toContain(dismissed.orderId);
      expect(ids).not.toContain(unclaimed.orderId);
    });

    describe('money above the order total (DT-14)', () => {
      it('refuses an unconfirmed overpayment and keeps the claim under review', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        await expect(
          confirmWith().execute({
            ...confirmation(orderId),
            receivedAmount: 10.01,
          }),
        ).rejects.toThrow(OverpaymentNotConfirmedError);

        expect((await orderRepo.findById(orderId))?.status).toBe(
          'LATE_PAYMENT_REVIEW',
        );
        expect(await refundRepo.findByOrderId(orderId)).toBeNull();
        expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      });

      it('refunds a confirmed overpayment and audits it', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        await confirmWith().execute({
          ...confirmation(orderId),
          receivedAmount: 10.01,
          overpayment: { confirmed: true, reason: 'Buyer sent extra' },
        });

        expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(10.01);
        const [event] = await prisma.auditEvent.findMany({
          where: { raffleId, type: 'OVERPAYMENT_CONFIRMED' },
        });
        expect(event.data).toMatchObject({
          orderId,
          totalAmount: 10,
          receivedAmount: 10.01,
          difference: 0.01,
          reason: 'Buyer sent extra',
        });
      });
    });

    describe('operator alert (DT-09)', () => {
      const listAlerts = new ListUnreadOperatorAlertsUseCase(alertRepo);
      const markRead = new MarkOperatorAlertReadUseCase(alertRepo, clock);

      function alertsOf(orderId: string) {
        return prisma.operatorAlert.findMany({ where: { orderId } });
      }

      async function unreadOrderIds(): Promise<(string | null)[]> {
        const alerts = await listAlerts.execute();
        return alerts.map((a) => a.orderId);
      }

      it('stores it with the claim, and no email goes out', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenExpiredOrder(raffleId, [1]);

        await claimUseCase().execute({
          ...declaration(orderId, buyer),
          declaredAmount: 12.5,
        });

        const [alert, ...others] = await alertsOf(orderId);
        expect(others).toEqual([]);
        expect(alert).toMatchObject({
          type: 'LATE_PAYMENT_CLAIM',
          raffleId,
          raffleTitle: 'Integration raffle',
          orderId,
          readAt: null,
          readBy: null,
        });
        expect(Number(alert.amount)).toBe(12.5);
        expect(alert.createdAt).toBeInstanceOf(Date);
      });

      it('keeps no buyer data in the row', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenExpiredOrder(raffleId, [1]);
        const claimed = declaration(orderId, buyer);

        await claimUseCase().execute(claimed);

        const [alert] = await alertsOf(orderId);
        const content = JSON.stringify(alert);
        expect(content).not.toContain(buyer);
        expect(content).not.toContain(claimed.operationNumber);
      });

      it('leaves no alert behind when the claim rolls back', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenExpiredOrder(raffleId, [1]);

        await expect(
          claimWith(ledgerFailingOnAudit).execute(declaration(orderId, buyer)),
        ).rejects.toThrow('audit down');

        expect(await alertsOf(orderId)).toEqual([]);
        expect((await orderRepo.findById(orderId))?.status).toBe('EXPIRED');
      });

      it('adds none for a refused second claim', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenClaim(raffleId, [1]);

        await expect(
          claimUseCase().execute(declaration(orderId, buyer)),
        ).rejects.toThrow(InvalidOrderTransitionError);

        expect(await alertsOf(orderId)).toHaveLength(1);
      });

      it('stores one for many simultaneous claims', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId, buyer } = await givenExpiredOrder(raffleId, [1]);

        await Promise.allSettled(
          Array.from({ length: 5 }, () =>
            claimUseCase().execute(declaration(orderId, buyer)),
          ),
        );

        expect(await alertsOf(orderId)).toHaveLength(1);
      });

      it('lists unread alerts, oldest first', async () => {
        const raffleId = await givenActiveRaffle([1, 2, 3]);
        const first = await givenClaim(raffleId, [1]);
        const second = await givenClaim(raffleId, [2]);
        const read = await givenClaim(raffleId, [3]);
        const [readAlert] = await alertsOf(read.orderId);
        await markRead.execute({
          alertId: readAlert.id,
          operatorId: 'admin-1',
        });

        const ids = await unreadOrderIds();

        expect(ids.indexOf(first.orderId)).toBeGreaterThanOrEqual(0);
        expect(ids.indexOf(first.orderId)).toBeLessThan(
          ids.indexOf(second.orderId),
        );
        expect(ids).not.toContain(read.orderId);
      });

      it('records who read it, and keeps the first reader', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);
        const [alert] = await alertsOf(orderId);

        await markRead.execute({ alertId: alert.id, operatorId: 'admin-1' });
        const [read] = await alertsOf(orderId);
        await markRead.execute({ alertId: alert.id, operatorId: 'admin-2' });

        const [again] = await alertsOf(orderId);
        expect(read.readBy).toBe('admin-1');
        expect(read.readAt).toBeInstanceOf(Date);
        expect(again.readBy).toBe('admin-1');
        expect(again.readAt).toEqual(read.readAt);
      });

      it('refuses an unknown alert', async () => {
        await expect(
          markRead.execute({ alertId: randomUUID(), operatorId: 'admin-1' }),
        ).rejects.toThrow(OperatorAlertNotFoundError);
      });

      it.each([
        ['confirming', (id: string) => confirmWith().execute(confirmation(id))],
        ['dismissing', (id: string) => dismissWith().execute(dismissal(id))],
      ])('clears when %s the claim', async (_name, decide) => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        await decide(orderId);

        const [alert] = await alertsOf(orderId);
        expect(alert.readBy).toBe('admin-1');
        expect(alert.readAt).toBeInstanceOf(Date);
        expect(await unreadOrderIds()).not.toContain(orderId);
      });

      it('keeps the first reader when the claim is decided after', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);
        const [alert] = await alertsOf(orderId);
        await markRead.execute({ alertId: alert.id, operatorId: 'admin-2' });
        const [read] = await alertsOf(orderId);

        await dismissWith().execute(dismissal(orderId));

        const [after] = await alertsOf(orderId);
        expect(after.readBy).toBe('admin-2');
        expect(after.readAt).toEqual(read.readAt);
      });

      it('stays unread when a duplicate operation undoes the confirmation', async () => {
        const raffleId = await givenActiveRaffle([1, 2]);
        const first = await givenClaim(raffleId, [1]);
        const second = await givenClaim(raffleId, [2]);
        const operationNumber = `BANK-${randomUUID()}`;
        await confirmWith().execute({
          ...confirmation(first.orderId),
          operationNumber,
        });

        await expect(
          confirmWith().execute({
            ...confirmation(second.orderId),
            operationNumber,
          }),
        ).rejects.toThrow(DuplicatePaymentError);

        const [alert] = await alertsOf(second.orderId);
        expect(alert.readAt).toBeNull();
        expect(alert.readBy).toBeNull();
      });

      it('stays unread when the audit undoes the decision', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        await expect(
          new DismissLatePaymentUseCase(
            orderRepo,
            ledgerFailingOnAudit,
            clock,
          ).execute(dismissal(orderId)),
        ).rejects.toThrow('audit down');

        const [alert] = await alertsOf(orderId);
        expect(alert.readAt).toBeNull();
      });

      it('stays consistent when a decision and a mark race', async () => {
        for (let round = 0; round < 10; round++) {
          const raffleId = await givenActiveRaffle([1]);
          const { orderId } = await givenClaim(raffleId, [1]);
          const [alert] = await alertsOf(orderId);

          await Promise.all([
            dismissWith().execute(dismissal(orderId)),
            markRead.execute({ alertId: alert.id, operatorId: 'admin-2' }),
          ]);

          const [after] = await alertsOf(orderId);
          expect(after.readAt).toBeInstanceOf(Date);
          expect(['admin-1', 'admin-2']).toContain(after.readBy);
        }
      });

      it('cannot exist twice for one claim', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenClaim(raffleId, [1]);

        await expect(
          ledger.run((tx) =>
            tx.addOperatorAlert(
              new OperatorAlert({
                id: randomUUID(),
                type: OperatorAlertType.LATE_PAYMENT_CLAIM,
                raffleId,
                raffleTitle: 'Integration raffle',
                orderId,
                amount: 1,
                createdAt: new Date(),
              }),
            ),
          ),
        ).rejects.toThrow(DuplicateOperatorAlertError);

        expect(await alertsOf(orderId)).toHaveLength(1);
      });
    });
  });

  describe('operation numbers (DT-12)', () => {
    const confirmUseCase = () =>
      new ConfirmLatePaymentUseCase(orderRepo, ledger, clock);

    const rejection = (orderId: string, operationNumber: string) => ({
      orderId,
      operatorId: 'admin-1',
      reason: 'Paid the wrong amount',
      moneyReceived: true as const,
      receivedAmount: 7.5,
      bankOrWallet: BankOrWallet.BCP,
      operationNumber,
    });

    const lateConfirmation = (orderId: string, operationNumber: string) => ({
      orderId,
      operatorId: 'admin-1',
      receivedAmount: 7.5,
      bankOrWallet: BankOrWallet.PLIN,
      operationNumber,
    });

    async function givenClaimedOrder(raffleId: string, number: number) {
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [number]);
      await expireReservation(order.id);
      await releaseExpired().execute(raffleId);
      await new ClaimLatePaymentUseCase(
        orderRepo,
        ledger,
        proofStorage,
        proofPolicy,
        clock,
      ).execute(declaration(order.id, buyer));
      return order.id;
    }

    /** One way to record an operation, against an order of its kind. */
    const recorders = {
      approve: {
        order: async (raffleId: string, number: number) =>
          (await givenOrderInVerification(raffleId, [number])).orderId,
        record: (orderId: string, operation: string) =>
          approveWith().execute(approval(orderId, operation)),
        statusAfterRefusal: 'PENDING_VERIFICATION',
      },
      'reject with money': {
        order: async (raffleId: string, number: number) =>
          (await givenOrderInVerification(raffleId, [number])).orderId,
        record: (orderId: string, operation: string) =>
          rejectWith().execute(rejection(orderId, operation)),
        statusAfterRefusal: 'PENDING_VERIFICATION',
      },
      'confirm late': {
        order: givenClaimedOrder,
        record: (orderId: string, operation: string) =>
          confirmUseCase().execute(lateConfirmation(orderId, operation)),
        statusAfterRefusal: 'LATE_PAYMENT_REVIEW',
      },
    };
    type Recorder = keyof typeof recorders;
    const names = Object.keys(recorders) as Recorder[];
    const pairs = names.flatMap((first) =>
      names.map((second): [Recorder, Recorder] => [first, second]),
    );

    it.each(pairs)(
      'after %s, %s refuses the operation and leaves nothing',
      async (firstName, secondName) => {
        const [first, second] = [recorders[firstName], recorders[secondName]];
        const raffleId = await givenActiveRaffle([1, 2]);
        const firstOrder = await first.order(raffleId, 1);
        const secondOrder = await second.order(raffleId, 2);
        const operation = randomUUID();
        await first.record(firstOrder, operation);
        const afterFirst = (await auditTypes(raffleId)).length;

        await expect(
          second.record(secondOrder, ` ${operation.toLowerCase()} `),
        ).rejects.toThrow(DuplicatePaymentError);

        const stored = await orderRepo.findById(secondOrder);
        expect(stored?.status).toBe(second.statusAfterRefusal);
        expect(stored?.verifiedBy).toBeNull();
        expect(await paymentRepo.findByOrderId(secondOrder)).toEqual([]);
        expect(await refundRepo.findByOrderId(secondOrder)).toBeNull();
        expect(await auditTypes(raffleId)).toHaveLength(afterFirst);
      },
    );

    it('refuses the same number under another payment method', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const yape = await givenOrderInVerification(raffleId, [1]);
      const [buyer] = await givenBuyers(1);
      const plin = await reserve(raffleId, buyer, [2]);
      await submitProofWith().execute({
        ...declaration(plin.id, buyer),
        bankOrWallet: BankOrWallet.PLIN,
      });
      const operation = randomUUID();
      await approveWith().execute(approval(yape.orderId, operation));

      await expect(
        approveWith().execute(approval(plin.id, operation)),
      ).rejects.toThrow(DuplicatePaymentError);

      const [payment] = await paymentRepo.findByOrderId(yape.orderId);
      expect(payment.provider).toBe('YAPE');
      expect(await paymentRepo.findByOrderId(plin.id)).toEqual([]);
      expect((await ticketOf(raffleId, 2)).status).toBe('RESERVED');
    });

    it.each([
      ['lower case', (n: string) => n.toLowerCase()],
      ['spaces', (n: string) => ` ${n.slice(0, 4)} ${n.slice(4)} `],
      ['hyphens', (n: string) => `${n.slice(0, 4)}-${n.slice(4)}`],
    ])('sees through %s', async (_case, retype) => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenOrderInVerification(raffleId, [1]);
      const second = await givenOrderInVerification(raffleId, [2]);
      const operation = `OP${randomUUID().replaceAll('-', '').toUpperCase()}`;
      await approveWith().execute(approval(first.orderId, operation));

      await expect(
        approveWith().execute(approval(second.orderId, retype(operation))),
      ).rejects.toThrow(DuplicatePaymentError);

      const [payment] = await paymentRepo.findByOrderId(first.orderId);
      expect(payment.externalId).toBe(operation);
    });

    it('lets only one of two simultaneous approvals keep a number', async () => {
      const raffles = [
        await givenActiveRaffle([1]),
        await givenActiveRaffle([1]),
      ];
      const orders = await Promise.all(
        raffles.map((raffleId) => givenOrderInVerification(raffleId, [1])),
      );
      const operation = randomUUID();

      const results = await Promise.allSettled(
        orders.map(({ orderId }) =>
          approveWith().execute(approval(orderId, operation)),
        ),
      );

      const refused = results.filter((r) => r.status === 'rejected');
      expect(refused).toHaveLength(1);
      expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        DuplicatePaymentError,
      );
      const stored = await Promise.all(
        orders.map(({ orderId }) => orderRepo.findById(orderId)),
      );
      expect(stored.map((o) => o?.status).sort()).toEqual([
        'PAID',
        'PENDING_VERIFICATION',
      ]);
      const sold = await Promise.all(
        raffles.map((raffleId) => ticketOf(raffleId, 1)),
      );
      expect(sold.map((t) => t.status).sort()).toEqual(['RESERVED', 'SOLD']);
    });
  });

  describe('collision between two banks (DT-12)', () => {
    const collision = {
      reason: 'Two banks issued the same number',
      bank: BankOrWallet.BCP,
    };

    const collisionEvents = (raffleId: string) =>
      prisma.auditEvent.findMany({
        where: { raffleId, type: 'OPERATION_COLLISION_DECLARED' },
      });

    async function givenRecordedOperation(raffleId: string, number = 1) {
      const operation = `OP${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const { orderId } = await givenOrderInVerification(raffleId, [number]);
      await approveWith().execute(approval(orderId, operation));
      return { operation, firstOrder: orderId };
    }

    it('approves under the number and the bank, and audits it', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation, firstOrder } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );

      await approveWith().execute({ ...approval(orderId, operation), collision });

      const [first] = await paymentRepo.findByOrderId(firstOrder);
      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(payment.externalId).toBe(`${operation}#BCP`);
      expect(payment.provider).toBe('BCP');
      expect((await ticketOf(raffleId, 2)).status).toBe('SOLD');
      const [event] = await collisionEvents(raffleId);
      expect(event.data).toEqual({
        orderId,
        paymentId: payment.id,
        operatorId: 'admin-1',
        reason: collision.reason,
        bank: 'BCP',
        operationNumber: operation,
        existingPaymentId: first.id,
        existingOrderId: firstOrder,
      });
    });

    it('rejects with money under the number and the bank', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(raffleId, [2]);

      await rejectWith().execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'Paid the wrong amount',
        moneyReceived: true,
        receivedAmount: 7.5,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: operation,
        collision,
      });

      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(payment.externalId).toBe(`${operation}#BCP`);
      expect((await orderRepo.findById(orderId))?.status).toBe('REFUND_PENDING');
      expect(await collisionEvents(raffleId)).toHaveLength(1);
    });

    it('confirms a late payment under the number and the bank', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [2]);
      await expireReservation(order.id);
      await releaseExpired().execute(raffleId);
      await new ClaimLatePaymentUseCase(
        orderRepo,
        ledger,
        proofStorage,
        proofPolicy,
        clock,
      ).execute(declaration(order.id, buyer));

      await new ConfirmLatePaymentUseCase(
        orderRepo,
        ledger,
        clock,
      ).execute({
        orderId: order.id,
        operatorId: 'admin-1',
        receivedAmount: 7.5,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: operation,
        collision,
      });

      const [payment] = await paymentRepo.findByOrderId(order.id);
      expect(payment.externalId).toBe(`${operation}#BCP`);
      expect((await refundRepo.findByOrderId(order.id))?.amount).toBe(7.5);
      expect(await collisionEvents(raffleId)).toHaveLength(1);
    });

    it('is refused with no payment under that number', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [1],
        BankOrWallet.BCP,
      );

      await expect(
        approveWith().execute({ ...approval(orderId), collision }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(await collisionEvents(raffleId)).toEqual([]);
    });

    it('is refused for the bank that already holds the number', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(raffleId, [2]);

      await expect(
        approveWith().execute({
          ...approval(orderId, operation),
          collision: { ...collision, bank: BankOrWallet.YAPE },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
    });

    it('is refused for a bank other than the one the order declared', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );

      await expect(
        approveWith().execute({
          ...approval(orderId, operation),
          collision: { ...collision, bank: BankOrWallet.BBVA },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect((await ticketOf(raffleId, 2)).status).toBe('RESERVED');
      expect(await collisionEvents(raffleId)).toEqual([]);
    });

    it('is refused with a reason over 500 characters', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );

      await expect(
        approveWith().execute({
          ...approval(orderId, operation),
          collision: { ...collision, reason: 'r'.repeat(501) },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);

      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(await collisionEvents(raffleId)).toEqual([]);
    });

    it('is refused with a blank reason', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );

      await expect(
        approveWith().execute({
          ...approval(orderId, operation),
          collision: { ...collision, reason: '   ' },
        }),
      ).rejects.toThrow(InvalidOperationCollisionError);
    });

    it('refuses a second use with the same number and bank', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      const { operation } = await givenRecordedOperation(raffleId);
      const second = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );
      const third = await givenOrderInVerification(
        raffleId,
        [3],
        BankOrWallet.BCP,
      );
      await approveWith().execute({
        ...approval(second.orderId, operation),
        collision,
      });

      await expect(
        approveWith().execute({
          ...approval(third.orderId, operation),
          collision,
        }),
      ).rejects.toThrow(DuplicatePaymentError);

      expect(await paymentRepo.findByOrderId(third.orderId)).toEqual([]);
      expect((await ticketOf(raffleId, 3)).status).toBe('RESERVED');
      expect(await collisionEvents(raffleId)).toHaveLength(1);
    });

    it('lets only one of two simultaneous uses win', async () => {
      const first = await givenActiveRaffle([1]);
      const { operation } = await givenRecordedOperation(first);
      const raffles = [
        await givenActiveRaffle([1]),
        await givenActiveRaffle([1]),
      ];
      const orders = await Promise.all(
        raffles.map((raffleId) =>
          givenOrderInVerification(raffleId, [1], BankOrWallet.BCP),
        ),
      );

      const results = await Promise.allSettled(
        orders.map(({ orderId }) =>
          approveWith().execute({ ...approval(orderId, operation), collision }),
        ),
      );

      const refused = results.filter((r) => r.status === 'rejected');
      expect(refused).toHaveLength(1);
      expect((refused[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        DuplicatePaymentError,
      );
      const stored = await Promise.all(
        orders.map(({ orderId }) => orderRepo.findById(orderId)),
      );
      expect(stored.map((o) => o?.status).sort()).toEqual([
        'PAID',
        'PENDING_VERIFICATION',
      ]);
      const events = await Promise.all(raffles.map(collisionEvents));
      expect(events.flat()).toHaveLength(1);
    });

    it('rolls back everything when the audit fails', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );

      await expect(
        approveWith(ledgerFailingOnAudit).execute({
          ...approval(orderId, operation),
          collision,
        }),
      ).rejects.toThrow();

      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect((await ticketOf(raffleId, 2)).status).toBe('RESERVED');
      expect(await collisionEvents(raffleId)).toEqual([]);
    });

    it('lists the uses for the operators', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { operation, firstOrder } = await givenRecordedOperation(raffleId);
      const { orderId } = await givenOrderInVerification(
        raffleId,
        [2],
        BankOrWallet.BCP,
      );
      await approveWith().execute({ ...approval(orderId, operation), collision });

      const uses = await new ListOperationCollisionsUseCase(
        paymentRepo,
      ).execute();

      expect(uses.find((u) => u.orderId === orderId)).toMatchObject({
        operationNumber: operation,
        bank: 'BCP',
        reason: collision.reason,
        operatorId: 'admin-1',
        existingOrderId: firstOrder,
      });
    });
  });

  describe('received amount format (DT-12)', () => {
    const newOperation = () =>
      `OP${randomUUID().replaceAll('-', '').toUpperCase()}`;

    const rejecting = (
      orderId: string,
      receivedAmount: number,
      overpayment: { confirmed: true; reason: string } | null = null,
    ) =>
      rejectWith().execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'Paid the wrong amount',
        moneyReceived: true,
        receivedAmount,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: newOperation(),
        overpayment,
      });

    it('stores the largest amount the column holds', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await rejecting(orderId, 99999999.99, {
        confirmed: true,
        reason: 'Buyer sent extra',
      });

      expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(
        99999999.99,
      );
    });

    it.each([100000000, 7.505])(
      'refuses %d and leaves the order untouched',
      async (receivedAmount) => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await expect(rejecting(orderId, receivedAmount)).rejects.toThrow(
          InvalidPaymentProofError,
        );

        expect((await orderRepo.findById(orderId))?.status).toBe(
          'PENDING_VERIFICATION',
        );
        expect(await refundRepo.findByOrderId(orderId)).toBeNull();
        expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      },
    );

    it('ignores the details of a repeat on a paid order', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const operation = newOperation();
      await approveWith().execute(approval(orderId, operation));

      await approveWith().execute({
        ...approval(orderId, `${operation}X`),
        receivedAmount: 1,
      });

      const payments = await paymentRepo.findByOrderId(orderId);
      expect(payments).toHaveLength(1);
      expect(payments[0].externalId).toBe(operation);
      expect((await orderRepo.findById(orderId))?.operationNumber).toBe(
        operation,
      );
    });
  });

  describe('money above the order total (DT-14)', () => {
    const rejectingAbove = (
      orderId: string,
      overpayment: { confirmed: true; reason: string } | null,
    ) =>
      rejectWith().execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'Paid twice the price',
        moneyReceived: true,
        receivedAmount: 10.01,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: `OP${randomUUID().replaceAll('-', '').toUpperCase()}`,
        overpayment,
      });

    it('refuses one cent above the total without a confirmation, writing nothing', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const eventsBefore = await prisma.auditEvent.count({ where: { raffleId } });

      await expect(rejectingAbove(orderId, null)).rejects.toThrow(
        OverpaymentNotConfirmedError,
      );

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(await prisma.auditEvent.count({ where: { raffleId } })).toBe(
        eventsBefore,
      );
      expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toEqual([]);
    });

    it('refunds a confirmed overpayment and audits it in the same transaction', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await rejectingAbove(orderId, {
        confirmed: true,
        reason: 'Buyer sent extra',
      });

      expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(10.01);
      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(payment.payload.overpayment).toEqual({
        reason: 'Buyer sent extra',
        difference: 0.01,
      });
      const [event] = await prisma.auditEvent.findMany({
        where: { raffleId, type: 'OVERPAYMENT_CONFIRMED' },
      });
      expect(event.data).toEqual({
        orderId,
        paymentId: payment.id,
        totalAmount: 10,
        receivedAmount: 10.01,
        difference: 0.01,
        operatorId: 'admin-1',
        reason: 'Buyer sent extra',
      });
    });

    it('rolls the confirmation back with the rejection', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        rejectWith(ledgerFailingOnAudit).execute({
          orderId,
          operatorId: 'admin-1',
          reason: 'Paid twice the price',
          moneyReceived: true,
          receivedAmount: 10.01,
          bankOrWallet: BankOrWallet.YAPE,
          operationNumber: `OP${randomUUID().replaceAll('-', '').toUpperCase()}`,
          overpayment: { confirmed: true, reason: 'Buyer sent extra' },
        }),
      ).rejects.toThrow('audit down');

      expect(await paymentRepo.findByOrderId(orderId)).toEqual([]);
      expect(
        await prisma.auditEvent.count({
          where: { raffleId, type: 'OVERPAYMENT_CONFIRMED' },
        }),
      ).toBe(0);
    });
  });

  describe('payment repository (DT-12)', () => {
    it('raises a duplicate instead of overwriting a payment', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const [payment] = await paymentRepo.findByOrderId(orderId);
      const other = await givenOrderInVerification(raffleId, [2]);

      await expect(
        paymentRepo.save(
          new Payment({
            id: randomUUID(),
            orderId: other.orderId,
            provider: 'PLIN',
            externalId: payment.externalId,
            status: 'TAMPERED',
            payload: {},
          }),
        ),
      ).rejects.toThrow(DuplicatePaymentError);

      const [stored] = await paymentRepo.findByOrderId(orderId);
      expect(stored.status).toBe(payment.status);
      expect(stored.provider).toBe(payment.provider);
    });
  });

  describe('operation number rule (DT-12)', () => {
    it.each([
      ['a zero-width space', (n: string) => `${n.slice(0, 3)}\u200B${n.slice(3)}`],
      ['an en dash', (n: string) => `${n.slice(0, 3)}\u2013${n.slice(3)}`],
      ['a minus sign', (n: string) => `${n.slice(0, 3)}\u2212${n.slice(3)}`],
      ['a no-break space', (n: string) => `${n.slice(0, 3)}\u00A0${n.slice(3)}`],
      [
        'full-width characters',
        (n: string) =>
          n.replace(/[0-9A-Z]/g, (c) =>
            String.fromCodePoint(c.codePointAt(0)! + 0xfee0),
          ),
      ],
    ])('stores %s as the same number', async (_case, paste) => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenOrderInVerification(raffleId, [1]);
      const second = await givenOrderInVerification(raffleId, [2]);
      const operation = `OP${randomUUID().replaceAll('-', '').toUpperCase()}`;
      await approveWith().execute(approval(first.orderId, paste(operation)));

      await expect(
        approveWith().execute(approval(second.orderId, operation)),
      ).rejects.toThrow(DuplicatePaymentError);

      const [payment] = await paymentRepo.findByOrderId(first.orderId);
      expect(payment.externalId).toBe(operation);
    });

    it.each(['\u0410B123', 'OP.123', '\u200B', '\u2014'])(
      'refuses %j and touches nothing',
      async (typed) => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await expect(
          approveWith().execute(approval(orderId, typed)),
        ).rejects.toThrow(InvalidOperationNumberError);

        expect((await orderRepo.findById(orderId))?.status).toBe(
          'PENDING_VERIFICATION',
        );
      },
    );
  });

  describe('verification past its review deadline (DT-06)', () => {
    function alertWith(usedLedger: TicketLedger = ledger) {
      return new AlertOverdueVerificationsUseCase(
        orderRepo,
        raffleRepo,
        usedLedger,
        clock,
      );
    }

    const overdueNotices = (raffleId: string) =>
      queued(raffleId, NotificationType.VERIFICATION_OVERDUE);

    it('keeps the order and its numbers, even for a stored expired hold', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);
      const [other] = await givenBuyers(1);

      expect(await releaseExpired().execute(raffleId)).toBe(0);

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect((await ticketOf(raffleId, 1)).orderId).toBe(orderId);
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      await expect(reserve(raffleId, other, [1])).rejects.toThrow(
        TicketNotAvailableError,
      );
    });

    it('releases an unpaid order scanned in the same run', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const [buyer] = await givenBuyers(1);
      const unpaid = await reserve(raffleId, buyer, [2]);
      await passReviewDeadline(orderId);
      await expireReservation(unpaid.id);

      expect(await releaseExpired().execute(raffleId)).toBe(1);

      expect((await orderRepo.findById(unpaid.id))?.status).toBe('EXPIRED');
      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
    });

    it('keeps counting the held numbers against the buyer limit', async () => {
      const numbers = Array.from({ length: 21 }, (_, i) => i + 1);
      const raffleId = await givenActiveRaffle(numbers);
      const { orderId, buyer } = await givenOrderInVerification(
        raffleId,
        numbers.slice(0, 20),
      );
      await passReviewDeadline(orderId);

      await expect(reserve(raffleId, buyer, [21])).rejects.toThrow(
        TicketReservationLimitError,
      );
    });

    it('can still be approved', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);

      await approveWith().execute(approval(orderId));

      expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
    });

    it('can still be rejected', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);

      await rejectWith().execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'Not received',
        moneyReceived: false,
      });

      expect((await orderRepo.findById(orderId))?.status).toBe('REJECTED');
      expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');
    });

    it('refuses the approval from the close of sales on, before CloseSales runs', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await moveCloseOfSales(raffleId, new Date(Date.now() - 1_000));

      await expect(approveWith().execute(approval(orderId))).rejects.toThrow(
        SalesClosedError,
      );

      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
    });

    it('is resolved by the close of sales', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);

      await closeSalesWith().execute(raffleId);

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect((await ticketOf(raffleId, 1)).status).toBe('AVAILABLE');
    });

    it('alerts the operator once, and survives the resolution of the order', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);

      await alertWith().execute();
      await alertWith().execute();

      const alerted = await overdueNotices(raffleId);
      expect(alerted).toHaveLength(1);
      expect(alerted[0].recipient).toBeNull();
      expect(alerted[0].payload).toMatchObject({
        orderId,
        raffleTitle: 'Integration raffle',
      });
      const alertedAt = (await orderRepo.findById(orderId))?.overdueAlertedAt;
      expect(alertedAt).toBeInstanceOf(Date);

      await approveWith().execute(approval(orderId));

      const paid = await orderRepo.findById(orderId);
      expect(paid?.status).toBe('PAID');
      expect(paid?.overdueAlertedAt).toEqual(alertedAt);
    });

    it('marks and queues in one transaction, and retries one that failed', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await passReviewDeadline(orderId);
      const failingOnQueue: TicketLedger = {
        run: (work) =>
          ledger.run((tx) => {
            const sabotaged = Object.create(tx) as LedgerTransaction;
            sabotaged.enqueueNotification = () =>
              Promise.reject(new Error('outbox down'));
            return work(sabotaged);
          }),
      };

      await alertWith(failingOnQueue).execute();

      expect((await orderRepo.findById(orderId))?.overdueAlertedAt).toBeNull();
      expect(await overdueNotices(raffleId)).toEqual([]);

      await alertWith().execute();

      expect(
        (await orderRepo.findById(orderId))?.overdueAlertedAt,
      ).toBeInstanceOf(Date);
      expect(await overdueNotices(raffleId)).toHaveLength(1);
    });

    it('does not alert an order still within its deadline, nor a resolved one', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const within = await givenOrderInVerification(raffleId, [1]);
      const paid = await givenPaidOrder(raffleId, [2]);
      await prisma.ticketOrder.update({
        where: { id: paid },
        data: { verificationDueAt: new Date(Date.now() - 60_000) },
      });

      await alertWith().execute();

      const orderIds = (await overdueNotices(raffleId)).map((a) => a.orderId);
      expect(orderIds).not.toContain(within.orderId);
      expect(orderIds).not.toContain(paid);
    });

    it('leaves a row with no due date in place, unalerted and approvable', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await expireReservation(orderId);
      await prisma.ticketOrder.update({
        where: { id: orderId },
        data: { verificationDueAt: null },
      });

      await alertWith().execute();
      expect(await releaseExpired().execute(raffleId)).toBe(0);

      expect(await overdueNotices(raffleId)).toEqual([]);
      await approveWith().execute(approval(orderId));
      expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
    });
  });

  describe('notification outbox (DT-13)', () => {
    const outbox = new PrismaNotificationOutbox(prisma);
    const silentLog = { log: () => undefined, warn: () => undefined, error: () => undefined };

    function dispatcher(
      notifier: FakeNotifier,
      policy = new NotificationRetryPolicy({ batchSize: 500 }),
    ) {
      return new DispatchNotificationsUseCase(
        outbox,
        ledger,
        notifier,
        policy,
        clock,
        silentLog,
      );
    }

    /** Sends what earlier tests left queued, so each test sees only its rows. */
    async function flushOutbox(): Promise<void> {
      const flush = dispatcher(new FakeNotifier());
      let result = await flush.execute();
      while (result.sent > 0) {
        result = await flush.execute();
      }
    }

    const confirmation = (
      orderId: string,
      raffleId: string,
    ): NotificationMessage => ({
      type: NotificationType.TICKET_CONFIRMATION,
      recipient: 'buyer',
      payload: {
        orderId,
        raffleId,
        raffleTitle: 'Integration raffle',
        numbers: [1],
        totalAmount: 10,
      },
    });

    function enqueue(orderId: string, raffleId: string, version: string) {
      return ledger.run((tx) =>
        tx.enqueueNotification({
          message: confirmation(orderId, raffleId),
          orderId,
          raffleId,
          version,
          createdAt: new Date(),
        }),
      );
    }

    beforeEach(flushOutbox);

    describe('partial index on PENDING rows', () => {
      const pendingIndex = 'NotificationOutbox_pending_nextAttemptAt_idx';

      /** EXPLAIN EXECUTE takes no bound parameters; these values are ours. */
      const literal = (value: unknown): string =>
        typeof value === 'number'
          ? String(value)
          : `'${String(value).replace(/'/g, "''")}'`;

      let planCount = 0;

      /** The plan Postgres keeps for a prepared statement, whatever its values. */
      async function genericPlan(query: Prisma.Sql): Promise<string> {
        const name = `outbox_plan_${process.pid}_${(planCount += 1)}`;
        return prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            'SET LOCAL plan_cache_mode = force_generic_plan',
          );
          // An empty table makes a scan cheapest; the question is only whether
          // the index can serve the query at all.
          await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
          await tx.$executeRawUnsafe(`PREPARE ${name} AS ${query.text}`);
          const args = query.values.map(literal).join(', ');
          const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
            `EXPLAIN EXECUTE ${name}(${args})`,
          );
          await tx.$executeRawUnsafe(`DEALLOCATE ${name}`);
          return rows.map((r) => r['QUERY PLAN']).join('\n');
        });
      }

      it('exists, so a migration that drops it fails here', async () => {
        const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
          SELECT indexdef FROM pg_indexes
          WHERE tablename = 'NotificationOutbox' AND indexname = ${pendingIndex}
        `;
        expect(rows).toHaveLength(1);
        expect(rows[0].indexdef).toContain(`WHERE (status = 'PENDING'::text)`);
      });

      it('serves the claim under a generic plan', async () => {
        const now = new Date();
        const plan = await genericPlan(
          claimDueSql(now, 50, new Date(now.getTime() + 60_000), 11),
        );
        expect(plan).toContain(pendingIndex);
      });

      it('serves the sweep of exhausted rows under a generic plan', async () => {
        const plan = await genericPlan(exhaustedSql(new Date(), 11, 50));
        expect(plan).toContain(pendingIndex);
      });
    });

    it('writes the email with the approval, PENDING and unsent', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId, buyer } = await givenOrderInVerification(raffleId, [1]);

      await approveWith().execute(approval(orderId));

      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(await queued(raffleId)).toMatchObject([
        {
          type: NotificationType.TICKET_CONFIRMATION,
          recipient: buyer,
          orderId,
          status: NotificationStatus.PENDING,
          attempts: 0,
          sentAt: null,
          // The version is the event itself: the approved payment.
          dedupeKey: `TICKET_CONFIRMATION:${orderId}:${payment.id}`,
          payload: { orderId, raffleId, numbers: [1], totalAmount: 10 },
        },
      ]);
    });

    it('writes the data to verify the draw into the approval email (DT-20)', async () => {
      const commitmentHash = 'c0'.repeat(32);
      const drawAt = new Date(Date.now() + 8 * 24 * 3_600_000);
      const salesCloseAt = new Date(Date.now() + 7 * 24 * 3_600_000);
      const raffleId = await givenActiveRaffle([1], salesCloseAt, {
        commitmentHash,
        drandRound: 24680135n,
        drawAt,
      });
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await approveWith().execute(approval(orderId));

      const [row] = await queued(raffleId, NotificationType.TICKET_CONFIRMATION);
      expect(row.payload).toEqual({
        orderId,
        raffleId,
        raffleTitle: 'Integration raffle',
        numbers: [1],
        totalAmount: 10,
        verification: {
          commitmentHash,
          drandRound: '24680135',
          drawAt: drawAt.toISOString(),
          salesCloseAt: salesCloseAt.toISOString(),
        },
      });
    });

    it('writes no email when the approval rolls back', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        approveWith(ledgerFailingOnAudit).execute(approval(orderId)),
      ).rejects.toThrow('audit down');

      expect(await queued(raffleId)).toEqual([]);
    });

    it('keeps one row per event and lets the transaction go on', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const [payment] = await paymentRepo.findByOrderId(orderId);

      const repeated = await ledger.run(async (tx) => {
        const added = await tx.enqueueNotification({
          message: confirmation(orderId, raffleId),
          orderId,
          raffleId,
          version: payment.id,
          createdAt: new Date(),
        });
        // Still usable: a duplicate must not abort the transaction.
        await tx.recordAudit({ raffleId, type: 'AFTER_DUPLICATE', data: {} });
        return added;
      });

      expect(repeated).toBe(false);
      expect(await queued(raffleId)).toHaveLength(1);
      expect(await auditTypes(raffleId)).toContain('AFTER_DUPLICATE');
      expect(await enqueue(orderId, raffleId, 'OTHER-VERSION')).toBe(true);
    });

    it('sends each queued email once and marks it sent', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const notifier = new FakeNotifier();

      await dispatcher(notifier).execute();
      await dispatcher(notifier).execute();

      expect(notifier.confirmations.map((c) => c.data.orderId)).toEqual([
        orderId,
      ]);
      const [row] = await queued(raffleId);
      expect(row).toMatchObject({ status: 'SENT', attempts: 1 });
      expect(row.sentAt).toBeInstanceOf(Date);
    });

    it('never sends one row twice when dispatchers run in parallel', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      for (let version = 0; version < 30; version++) {
        await enqueue(orderId, raffleId, `v${version}`);
      }
      const notifiers = Array.from({ length: 4 }, () => new FakeNotifier());
      const smallBatches = new NotificationRetryPolicy({ batchSize: 5 });

      await Promise.all(
        notifiers.map((n) => dispatcher(n, smallBatches).execute()),
      );
      await Promise.all(notifiers.map((n) => dispatcher(n).execute()));

      const sent = notifiers.flatMap((n) => n.confirmations);
      expect(sent).toHaveLength(31);
      const rows = await queued(raffleId);
      expect(rows).toHaveLength(31);
      expect(rows.every((r) => r.status === 'SENT' && r.attempts === 1)).toBe(
        true,
      );
    });

    it('skips a row another transaction holds instead of waiting for it', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const held = await givenPaidOrder(raffleId, [1]);
      const free = await givenPaidOrder(raffleId, [2]);
      const [heldRow] = (await queued(raffleId)).filter(
        (r) => r.orderId === held,
      );
      const release = gate();
      const locked = gate();
      const holding = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM "NotificationOutbox" WHERE id = ${heldRow.id} FOR UPDATE
          `;
          locked.open();
          await release.opened;
        },
        { timeout: 20_000 },
      );
      await locked.opened;

      try {
        const claiming = outbox.claimDue(
          new Date(),
          500,
          new Date(Date.now() + 60_000),
          100,
        );
        expect(await stillRunning(claiming)).toBe(false);
        const claimed = await claiming;
        expect(claimed.map((c) => c.orderId)).toContain(free);
        // The claim hands back whole rows, payload included.
        expect(claimed.find((c) => c.orderId === free)).toMatchObject({
          status: 'PENDING',
          attempts: 1,
          type: NotificationType.TICKET_CONFIRMATION,
          payload: { orderId: free, raffleId },
        });
        expect(claimed.map((c) => c.id)).not.toContain(heldRow.id);
      } finally {
        release.open();
        await holding;
      }
    });

    it('gives up after the last attempt and raises the alert in the same step', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const notifier = new FakeNotifier();
      notifier.failAll(new Error('SMTP unavailable'));

      const result = await dispatcher(
        notifier,
        new NotificationRetryPolicy({ maxAttempts: 1, batchSize: 500 }),
      ).execute();

      expect(result).toMatchObject({ sent: 0, failed: 1 });
      const [row] = await queued(raffleId);
      expect(row).toMatchObject({
        status: 'FAILED',
        attempts: 1,
        lastError: 'Error: SMTP unavailable',
      });
      const alerts = await prisma.operatorAlert.findMany({
        where: { orderId, type: OperatorAlertType.NOTIFICATION_FAILED },
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ raffleId, readAt: null });
      expect(Number(alerts[0].amount)).toBe(10);
      expect(await auditTypes(raffleId)).toContain('NOTIFICATION_FAILED');
    });

    it('shows a read failure alert again when another email of the order fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const failing = new FakeNotifier();
      failing.failAll();
      const giveUpAtOnce = new NotificationRetryPolicy({
        maxAttempts: 1,
        batchSize: 500,
      });
      await dispatcher(failing, giveUpAtOnce).execute();
      await prisma.operatorAlert.updateMany({
        where: { orderId },
        data: { readAt: new Date(), readBy: 'admin-1' },
      });

      await enqueue(orderId, raffleId, 'SECOND');
      await dispatcher(failing, giveUpAtOnce).execute();

      const alerts = await prisma.operatorAlert.findMany({
        where: { orderId },
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ readAt: null, readBy: null });
    });

    it('lets a stale attempt neither give up nor retry a row claimed again', async () => {
      const raffleId = await givenActiveRaffle([1]);
      await givenPaidOrder(raffleId, [1]);
      const [{ id }] = await queued(raffleId);
      const now = new Date();
      // The first lease runs out, so a second dispatcher claims the row again.
      await outbox.claimDue(now, 500, now, 100);
      await outbox.claimDue(new Date(now.getTime() + 1), 500, now, 100);

      const gaveUp = await ledger.run((tx) =>
        tx.failNotification(id, 1, 'stale', new Date()),
      );
      const retried = await outbox.scheduleRetry(id, 1, 'stale', new Date());
      const renewed = await outbox.renewLease(id, 1, new Date());
      const sent = await outbox.markSent(id, 1, new Date());

      expect([gaveUp, retried, renewed, sent]).toEqual([
        false,
        false,
        false,
        false,
      ]);
      const row = await prisma.notificationOutbox.findUniqueOrThrow({
        where: { id },
      });
      expect(row).toMatchObject({ status: 'PENDING', attempts: 2, lastError: null });
      await outbox.markSent(id, 2, new Date());
    });

    it('claims no exhausted row and gives it up with its alert instead', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const policy = new NotificationRetryPolicy({ batchSize: 500 });
      await prisma.notificationOutbox.updateMany({
        where: { orderId },
        data: { attempts: policy.maxAttempts },
      });

      expect(
        (
          await outbox.claimDue(
            new Date(),
            500,
            new Date(Date.now() + 60_000),
            policy.maxAttempts,
          )
        ).map((c) => c.orderId),
      ).not.toContain(orderId);

      const notifier = new FakeNotifier();
      await dispatcher(notifier, policy).execute();

      expect(notifier.confirmations).toEqual([]);
      const [row] = await queued(raffleId);
      expect(row.status).toBe('FAILED');
      expect(row.lastError).toContain('Exhausted');
      expect(
        await prisma.operatorAlert.count({
          where: { orderId, type: OperatorAlertType.NOTIFICATION_FAILED },
        }),
      ).toBe(1);
    });

    it('requeues a failed email for an operator, with its alert read and audited', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const failing = new FakeNotifier();
      failing.failAll();
      await dispatcher(
        failing,
        new NotificationRetryPolicy({ maxAttempts: 1, batchSize: 500 }),
      ).execute();
      const [failed] = await queued(raffleId);

      await new RequeueFailedNotificationUseCase(ledger, clock).execute({
        notificationId: failed.id,
        operatorId: 'admin-1',
      });

      const [row] = await queued(raffleId);
      expect(row).toMatchObject({ status: 'PENDING', attempts: 0 });
      const [alert] = await prisma.operatorAlert.findMany({
        where: { orderId, type: OperatorAlertType.NOTIFICATION_FAILED },
      });
      expect(alert.readBy).toBe('admin-1');
      expect(await auditTypes(raffleId)).toContain('NOTIFICATION_REQUEUED');

      const notifier = new FakeNotifier();
      await dispatcher(notifier).execute();
      expect(notifier.confirmations.map((c) => c.data.orderId)).toContain(
        orderId,
      );
    });

    it('purges the content of old sent emails and keeps their dedupe key', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await dispatcher(new FakeNotifier()).execute();
      const [sent] = await queued(raffleId);
      await prisma.notificationOutbox.update({
        where: { id: sent.id },
        data: { sentAt: new Date(Date.now() - 31 * 86_400_000) },
      });
      const recentRaffle = await givenActiveRaffle([1]);
      await givenPaidOrder(recentRaffle, [1]);
      await dispatcher(new FakeNotifier()).execute();

      const purged = await new PurgeSentNotificationsUseCase(
        outbox,
        clock,
        30,
      ).execute();

      expect(purged).toBeGreaterThanOrEqual(1);
      const [row] = await queued(raffleId);
      expect(row).toMatchObject({ status: 'SENT', payload: null, recipient: null });
      const [recent] = await queued(recentRaffle);
      expect(recent.status).toBe('SENT');
      expect(recent.payload).not.toBeNull();
      const version = row.dedupeKey.split(':')[2];
      expect(await enqueue(orderId, raffleId, version)).toBe(false);
      expect(await queued(raffleId)).toHaveLength(1);
    });

    it('claims through a partial index of PENDING rows', async () => {
      const [index] = await prisma.$queryRaw<{ indexdef: string }[]>`
        SELECT indexdef FROM pg_indexes
        WHERE tablename = 'NotificationOutbox'
          AND indexname = 'NotificationOutbox_pending_nextAttemptAt_idx'
      `;

      expect(index.indexdef).toContain(`WHERE (status = 'PENDING'::text)`);
    });

    it('logs a skipped duplicate at debug level', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const [row] = await queued(raffleId);
      const debug = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);

      try {
        expect(await enqueue(orderId, raffleId, row.dedupeKey.split(':')[2])).toBe(
          false,
        );
        expect(debug).toHaveBeenCalledWith(
          `Skipped a duplicate notification ${row.dedupeKey}`,
        );
      } finally {
        debug.mockRestore();
      }
    });

    it('keeps a failed email queued for a later retry', async () => {
      const raffleId = await givenActiveRaffle([1]);
      await givenPaidOrder(raffleId, [1]);
      const failing = new FakeNotifier();
      failing.failAll(new Error('SMTP unavailable'));
      const before = Date.now();

      // A day of wait: no later test may find this row due.
      await dispatcher(
        failing,
        new NotificationRetryPolicy({
          baseDelaySeconds: 86_400,
          maxDelaySeconds: 86_400,
          batchSize: 500,
        }),
      ).execute();

      const [row] = await queued(raffleId);
      expect(row).toMatchObject({
        status: 'PENDING',
        attempts: 1,
        lastError: 'Error: SMTP unavailable',
      });
      expect(row.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
        before + 86_400_000,
      );
    });
  });

  describe('ticket counts by status (RF-01)', () => {
    it('counts every requested raffle in one aggregate, zeros included', async () => {
      const busy = await givenActiveRaffle([1, 2, 3, 4, 5]);
      const quiet = await givenActiveRaffle([1, 2, 3]);
      await givenPaidOrder(busy, [1]);
      await givenOrderInVerification(busy, [2]);
      const [buyer] = await givenBuyers(1);
      await reserve(busy, buyer, [3]);
      const unknown = randomUUID();

      const counts = await ticketRepo.countByStatus([busy, quiet, unknown]);

      expect(counts.get(busy)).toEqual({ AVAILABLE: 2, RESERVED: 2, SOLD: 1, REFUNDED: 0 });
      expect(counts.get(quiet)).toEqual({ AVAILABLE: 3, RESERVED: 0, SOLD: 0, REFUNDED: 0 });
      expect(counts.get(unknown)).toEqual({ AVAILABLE: 0, RESERVED: 0, SOLD: 0, REFUNDED: 0 });
      expect(await ticketRepo.countByStatus([])).toEqual(new Map());
    });
  });

  describe('reservation release', () => {
    it('frees the tickets and expires the order as one unit', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1, 2]);
      await expireReservation(order.id);

      const released = await releaseExpired().execute(raffleId);

      expect(released).toBe(2);
      const ticket = await ticketOf(raffleId, 1);
      expect(ticket.status).toBe('AVAILABLE');
      expect(ticket.orderId).toBeNull();
      expect((await orderRepo.findById(order.id))?.status).toBe('EXPIRED');
    });

    it('rolls everything back when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);
      await expireReservation(order.id);

      await expect(
        new ReleaseExpiredReservationsUseCase(
          ticketRepo,
          ledgerFailingOnAudit,
          clock,
        ).execute(raffleId),
      ).rejects.toThrow('audit down');

      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect((await orderRepo.findById(order.id))?.status).toBe('PENDING');
    });
  });

  describe('guarded ledger writes', () => {
    it.each([
      ['status', { status: TicketStatus.SOLD }],
      ['order', { orderId: 'some-other-order' }],
    ])('rejects a ticket write with a stale %s and rolls back the rest', async (_field, stale) => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);

      await expect(
        ledger.run(async (tx) => {
          const [free] = await tx.lockTickets(raffleId, [2]);
          free.reserve(order.id, new Date(Date.now() + 60_000));
          await tx.transitionTickets([free], {
            status: TicketStatus.AVAILABLE,
            orderId: null,
          });

          const [held] = await tx.lockTickets(raffleId, [1]);
          held.release();
          await tx.transitionTickets([held], {
            status: TicketStatus.RESERVED,
            orderId: order.id,
            ...stale,
          });
        }),
      ).rejects.toThrow(StaleStateError);

      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
    });

    it('lets an audit event through while the raffle row is locked', async () => {
      const raffleId = await givenActiveRaffle([1]);
      let raffleLocked: () => void = () => undefined;
      const raffleIsLocked = new Promise<void>((resolve) => {
        raffleLocked = resolve;
      });
      let releaseRaffle: () => void = () => undefined;
      const raffleMayRelease = new Promise<void>((resolve) => {
        releaseRaffle = resolve;
      });
      const holder = ledger.run(async (tx) => {
        await tx.lockRaffle(raffleId);
        raffleLocked();
        await raffleMayRelease;
      });
      await raffleIsLocked;

      // A settlement holds ticket locks here: if this write waited for the
      // raffle lock, a cancellation wanting those tickets would deadlock it.
      const blocked = new Promise<string>((resolve) => {
        setTimeout(() => resolve('blocked'), 2_000);
      });
      const audit = prisma.auditEvent
        .create({ data: { raffleId, type: 'TEST_EVENT', data: {} } })
        .then(() => 'written');

      expect(await Promise.race([audit, blocked])).toBe('written');
      releaseRaffle();
      await holder;
      await audit;
    });

    it('rejects an order write from a stale status', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const { id } = await reserve(raffleId, buyer, [1]);

      await expect(
        ledger.run(async (tx) => {
          const order = await tx.lockOrder(id);
          order?.markExpired();
          await tx.saveOrder(order!, 'EXPIRED' as never);
        }),
      ).rejects.toThrow(StaleStateError);
    });

    it('rejects a refund write from a stale status', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });
      const refund = await refundRepo.findByOrderId(orderId);

      await expect(
        ledger.run(async (tx) => {
          const locked = await tx.lockRefund(refund!.id);
          locked?.complete({
            operatorId: 'admin',
            destination: 'Yape',
            operationNumber: 'R-1',
            completedAt: new Date(),
          });
          await tx.saveRefund(locked!, 'COMPLETED' as never);
        }),
      ).rejects.toThrow(StaleStateError);
    });

    it('allows one refund per order', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const refundOf = () =>
        new Refund({
          id: randomUUID(),
          orderId,
          raffleId,
          amount: 10,
          reason: 'x',
        });
      await ledger.run((tx) => tx.addRefund(refundOf()));

      await expect(
        ledger.run((tx) => tx.addRefund(refundOf())),
      ).rejects.toThrow();
    });

    it('maps a repeated external payment id to a domain error', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const [buyer] = await givenBuyers(1);
      const first = await reserve(raffleId, buyer, [1]);
      const second = await reserve(raffleId, buyer, [2]);
      const externalId = randomUUID();
      const paymentFor = (orderId: string, provider: string) =>
        new Payment({
          id: randomUUID(),
          orderId,
          provider,
          externalId,
          status: 'APPROVED',
          payload: { verifiedBy: 'admin-1' },
        });
      await ledger.run((tx) => tx.addPayment(paymentFor(first.id, 'YAPE')));

      await expect(
        ledger.run((tx) => tx.addPayment(paymentFor(second.id, 'PLIN'))),
      ).rejects.toThrow(DuplicatePaymentError);
    });
  });

  describe('raffle cancellation', () => {
    it('leaves paid orders awaiting the money, and marks nothing REFUNDED', async () => {
      const raffleId = await givenActiveRaffle([1, 2, 3]);
      const paid = await givenPaidOrder(raffleId, [1]);
      const verifying = await givenOrderInVerification(raffleId, [2]);
      const [buyer] = await givenBuyers(1);
      const unpaid = await reserve(raffleId, buyer, [3]);

      await cancelWith().execute({ raffleId, reason: 'Force majeure' });

      expect((await raffleRepo.findById(raffleId))?.status).toBe('CANCELLED');
      expect((await orderRepo.findById(paid))?.status).toBe('REFUND_PENDING');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
      expect((await orderRepo.findById(verifying.orderId))?.status).toBe(
        OrderStatus.LATE_PAYMENT_REVIEW,
      );
      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await orderRepo.findById(unpaid.id))?.status).toBe('EXPIRED');
      expect((await ticketOf(raffleId, 3)).status).toBe('AVAILABLE');

      const pending = await refundRepo.findPending();
      const orderIds = pending.map((r) => r.orderId);
      expect(orderIds).toContain(paid);
      expect(orderIds).not.toContain(verifying.orderId);
      expect(orderIds).not.toContain(unpaid.id);
    });

    it('rolls everything back when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const order = await givenPaidOrder(raffleId, [1]);

      await expect(
        cancelWith(ledgerFailingOnAudit).execute({
          raffleId,
          reason: 'Force majeure',
        }),
      ).rejects.toThrow('audit down');

      expect((await raffleRepo.findById(raffleId))?.status).toBe('ACTIVE');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
      expect((await orderRepo.findById(order))?.status).toBe('PAID');
      expect(await refundRepo.findByOrderId(order)).toBeNull();
    });

    it('blocks approvals once cancelled', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });

      await expect(
        approveWith().execute(approval(orderId)),
      ).rejects.toThrow(RaffleNotActiveError);
    });

    it('does not deadlock against approvals and reservations', async () => {
      for (let round = 0; round < 15; round++) {
        const raffleId = await givenActiveRaffle([1, 2, 3, 4]);
        await givenPaidOrder(raffleId, [1]);
        const { orderId } = await givenOrderInVerification(raffleId, [2, 3]);
        const [latecomer] = await givenBuyers(1);

        const [cancelled, approved, reserved] = await Promise.allSettled([
          cancelWith().execute({ raffleId, reason: 'Force majeure' }),
          approveWith().execute(approval(orderId)),
          reserve(raffleId, latecomer, [4]),
        ]);

        expect(cancelled.status).toBe('fulfilled');
        if (approved.status === 'rejected') {
          expect(approved.reason).toBeInstanceOf(RaffleNotActiveError);
        }
        if (reserved.status === 'rejected') {
          expect(reserved.reason).toBeInstanceOf(RaffleNotActiveError);
        }
      }
    });
  });

  describe.each([
    [
      'close of sales',
      (raffleId: string, used?: TicketLedger) =>
        closeSalesWith(used)
          .execute(raffleId)
          .then(() => undefined),
    ],
    [
      'raffle cancellation',
      (raffleId: string, used?: TicketLedger) =>
        cancelWith(used)
          .execute({ raffleId, reason: 'Force majeure' })
          .then(() => undefined),
    ],
  ])('unverified payment at %s (DT-10)', (name, resolve) => {
    const decide = () => ({
      confirm: new ConfirmLatePaymentUseCase(orderRepo, ledger, clock),
      dismiss: new DismissLatePaymentUseCase(orderRepo, ledger, clock),
    });

    const alertsOf = (orderId: string) =>
      prisma.operatorAlert.findMany({ where: { orderId } });

    it('reaches the queue with no Refund row, its alert and the declaration', async () => {
      const raffleId = await givenClosableRaffle([1, 2]);
      await givenPaidOrder(raffleId, [1]);
      const { orderId, buyer } = await givenOrderInVerification(raffleId, [2]);

      await resolve(raffleId);

      const order = await orderRepo.findById(orderId);
      expect(order?.status).toBe('LATE_PAYMENT_REVIEW');
      expect(order?.declaredAmount).toBe(10);
      expect(order?.operationNumber).toBe('OP-1');
      expect(order?.proofUrl).not.toBeNull();
      expect(await prisma.refund.count({ where: { orderId } })).toBe(0);
      expect((await ticketOf(raffleId, 2)).status).toBe('AVAILABLE');
      expect((await ticketOf(raffleId, 2)).orderId).toBeNull();

      const alerts = await alertsOf(orderId);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: OperatorAlertType.LATE_PAYMENT_CLAIM,
        raffleId,
        raffleTitle: 'Integration raffle',
        readAt: null,
      });
      expect(Number(alerts[0].amount)).toBe(10);

      const queue = await new ListLatePaymentClaimsUseCase(orderRepo).execute();
      expect(queue.map((o) => o.id)).toContain(orderId);

      const notices = await queued(raffleId, NotificationType.PAYMENT_UNDER_REVIEW);
      expect(notices).toMatchObject([
        {
          recipient: buyer,
          orderId,
          payload: {
            orderId,
            raffleTitle: 'Integration raffle',
            reason: expect.any(String),
          },
        },
      ]);
    });

    it('keeps the order out of the sold list', async () => {
      const raffleId = await givenClosableRaffle([1, 2]);
      await givenOrderInVerification(raffleId, [2]);
      await givenPaidOrder(raffleId, [1]);

      await resolve(raffleId);

      const sold = await ticketRepo.findSoldByRaffleId(raffleId);
      expect(sold.map((t) => t.number)).toEqual([1]);
    });

    it('rolls the order, the numbers and the alert back together', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(
        resolve(raffleId, ledgerFailingOnAudit),
      ).rejects.toThrow('audit down');

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'PENDING_VERIFICATION',
      );
      expect((await ticketOf(raffleId, 1)).status).toBe('RESERVED');
      expect(await alertsOf(orderId)).toEqual([]);
      expect(await queued(raffleId)).toEqual([]);
    });

    it('opens the refund for what the operator found', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await resolve(raffleId);

      await decide().confirm.execute({
        orderId,
        operatorId: 'admin-1',
        receivedAmount: 7.5,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: `BANK-${orderId}`,
      });

      expect((await refundRepo.findByOrderId(orderId))?.amount).toBe(7.5);
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'REFUND_PENDING',
      );
      const [payment] = await paymentRepo.findByOrderId(orderId);
      expect(payment.status).toBe('LATE_CONFIRMED');
      expect((await alertsOf(orderId))[0].readBy).toBe('admin-1');
    });

    it('leaves nothing to return when the operator dismisses it', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await resolve(raffleId);

      await decide().dismiss.execute({
        orderId,
        operatorId: 'admin-1',
        reason: 'No deposit found',
      });

      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_DISMISSED',
      );
      expect((await alertsOf(orderId))[0].readBy).toBe('admin-1');
    });

    // The close job may run twice (F5): a second close is a no-op. A second
    // cancel is still refused.
    it('running it again adds nothing', async () => {
      const raffleId = await givenClosableRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await resolve(raffleId);

      if (name === 'close of sales') {
        await expect(resolve(raffleId)).resolves.toBeUndefined();
      } else {
        await expect(resolve(raffleId)).rejects.toThrow(
          InvalidRaffleTransitionError,
        );
      }

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'LATE_PAYMENT_REVIEW',
      );
      expect(await alertsOf(orderId)).toHaveLength(1);
      // The first run queued its email; the refused one adds none.
      expect(await queued(raffleId, NotificationType.PAYMENT_UNDER_REVIEW)).toHaveLength(1);
    });

    it('cannot both sell and queue the same order under a simultaneous approval', async () => {
      for (let round = 0; round < 5; round++) {
        const raffleId = await givenClosableRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        const [, approved] = await Promise.allSettled([
          resolve(raffleId),
          approveWith().execute(approval(orderId)),
        ]);

        const status = (await orderRepo.findById(orderId))?.status;
        const alerts = await alertsOf(orderId);
        if (approved.status === 'fulfilled') {
          expect(status).not.toBe('LATE_PAYMENT_REVIEW');
          expect(alerts).toEqual([]);
        } else {
          expect(approved.reason).toBeInstanceOf(RaffleNotActiveError);
          expect(status).toBe('LATE_PAYMENT_REVIEW');
          expect(alerts).toHaveLength(1);
          expect(await ticketRepo.findSoldByRaffleId(raffleId)).toEqual([]);
        }
      }
    });
  });

  it('cancelling a closed raffle is refused and leaves the review alone', async () => {
    const raffleId = await givenClosableRaffle([1]);
    const { orderId } = await givenOrderInVerification(raffleId, [1]);
    await closeSalesWith().execute(raffleId);

    await expect(
      cancelWith(ledger).execute({
        raffleId,
        reason: 'Force majeure',
      }),
    ).rejects.toThrow(InvalidRaffleTransitionError);

    expect((await orderRepo.findById(orderId))?.status).toBe(
      'LATE_PAYMENT_REVIEW',
    );
    expect(await prisma.operatorAlert.count({ where: { orderId } })).toBe(1);
    expect(await prisma.refund.count({ where: { orderId } })).toBe(0);
    // Only the close queued an email; the refused cancel adds none.
    expect(await queued(raffleId, NotificationType.PAYMENT_UNDER_REVIEW)).toHaveLength(1);
  });

  it('audits the orders sent to review', async () => {
    const raffleId = await givenClosableRaffle([1]);
    const { orderId } = await givenOrderInVerification(raffleId, [1]);

    await closeSalesWith().execute(raffleId);

    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { raffleId, type: 'SALES_CLOSED' },
    });
    expect(event.data).toMatchObject({ ordersInReview: [orderId] });
    expect(event.data).not.toHaveProperty('unsettledRefundsCount');
  });

  describe('refund completion', () => {
    const completion = (refundId: string) => ({
      refundId,
      operatorId: 'admin-2',
      destination: 'Yape 999888777',
      operationNumber: 'R-1',
    });

    async function givenPendingRefund(): Promise<{
      raffleId: string;
      orderId: string;
      refundId: string;
    }> {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });
      const refund = await refundRepo.findByOrderId(orderId);
      return { raffleId, orderId, refundId: refund!.id };
    }

    it('marks order and tickets REFUNDED and audits the operator', async () => {
      const { raffleId, orderId, refundId } = await givenPendingRefund();

      await completeRefundWith().execute(completion(refundId));

      expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
      expect((await ticketOf(raffleId, 1)).status).toBe('REFUNDED');
      const refund = await refundRepo.findById(refundId);
      expect(refund?.status).toBe('COMPLETED');
      expect(refund?.destination).toBe('Yape 999888777');
      expect(refund?.completedAt).not.toBeNull();
      const event = await prisma.auditEvent.findFirstOrThrow({
        where: { raffleId, type: 'REFUND_COMPLETED' },
      });
      expect(event.data).toMatchObject({
        operatorId: 'admin-2',
        recordedBy: 'admin-1',
        operationNumber: 'R-1',
      });
      expect(await queued(raffleId, NotificationType.REFUND_COMPLETED)).toHaveLength(1);
      expect(
        (await refundRepo.findPending()).map((r) => r.id),
      ).not.toContain(refundId);
    });

    it('stays pending when the last write fails', async () => {
      const { raffleId, orderId, refundId } = await givenPendingRefund();

      await expect(
        completeRefundWith(ledgerFailingOnAudit).execute(
          completion(refundId),
        ),
      ).rejects.toThrow('audit down');

      expect((await orderRepo.findById(orderId))?.status).toBe(
        'REFUND_PENDING',
      );
      expect((await refundRepo.findById(refundId))?.status).toBe('PENDING');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
    });

    it('turns 10 simultaneous completions into one', async () => {
      const { raffleId, refundId } = await givenPendingRefund();
      const complete = completeRefundWith();

      await Promise.all(
        Array.from({ length: 10 }, () =>
          complete.execute(completion(refundId)),
        ),
      );

      expect(await queued(raffleId, NotificationType.REFUND_COMPLETED)).toHaveLength(1);
      const events = await auditTypes(raffleId);
      expect(events.filter((e) => e === 'REFUND_COMPLETED')).toHaveLength(1);
    });
  });

  describe('four-eyes refund completion (DT-17)', () => {
    // Approvals and money records in these tests are made by admin-1.
    const recorder = 'admin-1';
    const other = 'admin-2';

    const completion = (refundId: string, operatorId: string) => ({
      refundId,
      operatorId,
      destination: 'Yape 999888777',
      operationNumber: 'R-17',
    });

    async function refundOfCancel() {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });
      return { raffleId, refund: await refundRepo.findByOrderId(orderId) };
    }

    async function refundOfRejection() {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      await rejectWith().execute({
        orderId,
        operatorId: recorder,
        reason: 'Paid 6 instead of 10',
        moneyReceived: true,
        receivedAmount: 6,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: randomUUID(),
      });
      return { raffleId, refund: await refundRepo.findByOrderId(orderId) };
    }

    async function refundOfLateConfirm() {
      const raffleId = await givenActiveRaffle([1]);
      const [buyer] = await givenBuyers(1);
      const order = await reserve(raffleId, buyer, [1]);
      await expireReservation(order.id);
      await releaseExpired().execute(raffleId);
      await new ClaimLatePaymentUseCase(
        orderRepo,
        ledger,
        proofStorage,
        proofPolicy,
        clock,
      ).execute(declaration(order.id, buyer));
      await new ConfirmLatePaymentUseCase(orderRepo, ledger, clock).execute({
        orderId: order.id,
        operatorId: recorder,
        receivedAmount: 10,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: randomUUID(),
      });
      return { raffleId, refund: await refundRepo.findByOrderId(order.id) };
    }

    async function refundOfExtraTransfer() {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await new RecordExtraTransferUseCase(orderRepo, ledger, clock).execute({
        orderId,
        operatorId: 'admin-3',
        reason: 'Paid twice',
        receivedAmount: 4,
        bankOrWallet: BankOrWallet.BCP,
        operationNumber: randomUUID(),
      });
      const refund = await prisma.refund.findFirstOrThrow({
        where: { orderId, paymentId: { not: null } },
      });
      return { raffleId, refund: await refundRepo.findById(refund.id) };
    }

    async function refundOfAlteredListCancel() {
      const raffleId = await givenClosableRaffle([1, 2]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await closeSalesWith().execute(raffleId);
      const [userId] = await givenBuyers(1);
      const forged = await prisma.ticketOrder.create({
        data: {
          raffleId,
          userId,
          numbers: [2],
          totalAmount: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await prisma.$executeRaw`ALTER TABLE "Ticket" DISABLE TRIGGER trg_ticket_transition`;
      try {
        await prisma.ticket.update({
          where: { raffleId_number: { raffleId, number: 2 } },
          data: { status: 'SOLD', orderId: forged.id },
        });
      } finally {
        await prisma.$executeRaw`ALTER TABLE "Ticket" ENABLE TRIGGER trg_ticket_transition`;
      }
      await new CancelAlteredRaffleUseCase(ledger, clock).execute({
        raffleId,
        operatorId: 'admin-15',
        reason: 'Sold list altered after the close',
      });
      return { raffleId, refund: await refundRepo.findByOrderId(orderId) };
    }

    const origins: [string, string, () => Promise<{ raffleId: string; refund: Refund | null }>][] = [
      ['the cancel of a paid order', recorder, refundOfCancel],
      ['a rejection with money received', recorder, refundOfRejection],
      ['a late payment confirmation', recorder, refundOfLateConfirm],
      ['an extra transfer', 'admin-3', refundOfExtraTransfer],
      ['an altered-list cancel', recorder, refundOfAlteredListCancel],
    ];

    describe.each(origins)('for %s', (_, recordedBy, givenRefund) => {
      it('refuses the recorder and keeps the refusal in the audit', async () => {
        const { raffleId, refund } = await givenRefund();
        const order = await prisma.ticketOrder.findUniqueOrThrow({
          where: { id: refund!.orderId },
        });

        await expect(
          completeRefundWith().execute(completion(refund!.id, recordedBy)),
        ).rejects.toThrow(SameOperatorRefundError);

        expect((await refundRepo.findById(refund!.id))?.status).toBe('PENDING');
        expect(
          (await prisma.ticketOrder.findUniqueOrThrow({ where: { id: order.id } }))
            .status,
        ).toBe(order.status);
        const refused = await prisma.auditEvent.findFirstOrThrow({
          where: { raffleId, type: 'REFUND_COMPLETION_REFUSED' },
        });
        expect(refused.data).toEqual({
          refundId: refund!.id,
          orderId: order.id,
          operatorId: recordedBy,
          reason: 'SAME_OPERATOR',
        });
        expect(await auditTypes(raffleId)).not.toContain('REFUND_COMPLETED');
        expect(await queued(raffleId, NotificationType.REFUND_COMPLETED)).toEqual([]);
      });

      it('lets another operator complete it once', async () => {
        const { raffleId, refund } = await givenRefund();
        const completer = recordedBy === other ? 'admin-9' : other;

        await completeRefundWith().execute(completion(refund!.id, completer));
        await completeRefundWith().execute(completion(refund!.id, recordedBy));

        const done = await refundRepo.findById(refund!.id);
        expect(done).toMatchObject({ status: 'COMPLETED', operatorId: completer });
        const events = await prisma.auditEvent.findMany({
          where: { raffleId, type: 'REFUND_COMPLETED' },
        });
        expect(events).toHaveLength(1);
        expect(events[0].data).toMatchObject({ operatorId: completer, recordedBy });
        expect(await auditTypes(raffleId)).not.toContain('REFUND_COMPLETION_REFUSED');
      });
    });

    describe('database guard', () => {
      async function completeBehindTheUseCase(refundId: string, operatorId: string) {
        return prisma.refund.update({
          where: { id: refundId },
          data: {
            status: 'COMPLETED',
            operatorId,
            destination: 'Yape 1',
            operationNumber: 'R-SQL',
            completedAt: new Date(),
          },
        });
      }

      it('refuses completing a refund as the operator who recorded its money', async () => {
        const { refund } = await refundOfCancel();

        await expect(completeBehindTheUseCase(refund!.id, recorder)).rejects.toThrow(
          /Refund_same_operator/,
        );
        await expect(
          completeBehindTheUseCase(refund!.id, 'admin-3'),
        ).resolves.toMatchObject({ status: 'COMPLETED' });
      });

      it('refuses completing an extra refund as its recorder', async () => {
        const { refund } = await refundOfExtraTransfer();

        await expect(completeBehindTheUseCase(refund!.id, 'admin-3')).rejects.toThrow(
          /Refund_same_operator/,
        );
      });

      it.each([
        ['upper case', 'ADMIN-1'],
        ['spaces and a newline', ' Admin-1\n'],
      ])('canonicalizes the recorder written with %s in the app', async (_, operatorId) => {
        const { refund } = await refundOfCancel();

        await expect(
          completeRefundWith().execute(completion(refund!.id, operatorId)),
        ).rejects.toThrow(SameOperatorRefundError);
      });

      it.each([
        ['upper case', 'ADMIN-1'],
        ['a tab inside', 'admin-\t1'],
        ['spaces around', ' admin-1 '],
        ['only whitespace', ' \t '],
        ['a pipe', 'auth0|1'],
      ])('refuses a completer written with %s in SQL', async (_, operatorId) => {
        const { refund } = await refundOfCancel();

        await expect(completeBehindTheUseCase(refund!.id, operatorId)).rejects.toThrow(
          /Refund_operator_invalid/,
        );
      });

      it('refuses a completer with a tab inside in the app too', async () => {
        const { refund } = await refundOfCancel();

        await expect(
          completeRefundWith().execute(completion(refund!.id, 'admin-\t1')),
        ).rejects.toThrow(InvalidOperatorIdError);
      });

      it('refuses the recorder in SQL', async () => {
        const { refund } = await refundOfCancel();

        await expect(completeBehindTheUseCase(refund!.id, recorder)).rejects.toThrow(
          /Refund_same_operator/,
        );
      });

      it('checks a refund inserted already completed', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);
        const completed = (operatorId: string) =>
          prisma.refund.create({
            data: {
              orderId,
              raffleId,
              amount: 10,
              reason: 'Inserted completed',
              status: 'COMPLETED',
              operatorId,
              destination: 'Yape 1',
              operationNumber: 'R-INS',
              completedAt: new Date(),
            },
          });

        await expect(completed(recorder)).rejects.toThrow(/Refund_same_operator/);
        await expect(completed(other)).resolves.toMatchObject({ status: 'COMPLETED' });
      });

      it('refuses completing a refund with no money payment behind it', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const { orderId } = await givenOrderInVerification(raffleId, [1]);

        await expect(
          prisma.refund.create({
            data: {
              orderId,
              raffleId,
              amount: 10,
              reason: 'No money behind it',
              status: 'COMPLETED',
              operatorId: other,
              destination: 'Yape 1',
              operationNumber: 'R-NOPAY',
              completedAt: new Date(),
            },
          }),
        ).rejects.toThrow(/Refund_recorder_unknown/);
      });

      describe('a completed refund', () => {
        it('refuses deleting it, and lets a pending one go', async () => {
          const done = await givenCompletedRefund();

          await expect(
            prisma.refund.delete({ where: { id: done.id } }),
          ).rejects.toThrow(/Refund_completed_immutable: refund .* cannot be deleted/);
          const { refund: pending } = await refundOfExtraTransfer();
          await expect(
            prisma.refund.delete({ where: { id: pending!.id } }),
          ).resolves.toMatchObject({ id: pending!.id });
        });

        async function givenCompletedRefund() {
          const { refund } = await refundOfExtraTransfer();
          await completeRefundWith().execute(completion(refund!.id, other));
          return prisma.refund.findUniqueOrThrow({ where: { id: refund!.id } });
        }

        it.each([
          ['its operator', { operatorId: 'admin-9' }],
          ['its amount', { amount: 1 }],
          ['its destination', { destination: 'Elsewhere' }],
          ['its status back to pending', { status: 'PENDING' }],
        ])('refuses changing %s', async (_, data) => {
          const done = await givenCompletedRefund();

          await expect(
            prisma.refund.update({ where: { id: done.id }, data }),
          ).rejects.toThrow(/Refund_completed_immutable/);

          expect(
            await prisma.refund.findUniqueOrThrow({ where: { id: done.id } }),
          ).toEqual(done);
        });

        it('refuses moving it to another order or payment', async () => {
          const done = await givenCompletedRefund();
          const raffleId = await givenActiveRaffle([5]);
          const otherOrder = await givenPaidOrder(raffleId, [5]);

          await expect(
            prisma.$executeRaw`
              UPDATE "Refund" SET "orderId" = ${otherOrder} WHERE id = ${done.id}`,
          ).rejects.toThrow(/Refund_completed_immutable/);
          await expect(
            prisma.$executeRaw`
              UPDATE "Refund" SET "paymentId" = NULL WHERE id = ${done.id}`,
          ).rejects.toThrow(/Refund_completed_immutable/);
        });
      });
    });

    describe('errors from the database guards', () => {
      it('maps a second own money payment to its own domain error', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);

        await expect(
          ledger.run((tx) =>
            tx.addPayment(
              new Payment({
                id: randomUUID(),
                orderId,
                provider: 'BCP',
                externalId: `M${Date.now()}`,
                status: 'LATE_CONFIRMED',
                payload: { verifiedBy: 'admin-7' },
              }),
            ),
          ),
        ).rejects.toThrow(OrderMoneyAlreadyRecordedError);
      });

      it('maps a refused operator on a payment to an integrity error', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);

        const attempt = ledger.run((tx) =>
          tx.addPayment(
            new Payment({
              id: randomUUID(),
              orderId,
              provider: 'BCP',
              externalId: `E${Date.now()}`,
              status: 'EXTRA_RECEIVED',
              payload: { verifiedBy: 'Admin 1' },
            }),
          ),
        );

        await expect(attempt).rejects.toThrow(IntegrityGuardError);
        await expect(attempt).rejects.toMatchObject({
          guard: 'Payment_money_has_operator',
        });
      });

      it('maps a completion by the recorder to SameOperatorRefundError', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);
        await cancelWith().execute({ raffleId, reason: 'Force majeure' });
        const refund = (await refundRepo.findByOrderId(orderId)) as Refund;
        refund.complete({
          operatorId: 'admin-1',
          destination: 'Yape 1',
          operationNumber: 'R-MAP',
          completedAt: new Date(),
        });

        await expect(
          ledger.run((tx) => tx.saveRefund(refund, 'PENDING' as never)),
        ).rejects.toThrow(SameOperatorRefundError);
      });

      it('maps a refund naming the wrong payment to an integrity error', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);
        const approved = await prisma.payment.findFirstOrThrow({
          where: { orderId },
        });

        const attempt = ledger.run((tx) =>
          tx.addRefund(
            new Refund({
              id: randomUUID(),
              orderId,
              raffleId,
              paymentId: approved.id,
              amount: 10,
              reason: 'Wrong payment',
            }),
          ),
        );

        await expect(attempt).rejects.toMatchObject({
          guard: 'Refund_payment_order_mismatch',
        });
      });
    });

    describe('money payments', () => {
      async function moneyPayment() {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);
        const payment = await prisma.payment.findFirstOrThrow({
          where: { orderId, status: 'APPROVED' },
        });
        return { raffleId, orderId, payment };
      }

      it.each([
        ['its status', { status: 'REJECTED_RECEIVED' }],
        ['its status to one without money', { status: 'NOTED' }],
        ['its operator', { payload: { receivedAmount: 10, verifiedBy: 'admin-9' } }],
        ['any other payload key', { payload: { receivedAmount: 99, verifiedBy: 'admin-1' } }],
      ])('refuses changing %s', async (_, data) => {
        const { payment } = await moneyPayment();

        await expect(
          prisma.payment.update({ where: { id: payment.id }, data }),
        ).rejects.toThrow(/Payment_money_immutable/);
      });

      it('refuses moving it to another order', async () => {
        const { payment } = await moneyPayment();
        const raffleId = await givenActiveRaffle([2]);
        const otherOrder = await givenPaidOrder(raffleId, [2]);

        await expect(
          prisma.payment.update({
            where: { id: payment.id },
            data: { orderId: otherOrder },
          }),
        ).rejects.toThrow(/Payment_money_immutable/);
      });

      it('refuses removing the operator from the payload', async () => {
        const { payment } = await moneyPayment();

        await expect(
          prisma.$executeRaw`
            UPDATE "Payment" SET payload = payload - 'verifiedBy' WHERE id = ${payment.id}`,
        ).rejects.toThrow(/Payment_money_immutable/);
      });

      it.each([
        ['no operator', { receivedAmount: 10 }],
        ['a blank operator', { receivedAmount: 10, verifiedBy: ' \t ' }],
        ['a number as operator', { receivedAmount: 10, verifiedBy: 42 }],
        ['an upper-case operator', { receivedAmount: 10, verifiedBy: 'Admin-1' }],
        ['a non-breaking space', { receivedAmount: 10, verifiedBy: 'admin\u00a01' }],
      ])('refuses recording money with %s', async (_, payload) => {
        const { orderId } = await moneyPayment();

        await expect(
          prisma.payment.create({
            data: {
              orderId,
              provider: 'BCP',
              externalId: `X${randomUUID().replace(/-/g, '')}`,
              status: 'EXTRA_RECEIVED',
              payload,
            },
          }),
        ).rejects.toThrow(/Payment_money_has_operator/);
      });

      it('refuses a second money payment of its own for one order', async () => {
        const { orderId } = await moneyPayment();

        await expect(
          prisma.$executeRawUnsafe(`
            DO $$
            DECLARE fired text;
            BEGIN
              INSERT INTO "Payment" (id, "orderId", provider, "externalId", status, payload)
              VALUES ('${randomUUID()}', '${orderId}', 'BCP', 'SECOND${Date.now()}', 'LATE_CONFIRMED',
                      '{"verifiedBy": "admin-7"}');
            EXCEPTION WHEN unique_violation THEN
              GET STACKED DIAGNOSTICS fired = CONSTRAINT_NAME;
              RAISE EXCEPTION 'unique index fired: %', fired;
            END $$`),
        ).rejects.toThrow('unique index fired: Payment_order_money_key');
      });

      it('refuses deleting it, even through its order', async () => {
        const { orderId, payment } = await moneyPayment();

        await expect(
          prisma.payment.delete({ where: { id: payment.id } }),
        ).rejects.toThrow(/Payment_money_kept/);
        await expect(
          prisma.$executeRaw`DELETE FROM "Payment" WHERE "orderId" = ${orderId}`,
        ).rejects.toThrow(/Payment_money_kept/);
      });

      it('refuses turning another payment into money', async () => {
        const { orderId } = await moneyPayment();
        const id = randomUUID();
        await prisma.payment.create({
          data: {
            id,
            orderId,
            provider: 'BCP',
            externalId: `N${Date.now()}`,
            status: 'NOTED',
            payload: {},
          },
        });

        await expect(
          prisma.payment.update({
            where: { id },
            data: {
              status: 'EXTRA_RECEIVED',
              payload: { verifiedBy: 'admin-7' },
            },
          }),
        ).rejects.toThrow(/Payment_money_immutable: payment .* cannot become money/);
      });

      it('refuses truncating payments or refunds', async () => {
        // In a transaction that never commits, so a missing guard loses nothing.
        for (const table of ['Payment', 'Refund']) {
          await expect(
            prisma.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(`TRUNCATE "${table}" CASCADE`);
              throw new Error(`${table} was truncated`);
            }),
            // Its own guard: CASCADE reaches Refund too, which has one as well.
          ).rejects.toThrow(`Money_records_kept: ${table} cannot be truncated`);
        }
      });

      it('refuses a refund naming a payment that is not an extra transfer', async () => {
        const { raffleId, orderId, payment } = await moneyPayment();

        await expect(
          prisma.refund.create({
            data: {
              orderId,
              raffleId,
              paymentId: payment.id,
              amount: 10,
              reason: 'Not an extra transfer',
            },
          }),
        ).rejects.toThrow(/Refund_payment_order_mismatch: refund .* not an extra transfer/);
      });

      it('keeps extra transfers many on one order', async () => {
        const { orderId } = await moneyPayment();
        for (const operationNumber of [randomUUID(), randomUUID()]) {
          await new RecordExtraTransferUseCase(orderRepo, ledger, clock).execute({
            orderId,
            operatorId: 'admin-3',
            reason: 'Paid again',
            receivedAmount: 1,
            bankOrWallet: BankOrWallet.BCP,
            operationNumber,
          });
        }

        expect(
          await prisma.payment.count({ where: { orderId, status: 'EXTRA_RECEIVED' } }),
        ).toBe(2);
      });
    });
  });

  describe('extra transfer (DT-16)', () => {
    function recordWith(usedLedger: TicketLedger = ledger) {
      return new RecordExtraTransferUseCase(orderRepo, usedLedger, clock);
    }

    const transfer = (orderId: string, overrides = {}) => ({
      orderId,
      operatorId: 'admin-1',
      reason: 'The buyer transferred twice',
      receivedAmount: 10,
      bankOrWallet: BankOrWallet.BCP,
      operationNumber: randomUUID(),
      ...overrides,
    });

    it('refunds the transfer apart and leaves the paid order and its ticket', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);

      await recordWith().execute(transfer(orderId));

      expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
      const extra = await prisma.payment.findFirstOrThrow({
        where: { orderId, status: 'EXTRA_RECEIVED' },
      });
      const refund = await prisma.refund.findFirstOrThrow({
        where: { orderId },
      });
      expect(refund).toMatchObject({ paymentId: extra.id, status: 'PENDING' });
      expect(Number(refund.amount)).toBe(10);
      const event = await prisma.auditEvent.findFirstOrThrow({
        where: { raffleId, type: 'EXTRA_TRANSFER_RECORDED' },
      });
      expect(event.data).toMatchObject({
        orderId,
        paymentId: extra.id,
        refundId: refund.id,
        amount: 10,
        operatorId: 'admin-1',
        reason: 'The buyer transferred twice',
      });
      const [email] = await queued(raffleId, NotificationType.REFUND_PENDING);
      expect(email.dedupeKey).toBe(
        `${NotificationType.REFUND_PENDING}:${orderId}:${extra.id}`,
      );
      // The order has no refund of its own: the extra one is not it.
      expect(await refundRepo.findByOrderId(orderId)).toBeNull();
    });

    it('leaves nothing when the last write fails', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const before = await auditTypes(raffleId);

      await expect(
        recordWith(ledgerFailingOnAudit).execute(transfer(orderId)),
      ).rejects.toThrow('audit down');

      expect(
        await prisma.payment.count({ where: { orderId, status: 'EXTRA_RECEIVED' } }),
      ).toBe(0);
      expect(await prisma.refund.count({ where: { orderId } })).toBe(0);
      expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toEqual([]);
      expect(await auditTypes(raffleId)).toEqual(before);
    });

    it('opens one refund per transfer on the same order', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);

      await recordWith().execute(transfer(orderId));
      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));

      const refunds = await prisma.refund.findMany({ where: { orderId } });
      expect(refunds.map((r) => Number(r.amount)).sort()).toEqual([10, 4].sort());
      expect(new Set(refunds.map((r) => r.paymentId)).size).toBe(2);
      expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toHaveLength(2);
    });

    it('refuses an operation number already recorded, on any order', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenPaidOrder(raffleId, [1]);
      const second = await givenPaidOrder(raffleId, [2]);
      const operationNumber = randomUUID();
      await recordWith().execute(transfer(first, { operationNumber }));

      await expect(
        recordWith().execute(transfer(second, { operationNumber })),
      ).rejects.toThrow(DuplicatePaymentError);

      expect(await prisma.refund.count({ where: { orderId: second } })).toBe(0);
    });

    it('refuses an order still in verification', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);

      await expect(recordWith().execute(transfer(orderId))).rejects.toThrow(
        ExtraTransferNotAcceptedError,
      );

      expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
    });

    it('sits beside the refund of a rejection, whose repeat stays a repeat', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { orderId } = await givenOrderInVerification(raffleId, [1]);
      const rejection = {
        orderId,
        operatorId: 'admin-1',
        reason: 'Paid 6 instead of 10',
        moneyReceived: true,
        receivedAmount: 6,
        bankOrWallet: BankOrWallet.YAPE,
        operationNumber: randomUUID(),
      };
      await rejectWith().execute(rejection);
      const ownRefund = await refundRepo.findByOrderId(orderId);

      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));
      await rejectWith().execute(rejection);

      expect(await refundRepo.findByOrderId(orderId)).toEqual(ownRefund);
      expect(ownRefund?.paymentId).toBeNull();
      expect(await prisma.refund.count({ where: { orderId } })).toBe(2);
      const types = await auditTypes(raffleId);
      expect(types).not.toContain('PAYMENT_REJECTION_REFUSED');
      expect(types.filter((t) => t === 'PAYMENT_REJECTED')).toHaveLength(1);
    });

    it('completes the extra refund and keeps the order refund pending', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });
      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));
      const extra = await prisma.refund.findFirstOrThrow({
        where: { orderId, paymentId: { not: null } },
      });

      await completeRefundWith().execute({
        refundId: extra.id,
        operatorId: 'admin-2',
        destination: 'BCP 123',
        operationNumber: 'R-9',
      });

      expect((await refundRepo.findById(extra.id))?.status).toBe('COMPLETED');
      expect((await orderRepo.findById(orderId))?.status).toBe('REFUND_PENDING');
      expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
      expect((await refundRepo.findByOrderId(orderId))?.status).toBe('PENDING');
    });

    it('opens the order refund next to the extra one when the raffle is cancelled', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));

      await cancelWith().execute({ raffleId, reason: 'Force majeure' });

      const own = await refundRepo.findByOrderId(orderId);
      expect(own).toMatchObject({ paymentId: null, amount: 10 });
      expect(own?.reason).toBe(RAFFLE_CANCELLED_BUYER_REASON);
      expect(await prisma.refund.count({ where: { orderId } })).toBe(2);
    });

    it('completes the order refund and leaves the extra one pending', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });
      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));
      const own = await refundRepo.findByOrderId(orderId);
      const extra = await prisma.refund.findFirstOrThrow({
        where: { orderId, paymentId: { not: null } },
      });

      await completeRefundWith().execute({
        refundId: own?.id as string,
        operatorId: 'admin-2',
        destination: 'Yape 999',
        operationNumber: 'R-10',
      });

      expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
      expect(
        await prisma.refund.findUniqueOrThrow({ where: { id: extra.id } }),
      ).toEqual(extra);
    });

    it('turns a repeated completion of the extra refund into nothing', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await recordWith().execute(transfer(orderId, { receivedAmount: 4 }));
      const extra = await prisma.refund.findFirstOrThrow({ where: { orderId } });
      const completion = {
        refundId: extra.id,
        operatorId: 'admin-2',
        destination: 'BCP 123',
        operationNumber: 'R-11',
      };
      await completeRefundWith().execute(completion);
      const done = await prisma.refund.findUniqueOrThrow({
        where: { id: extra.id },
      });

      await completeRefundWith().execute(completion);

      expect(
        await prisma.refund.findUniqueOrThrow({ where: { id: extra.id } }),
      ).toEqual(done);
      const types = await auditTypes(raffleId);
      expect(types.filter((t) => t === 'REFUND_COMPLETED')).toHaveLength(1);
      expect(
        await queued(raffleId, NotificationType.REFUND_COMPLETED),
      ).toHaveLength(1);
      expect((await orderRepo.findById(orderId))?.status).toBe('PAID');
    });

    it('lists an extra transfer that took the collision exit (DT-12)', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      const operationNumber = `X${Date.now()}`;
      await recordWith().execute(transfer(orderId, { operationNumber }));

      await recordWith().execute(
        transfer(orderId, {
          operationNumber,
          receivedAmount: 3,
          bankOrWallet: BankOrWallet.BBVA,
          collision: {
            reason: 'Same number at another bank',
            bank: BankOrWallet.BBVA,
          },
        }),
      );

      const colliding = await prisma.payment.findFirstOrThrow({
        where: { orderId, externalId: { contains: '#' } },
      });
      expect(colliding.status).toBe('EXTRA_RECEIVED');
      const uses = await new ListOperationCollisionsUseCase(
        paymentRepo,
      ).execute();
      expect(uses.map((u) => u.paymentId)).toContain(colliding.id);
    });

    it('refuses a refund linked to the payment of another order', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenPaidOrder(raffleId, [1]);
      const second = await givenPaidOrder(raffleId, [2]);
      await recordWith().execute(transfer(first));
      const payment = await prisma.payment.findFirstOrThrow({
        where: { orderId: first, status: 'EXTRA_RECEIVED' },
      });
      await prisma.refund.deleteMany({ where: { paymentId: payment.id } });

      await expect(
        prisma.refund.create({
          data: {
            orderId: second,
            raffleId,
            paymentId: payment.id,
            amount: 10,
            reason: 'Forged',
          },
        }),
      ).rejects.toThrow(/Refund_payment_order_mismatch/);
    });

    it('refuses moving a refunded payment to another order', async () => {
      const raffleId = await givenActiveRaffle([1, 2]);
      const first = await givenPaidOrder(raffleId, [1]);
      const second = await givenPaidOrder(raffleId, [2]);
      await recordWith().execute(transfer(first));

      await expect(
        prisma.payment.updateMany({
          where: { orderId: first, status: 'EXTRA_RECEIVED' },
          data: { orderId: second },
        }),
        // Every payment a refund can name is an extra transfer, which is money
        // and frozen first (DT-17). The DT-16 payment trigger is a second layer
        // that no write can reach while the money trigger stands.
      ).rejects.toThrow(/Payment_money_immutable/);
    });

    it('keeps one refund of the order itself in the database', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const orderId = await givenPaidOrder(raffleId, [1]);
      await cancelWith().execute({ raffleId, reason: 'Force majeure' });

      // Postgres names the index that fired; the ids are generated here.
      await expect(
        prisma.$executeRawUnsafe(`
          DO $$
          DECLARE fired text;
          BEGIN
            INSERT INTO "Refund" (id, "orderId", "raffleId", amount, reason)
            VALUES ('${randomUUID()}', '${orderId}', '${raffleId}', 10, 'Twice');
          EXCEPTION WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS fired = CONSTRAINT_NAME;
            RAISE EXCEPTION 'unique index fired: %', fired;
          END $$`),
      ).rejects.toThrow('unique index fired: Refund_order_refund_key');
    });
  });

  describe('frozen sold list (DT-11)', () => {
    const DRAW_ROUND = 5000n;
    const RANDOMNESS =
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    const drawRepo = new PrismaDrawRepository(prisma);
    const auditLog = new PrismaAuditLog(prisma);
    const beacon = new FakeRandomnessBeacon();
    beacon.setRound(DRAW_ROUND, RANDOMNESS);

    function drawWith(usedLedger: TicketLedger = ledger) {
      return new ExecuteDrawUseCase(
        raffleRepo,
        ticketRepo,
        usedLedger,
        beacon,
        clock,
        drawRepo,
      );
    }

    const verification = new GetVerificationDataUseCase(
      raffleRepo,
      ticketRepo,
      drawRepo,
    );

    async function givenPublishedRaffle(numbers: number[]): Promise<string> {
      const id = randomUUID();
      const { commitmentHash, seedCiphertext } =
        await seedVault.generateAndStoreSeed(id);
      await prisma.raffle.create({
        data: {
          id,
          title: 'Draw raffle',
          prize: 'Prize',
          ticketPrice: 10,
          numberMin: 1,
          numberMax: 100,
          status: 'ACTIVE',
          commitmentHash,
          seedCiphertext,
          drandRound: DRAW_ROUND,
          drandChainHash: beacon.chainHash,
          salesCloseAt: new Date(Date.now() + 7 * 24 * 3_600_000),
        },
      });
      await prisma.ticket.createMany({
        data: numbers.map((number) => ({ raffleId: id, number })),
      });
      return id;
    }

    async function givenClosedRaffle(sold: number[]): Promise<string> {
      const raffleId = await givenPublishedRaffle([1, 2, 3, 4]);
      if (sold.length > 0) {
        await givenPaidOrder(raffleId, sold);
      }
      await closeSalesWith().execute(raffleId);
      return raffleId;
    }

    // Only here is the guard off: this is the attack the draw must survive.
    async function behindTheGuard(work: () => Promise<unknown>): Promise<void> {
      await prisma.$executeRaw`ALTER TABLE "Ticket" DISABLE TRIGGER trg_ticket_transition`;
      try {
        await work();
      } finally {
        await prisma.$executeRaw`ALTER TABLE "Ticket" ENABLE TRIGGER trg_ticket_transition`;
      }
    }

    // A sold ticket needs an order even behind the guard (Ticket_sold_has_order),
    // so the attack forges one too.
    async function sellBehindTheGuard(raffleId: string, number: number) {
      const [userId] = await givenBuyers(1);
      const order = await prisma.ticketOrder.create({
        data: {
          raffleId,
          userId,
          numbers: [number],
          totalAmount: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      return behindTheGuard(() =>
        prisma.ticket.update({
          where: { raffleId_number: { raffleId, number } },
          data: { status: 'SOLD', orderId: order.id },
        }),
      );
    }

    function refundBehindTheGuard(raffleId: string, number: number) {
      return behindTheGuard(() =>
        prisma.ticket.update({
          where: { raffleId_number: { raffleId, number } },
          data: { status: 'REFUNDED' },
        }),
      );
    }

    async function auditTypes(raffleId: string): Promise<string[]> {
      const events = await auditLog.findByRaffleId(raffleId);
      return events.map((event) => event.type);
    }

    it('refuses a list changed between the first read and the lock', async () => {
      const raffleId = await givenClosedRaffle([1, 2]);
      // Runs after the first read of the list and before the draw locks it.
      const changingFirst: TicketLedger = {
        run: async (work) => {
          await sellBehindTheGuard(raffleId, 3);
          return ledger.run(work);
        },
      };

      await expect(drawWith(changingFirst).execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe('CLOSED');
      expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
      expect(await queued(raffleId, NotificationType.WINNER)).toEqual([]);
      const refused = await prisma.auditEvent.findFirstOrThrow({
        where: { raffleId, type: 'DRAW_REFUSED' },
      });
      expect(refused.data).toMatchObject({
        reason: 'SOLD_LIST_MISMATCH',
        detectedUnderLock: true,
        totalSold: 3,
      });
      expect(await auditTypes(raffleId)).not.toContain('DRAW_EXECUTED');
    });

    it('draws normally when the list matches the published hash', async () => {
      const raffleId = await givenClosedRaffle([1, 2]);

      const draw = await drawWith().execute(raffleId);

      expect([1, 2]).toContain(draw.winningNumber);
      expect((await raffleRepo.findById(raffleId))?.status).toBe('DRAWN');
      const [winner] = await queued(raffleId, NotificationType.WINNER);
      const winningOrder = await prisma.ticketOrder.findFirstOrThrow({
        where: { raffleId, numbers: { has: draw.winningNumber } },
      });
      // The buyer of the winning ticket, not its order or the raffle.
      expect(winner.recipient).toBe(winningOrder.userId);
      expect(winner.orderId).toBe(winningOrder.id);
      const stored = await drawRepo.findByRaffleId(raffleId);
      expect(stored?.winningNumber).toBe(draw.winningNumber);
    });

    it.each([
      ['added', sellBehindTheGuard, 3],
      ['removed', refundBehindTheGuard, 2],
    ])(
      'draws nothing when a number was %s after the close',
      async (_change, alter, number) => {
        const raffleId = await givenClosedRaffle([1, 2]);
        await alter(raffleId, number);

        await expect(drawWith().execute(raffleId)).rejects.toThrow(
          SoldListMismatchError,
        );

        expect((await raffleRepo.findById(raffleId))?.status).toBe('CLOSED');
        expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
        expect(await queued(raffleId, NotificationType.WINNER)).toEqual([]);
      },
    );

    it('keeps the refused attempt in the audit trail', async () => {
      const raffleId = await givenClosedRaffle([1]);
      const closed = await raffleRepo.findById(raffleId);
      await sellBehindTheGuard(raffleId, 3);

      await expect(drawWith().execute(raffleId)).rejects.toThrow(
        SoldListMismatchError,
      );

      const stored = await prisma.auditEvent.findMany({
        where: { raffleId, type: 'DRAW_REFUSED' },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].data).toEqual({
        reason: 'SOLD_LIST_MISMATCH',
        expectedHash: closed?.soldListHash,
        actualHash: await soldListHash([1, 3]),
        totalSold: 2,
      });
      expect(await auditTypes(raffleId)).not.toContain('DRAW_EXECUTED');
    });

    it('still refuses a draw with nothing sold, as a matching empty list', async () => {
      const raffleId = await givenClosedRaffle([]);

      await expect(drawWith().execute(raffleId)).rejects.toThrow(
        'Cannot execute draw: no tickets were sold',
      );

      expect((await raffleRepo.findById(raffleId))?.status).toBe('CLOSED');
      expect(await auditTypes(raffleId)).not.toContain('DRAW_REFUSED');
    });

    it('verification reports whether the list matches the published hash', async () => {
      const raffleId = await givenClosedRaffle([1, 2]);
      await drawWith().execute(raffleId);

      expect((await verification.execute(raffleId)).soldListVerified).toBe(true);

      await sellBehindTheGuard(raffleId, 3);

      const report = await verification.execute(raffleId);
      expect(report.soldListVerified).toBe(false);
      expect(report.soldNumbers).toEqual([1, 2, 3]);
    });

    describe('cancelling a raffle with an altered list (DT-15)', () => {
      const operatorId = 'admin-15';
      const reason = 'Sold list altered after the close';

      function cancelAlteredWith(usedLedger: TicketLedger = ledger) {
        return new CancelAlteredRaffleUseCase(usedLedger, clock);
      }

      function blockedDrawAlert(raffleId: string) {
        return prisma.operatorAlert.findMany({
          where: { raffleId, type: OperatorAlertType.DRAW_BLOCKED },
        });
      }

      it('alerts the operator once when the draw is refused for the list', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);
        await sellBehindTheGuard(raffleId, 3);

        for (let attempt = 0; attempt < 2; attempt++) {
          await expect(drawWith().execute(raffleId)).rejects.toThrow(
            SoldListMismatchError,
          );
        }

        const alerts = await blockedDrawAlert(raffleId);
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toMatchObject({
          orderId: null,
          amount: null,
          readAt: null,
        });
      });

      it('opens the order refund next to an extra transfer refund (DT-16)', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);
        const paid = await prisma.ticketOrder.findFirstOrThrow({
          where: { raffleId, status: 'PAID' },
        });
        await new RecordExtraTransferUseCase(orderRepo, ledger, clock).execute({
          orderId: paid.id,
          operatorId,
          reason: 'Paid twice',
          receivedAmount: 5,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: randomUUID(),
        });
        await sellBehindTheGuard(raffleId, 3);

        await cancelAlteredWith().execute({ raffleId, operatorId, reason });

        const refunds = await prisma.refund.findMany({
          where: { orderId: paid.id },
        });
        const byKind = refunds
          .map((r) => [r.paymentId === null ? 'own' : 'extra', Number(r.amount)])
          .sort();
        expect(byKind).toEqual([
          ['extra', 5],
          ['own', Number(paid.totalAmount)],
        ]);
        expect((await orderRepo.findById(paid.id))?.status).toBe(
          'REFUND_PENDING',
        );
      });

      it('cancels it, refunds the paid money and audits both hashes', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);
        const closed = await raffleRepo.findById(raffleId);
        const paid = await prisma.ticketOrder.findFirstOrThrow({
          where: { raffleId, status: 'PAID' },
        });
        await sellBehindTheGuard(raffleId, 3);
        await expect(drawWith().execute(raffleId)).rejects.toThrow(
          SoldListMismatchError,
        );

        await cancelAlteredWith().execute({ raffleId, operatorId, reason });

        const raffle = await prisma.raffle.findUniqueOrThrow({
          where: { id: raffleId },
        });
        expect(raffle.status).toBe('CANCELLED');
        expect(raffle.cancellationReason).toBe(reason);

        // Only the order that paid gets money back; the forged one paid nothing.
        const refunds = await prisma.refund.findMany({ where: { raffleId } });
        expect(refunds).toHaveLength(1);
        expect(refunds[0]).toMatchObject({
          orderId: paid.id,
          reason: RAFFLE_CANCELLED_BUYER_REASON,
        });
        expect(refunds[0].amount.toNumber()).toBe(paid.totalAmount.toNumber());
        expect(
          (await prisma.ticketOrder.findUniqueOrThrow({ where: { id: paid.id } }))
            .status,
        ).toBe('REFUND_PENDING');
        expect(await queued(raffleId, NotificationType.REFUND_PENDING)).toHaveLength(1);

        const event = await prisma.auditEvent.findFirstOrThrow({
          where: { raffleId, type: 'RAFFLE_CANCELLED_LIST_ALTERED' },
        });
        expect(event.data).toEqual({
          frozenHash: closed?.soldListHash,
          recomputedHash: await soldListHash([1, 2, 3]),
          operatorId,
          reason,
          paidOrdersCount: 1,
          ordersInReview: [],
        });

        const [alert] = await blockedDrawAlert(raffleId);
        expect(alert.readBy).toBe(operatorId);
        expect(alert.readAt).not.toBeNull();
      });

      it('lets the refund complete once the raffle is cancelled', async () => {
        const raffleId = await givenClosedRaffle([1]);
        await sellBehindTheGuard(raffleId, 3);
        await cancelAlteredWith().execute({ raffleId, operatorId, reason });
        const refund = await prisma.refund.findFirstOrThrow({
          where: { raffleId },
        });

        await completeRefundWith().execute({
          refundId: refund.id,
          operatorId,
          destination: 'BCP 123',
          operationNumber: `REF-${randomUUID().slice(0, 8)}`,
        });

        const ticket = await prisma.ticket.findUniqueOrThrow({
          where: { raffleId_number: { raffleId, number: 1 } },
        });
        expect(ticket.status).toBe('REFUNDED');
      });

      it('refuses a CLOSED raffle whose list is intact and writes nothing', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);

        await expect(
          cancelAlteredWith().execute({ raffleId, operatorId, reason }),
        ).rejects.toThrow(SoldListIntactError);

        expect((await raffleRepo.findById(raffleId))?.status).toBe('CLOSED');
        expect(await prisma.refund.count({ where: { raffleId } })).toBe(0);
        expect(await auditTypes(raffleId)).not.toContain(
          'RAFFLE_CANCELLED_LIST_ALTERED',
        );
      });

      it('sees a change made between the draw refusal and the cancel', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);
        // The list is altered only once the cancel holds its transaction.
        const alteringFirst: TicketLedger = {
          run: async (work) => {
            await sellBehindTheGuard(raffleId, 3);
            return ledger.run(work);
          },
        };

        await cancelAlteredWith(alteringFirst).execute({
          raffleId,
          operatorId,
          reason,
        });

        expect((await raffleRepo.findById(raffleId))?.status).toBe('CANCELLED');
      });

      it('expires a pending order and frees its reserved ticket', async () => {
        const raffleId = await givenClosedRaffle([1]);
        await sellBehindTheGuard(raffleId, 3);
        const [userId] = await givenBuyers(1);
        const pending = await prisma.ticketOrder.create({
          data: {
            raffleId,
            userId,
            numbers: [4],
            totalAmount: 10,
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
        await prisma.ticket.update({
          where: { raffleId_number: { raffleId, number: 4 } },
          data: {
            status: 'RESERVED',
            orderId: pending.id,
            reservedUntil: new Date(Date.now() + 60_000),
          },
        });

        await cancelAlteredWith().execute({ raffleId, operatorId, reason });

        expect(
          (await prisma.ticketOrder.findUniqueOrThrow({ where: { id: pending.id } }))
            .status,
        ).toBe('EXPIRED');
        const freed = await prisma.ticket.findUniqueOrThrow({
          where: { raffleId_number: { raffleId, number: 4 } },
        });
        expect(freed).toMatchObject({ status: 'AVAILABLE', orderId: null });
        expect(
          await prisma.refund.count({ where: { orderId: pending.id } }),
        ).toBe(0);
      });

      it('refuses a repeated cancel and opens no second refund', async () => {
        const raffleId = await givenClosedRaffle([1, 2]);
        await sellBehindTheGuard(raffleId, 3);
        await cancelAlteredWith().execute({ raffleId, operatorId, reason });

        await expect(
          cancelAlteredWith().execute({ raffleId, operatorId, reason }),
        ).rejects.toThrow(InvalidRaffleTransitionError);

        expect(await prisma.refund.count({ where: { raffleId } })).toBe(1);
        expect(
          (await auditTypes(raffleId)).filter(
            (type) => type === 'RAFFLE_CANCELLED_LIST_ALTERED',
          ),
        ).toHaveLength(1);
      });

      it('serializes with an approval of the same raffle', async () => {
        for (let round = 0; round < 3; round++) {
          const raffleId = await givenClosedRaffle([1]);
          // An order still waiting for its review, so the approval has work
          // to race. Written by hand: the close already resolved the real ones.
          const [userId] = await givenBuyers(1);
          const { id: orderId } = await prisma.ticketOrder.create({
            data: {
              raffleId,
              userId,
              numbers: [2],
              totalAmount: 10,
              status: 'PENDING_VERIFICATION',
              bankOrWallet: BankOrWallet.YAPE,
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          await sellBehindTheGuard(raffleId, 3);

          const [approved, cancelled] = await Promise.allSettled([
            approveWith().execute(approval(orderId)),
            cancelAlteredWith().execute({ raffleId, operatorId, reason }),
          ]);

          expect(cancelled.status).toBe('fulfilled');
          expect(approved.status).toBe('rejected');
          expect((approved as PromiseRejectedResult).reason).toBeInstanceOf(
            RaffleNotActiveError,
          );
          expect(
            (await prisma.ticketOrder.findUniqueOrThrow({ where: { id: orderId } }))
              .status,
          ).toBe('LATE_PAYMENT_REVIEW');
          expect(await prisma.refund.count({ where: { raffleId } })).toBe(1);
        }
      });

      it('serializes with a draw of the same raffle', async () => {
        for (let round = 0; round < 3; round++) {
          const raffleId = await givenClosedRaffle([1, 2]);
          await sellBehindTheGuard(raffleId, 3);

          const [drawn, cancelled] = await Promise.allSettled([
            drawWith().execute(raffleId),
            cancelAlteredWith().execute({ raffleId, operatorId, reason }),
          ]);

          expect(cancelled.status).toBe('fulfilled');
          expect(drawn.status).toBe('rejected');
          // Draw first: refused for the list. Cancel first: no longer CLOSED.
          const refusal = (drawn as PromiseRejectedResult).reason as Error;
          expect(
            refusal instanceof SoldListMismatchError ||
              /must be in CLOSED status/.test(refusal.message),
          ).toBe(true);
          expect((await raffleRepo.findById(raffleId))?.status).toBe(
            'CANCELLED',
          );
          expect(await drawRepo.findByRaffleId(raffleId)).toBeNull();
          expect(await prisma.refund.count({ where: { raffleId } })).toBe(1);
        }
      });

      it('rolls everything back when the transaction fails', async () => {
        const raffleId = await givenClosedRaffle([1]);
        await sellBehindTheGuard(raffleId, 3);
        const failing: TicketLedger = {
          run: (work) =>
            ledger.run(async (tx) => {
              await work(tx);
              throw new Error('commit refused');
            }),
        };

        await expect(
          cancelAlteredWith(failing).execute({ raffleId, operatorId, reason }),
        ).rejects.toThrow('commit refused');

        expect((await raffleRepo.findById(raffleId))?.status).toBe('CLOSED');
        expect(await prisma.refund.count({ where: { raffleId } })).toBe(0);
        expect(await auditTypes(raffleId)).not.toContain(
          'RAFFLE_CANCELLED_LIST_ALTERED',
        );
      });
    });

    describe('database guard', () => {
      function confirmClaim(orderId: string) {
        return new ConfirmLatePaymentUseCase(
          orderRepo,
          ledger,
          clock,
        ).execute({
          orderId,
          operatorId: 'admin-1',
          receivedAmount: 10,
          bankOrWallet: BankOrWallet.BCP,
          operationNumber: randomUUID(),
        });
      }

      function soldTicket(raffleId: string) {
        return { raffleId_number: { raffleId, number: 1 } };
      }

      async function givenRaffleIn(state: string): Promise<string> {
        const raffleId = await givenClosedRaffle([1]);
        if (state === 'DRAWN') {
          await drawWith().execute(raffleId);
        }
        return raffleId;
      }

      it.each(['CLOSED', 'DRAWN'])(
        'refuses taking a sold ticket out of the list of a %s raffle',
        async (state) => {
          const raffleId = await givenRaffleIn(state);

          await expect(
            prisma.ticket.update({
              where: soldTicket(raffleId),
              data: { status: 'REFUNDED' },
            }),
          ).rejects.toThrow(/Frozen sold list/);
        },
      );

      it.each(['CLOSED', 'DRAWN'])(
        'refuses renumbering a sold ticket of a %s raffle',
        async (state) => {
          const raffleId = await givenRaffleIn(state);

          await expect(
            prisma.ticket.update({
              where: soldTicket(raffleId),
              data: { number: 99 },
            }),
          ).rejects.toThrow(/Frozen sold list/);
        },
      );

      it('refuses moving a sold ticket of a closed raffle to another raffle', async () => {
        const raffleId = await givenRaffleIn('CLOSED');
        const otherRaffleId = await givenActiveRaffle([50]);

        await expect(
          prisma.ticket.update({
            where: soldTicket(raffleId),
            data: { raffleId: otherRaffleId },
          }),
        ).rejects.toThrow(/Frozen sold list/);
      });

      it('leaves the other fields of a closed raffle ticket free to change', async () => {
        const raffleId = await givenRaffleIn('CLOSED');

        await expect(
          prisma.ticket.update({
            where: soldTicket(raffleId),
            data: { reservedUntil: new Date() },
          }),
        ).resolves.toBeDefined();
      });

      it('keeps the refund of a cancelled raffle working', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenPaidOrder(raffleId, [1]);
        await cancelWith().execute({ raffleId, reason: 'Force majeure' });
        const refund = await refundRepo.findByOrderId(orderId);

        await completeRefundWith().execute({
          refundId: refund!.id,
          operatorId: 'admin-2',
          destination: 'Yape 999888777',
          operationNumber: 'R-1',
        });

        expect((await ticketOf(raffleId, 1)).status).toBe('REFUNDED');
        expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
      });

      it('completes a refund on a closed raffle without touching the sold list', async () => {
        const raffleId = await givenPublishedRaffle([1, 2]);
        await givenPaidOrder(raffleId, [1]);
        const { orderId } = await givenOrderInVerification(raffleId, [2]);
        await closeSalesWith().execute(raffleId);
        await confirmClaim(orderId);
        const refund = await refundRepo.findByOrderId(orderId);

        await completeRefundWith().execute({
          refundId: refund!.id,
          operatorId: 'admin-2',
          destination: 'Yape 999888777',
          operationNumber: 'R-2',
        });

        expect((await orderRepo.findById(orderId))?.status).toBe('REFUNDED');
        expect((await ticketOf(raffleId, 1)).status).toBe('SOLD');
        await expect(drawWith().execute(raffleId)).resolves.toBeDefined();
      });
    });
  });

  describe('raffle publication', () => {
    const salesCloseAt = new Date('2026-12-06T18:00:00Z');
    const drawAt = new Date('2026-12-07T18:00:00Z');
    const command = (raffleId: string) => ({
      raffleId,
      authorizationResolution: 'RD-1',
      salesCloseAt,
      drawAt,
    });

    function publishWith(usedLedger: TicketLedger) {
      return new PublishRaffleUseCase(
        raffleRepo,
        usedLedger,
        new FakeSeedVault(),
        new FakeRandomnessBeacon(),
      );
    }

    async function givenDraft(numberMax: number): Promise<string> {
      const { id } = await prisma.raffle.create({
        data: {
          title: 'Draft raffle',
          prize: 'Prize',
          ticketPrice: 10,
          numberMin: 1,
          numberMax,
        },
      });
      return id;
    }

    it('activates the raffle with every ticket and its audit event', async () => {
      const raffleId = await givenDraft(5);

      await publishWith(ledger).execute(command(raffleId));

      expect((await raffleRepo.findById(raffleId))?.status).toBe('ACTIVE');
      const tickets = await ticketRepo.findByRaffleId(raffleId);
      expect(tickets.map((t) => t.number)).toEqual([1, 2, 3, 4, 5]);
      expect(tickets.every((t) => t.status === 'AVAILABLE')).toBe(true);
      expect(await auditTypes(raffleId)).toEqual(['RAFFLE_PUBLISHED']);
    });

    it('stays in DRAFT with no tickets when publishing fails midway', async () => {
      const raffleId = await givenDraft(5);

      await expect(
        publishWith(ledgerFailingOnAudit).execute(command(raffleId)),
      ).rejects.toThrow('audit down');

      const raffle = await raffleRepo.findById(raffleId);
      expect(raffle?.status).toBe('DRAFT');
      expect(raffle?.commitmentHash).toBeNull();
      expect(await prisma.ticket.count({ where: { raffleId } })).toBe(0);
      expect(await auditTypes(raffleId)).toEqual([]);
    });

    it('publishes once when two requests race', async () => {
      const raffleId = await givenDraft(5);
      const publish = publishWith(ledger);

      const results = await Promise.allSettled([
        publish.execute(command(raffleId)),
        publish.execute(command(raffleId)),
      ]);

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(InvalidRaffleTransitionError);
      expect(await prisma.ticket.count({ where: { raffleId } })).toBe(5);
    });

    it('seeds a range of 100 000 numbers within one transaction', async () => {
      const raffleId = await givenDraft(100_000);

      await publishWith(ledger).execute(command(raffleId));

      expect(await prisma.ticket.count({ where: { raffleId } })).toBe(100_000);
    });
  });

  describe('raffle-level operator alerts (DT-13)', () => {
    const alert = (raffleId: string, id = randomUUID()) =>
      new OperatorAlert({
        id,
        type: OperatorAlertType.DRAW_BLOCKED,
        raffleId,
        raffleTitle: 'Integration raffle',
        orderId: null,
        amount: null,
        createdAt: new Date(),
      });

    it('keeps one alert per raffle and reopens it when raised again', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const other = await givenActiveRaffle([1]);
      await ledger.run((tx) => tx.raiseOperatorAlert(alert(raffleId)));
      await ledger.run((tx) => tx.raiseOperatorAlert(alert(other)));
      await prisma.operatorAlert.updateMany({
        where: { raffleId: { in: [raffleId, other] } },
        data: { readAt: new Date(), readBy: 'operator-1' },
      });

      await ledger.run((tx) => tx.raiseOperatorAlert(alert(raffleId)));

      const rows = await prisma.operatorAlert.findMany({
        where: { raffleId: { in: [raffleId, other] } },
      });
      expect(rows).toHaveLength(2);
      // Only the raffle raised again is unread; the other stays read.
      expect(rows.find((r) => r.raffleId === raffleId)).toMatchObject({
        orderId: null,
        amount: null,
        readAt: null,
      });
      expect(rows.find((r) => r.raffleId === other)?.readAt).not.toBeNull();
      expect(
        (await alertRepo.findUnread()).filter((a) => a.raffleId === raffleId),
      ).toEqual([expect.objectContaining({ orderId: null, amount: null })]);
    });

    it('refuses a second raffle-level alert of the same type', async () => {
      const raffleId = await givenActiveRaffle([1]);
      await ledger.run((tx) => tx.addOperatorAlert(alert(raffleId)));

      await expect(
        ledger.run((tx) => tx.addOperatorAlert(alert(raffleId))),
      ).rejects.toThrow(DuplicateOperatorAlertError);
      await expect(
        ledger.run((tx) => tx.addOperatorAlert(alert(raffleId))),
      ).rejects.toThrow(`Alert DRAW_BLOCKED already exists for raffle ${raffleId}`);
    });
  });

  describe('invariant triggers', () => {
    async function givenOrder(raffleId: string): Promise<string> {
      const [userId] = await givenBuyers(1);
      const order = await prisma.ticketOrder.create({
        data: {
          raffleId,
          userId,
          numbers: [1],
          totalAmount: 10,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      return order.id;
    }

    async function givenPublishedRaffle(): Promise<string> {
      const raffle = await prisma.raffle.create({
        data: {
          title: 'Published raffle',
          prize: 'Prize',
          ticketPrice: 25,
          numberMin: 1,
          numberMax: 100,
          status: 'ACTIVE',
          commitmentHash: 'original_commitment_hash',
          drandRound: 1000n,
          drandChainHash: 'chain_hash_1',
        },
      });
      return raffle.id;
    }

    it.each([
      ['commitmentHash', { commitmentHash: 'altered_hash' }],
      ['drandRound', { drandRound: 9999n }],
      ['drandChainHash', { drandChainHash: 'altered_chain' }],
    ])('rejects changing %s once the raffle left DRAFT', async (_field, data) => {
      const id = await givenPublishedRaffle();

      await expect(prisma.raffle.update({ where: { id }, data })).rejects.toThrow(
        /Cannot modify commitmentHash/,
      );
    });

    it('still allows other raffle updates once published', async () => {
      const id = await givenPublishedRaffle();

      await expect(
        prisma.raffle.update({ where: { id }, data: { title: 'New title' } }),
      ).resolves.toBeDefined();
    });

    it('allows changing the commitment while the raffle is DRAFT', async () => {
      const { id } = await prisma.raffle.create({
        data: {
          title: 'Draft raffle',
          prize: 'Prize',
          ticketPrice: 25,
          numberMin: 1,
          numberMax: 100,
          commitmentHash: 'draft_commitment',
        },
      });

      await expect(
        prisma.raffle.update({
          where: { id },
          data: { commitmentHash: 'new_commitment' },
        }),
      ).resolves.toBeDefined();
    });

    describe('a SOLD ticket keeps its order (DT-13)', () => {
      async function givenSoldTicket(): Promise<{ id: string; orderId: string }> {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenOrder(raffleId);
        const { id } = await prisma.ticket.findUniqueOrThrow({
          where: { raffleId_number: { raffleId, number: 1 } },
        });
        for (const status of ['RESERVED', 'SOLD']) {
          await prisma.ticket.update({ where: { id }, data: { status, orderId } });
        }
        return { id, orderId };
      }

      it('refuses to sell a ticket without an order', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const where = { raffleId, number: 1 };
        await prisma.ticket.updateMany({
          where,
          data: { status: 'RESERVED', orderId: null },
        });

        await expect(
          prisma.ticket.updateMany({ where, data: { status: 'SOLD' } }),
        ).rejects.toThrow(/Ticket_sold_has_order/);
      });

      it('refuses to insert a sold ticket without an order', async () => {
        const raffleId = await givenActiveRaffle([1]);
        await expect(
          prisma.ticket.create({
            data: { raffleId, number: 2, status: 'SOLD', orderId: null },
          }),
        ).rejects.toThrow(/Ticket_sold_has_order/);
      });

      // Already refused by the transition trigger, pinned here with the rest.
      it('refuses to take the order away from a sold ticket', async () => {
        const { id } = await givenSoldTicket();
        await expect(
          prisma.ticket.update({ where: { id }, data: { orderId: null } }),
        ).rejects.toThrow(/cannot change order/);
      });

      // The foreign key refuses it: ON DELETE SET NULL would break the CHECK.
      it('refuses to delete the order behind a sold ticket', async () => {
        const { id, orderId } = await givenSoldTicket();
        await expect(
          prisma.ticketOrder.delete({ where: { id: orderId } }),
        ).rejects.toThrow(/Ticket_orderId_fkey/);
        expect(await prisma.ticketOrder.count({ where: { id: orderId } })).toBe(1);
        expect(await prisma.ticket.findUnique({ where: { id } })).toMatchObject({
          status: 'SOLD',
          orderId,
        });
      });

      it('still deletes an order no ticket points to', async () => {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = await givenOrder(raffleId);

        await prisma.ticketOrder.delete({ where: { id: orderId } });

        expect(await prisma.ticketOrder.count({ where: { id: orderId } })).toBe(0);
      });

      // No code deletes raffles. A raffle has no FK from TicketOrder, so its
      // tickets go with it and its orders stay; any audit event blocks it all.
      it('deletes a raffle with its sold tickets and keeps their orders', async () => {
        const { id, orderId } = await givenSoldTicket();
        const { raffleId } = await prisma.ticket.findUniqueOrThrow({
          where: { id },
        });

        await prisma.raffle.delete({ where: { id: raffleId } });

        expect(await prisma.ticket.count({ where: { raffleId } })).toBe(0);
        expect(await prisma.ticketOrder.count({ where: { id: orderId } })).toBe(1);
      });

      it('refuses to delete a raffle that has audit events', async () => {
        const raffleId = await givenActiveRaffle([1]);
        await prisma.auditEvent.create({
          data: { raffleId, type: 'RAFFLE_PUBLISHED', data: {} },
        });

        await expect(
          prisma.raffle.delete({ where: { id: raffleId } }),
        ).rejects.toThrow(/append-only/);
        expect(await prisma.raffle.count({ where: { id: raffleId } })).toBe(1);
      });
    });

    describe('Ticket status transitions', () => {
      async function givenTicket(
        status: string,
      ): Promise<{ id: string; orderId: string | null }> {
        const raffleId = await givenActiveRaffle([1]);
        const orderId = status === 'AVAILABLE' ? null : await givenOrder(raffleId);
        const { id } = await prisma.ticket.findUniqueOrThrow({
          where: { raffleId_number: { raffleId, number: 1 } },
        });
        for (const step of pathTo(status)) {
          await prisma.ticket.update({
            where: { id },
            data: { status: step, orderId },
          });
        }
        return { id, orderId };
      }

      function pathTo(status: string): string[] {
        const path = ['RESERVED', 'SOLD', 'REFUNDED'];
        return path.slice(0, path.indexOf(status) + 1);
      }

      it.each([
        ['AVAILABLE', 'SOLD'],
        ['AVAILABLE', 'REFUNDED'],
        ['RESERVED', 'REFUNDED'],
        ['SOLD', 'AVAILABLE'],
        ['SOLD', 'RESERVED'],
        ['REFUNDED', 'AVAILABLE'],
        ['REFUNDED', 'RESERVED'],
        ['REFUNDED', 'SOLD'],
      ])('rejects %s -> %s', async (from, to) => {
        const { id } = await givenTicket(from);

        await expect(
          prisma.ticket.update({ where: { id }, data: { status: to } }),
        ).rejects.toThrow(/Invalid ticket transition/);
      });

      it.each([
        ['RESERVED', 'SOLD'],
        ['RESERVED', 'AVAILABLE'],
        ['SOLD', 'REFUNDED'],
      ])('allows %s -> %s', async (from, to) => {
        const { id } = await givenTicket(from);

        await expect(
          prisma.ticket.update({ where: { id }, data: { status: to } }),
        ).resolves.toBeDefined();
      });

      it.each(['RESERVED', 'SOLD'])(
        'rejects moving a %s ticket to another order',
        async (status) => {
          const { id, orderId } = await givenTicket(status);
          const ticket = await prisma.ticket.findUniqueOrThrow({
            where: { id },
          });
          const otherOrderId = await givenOrder(ticket.raffleId);
          expect(otherOrderId).not.toBe(orderId);

          await expect(
            prisma.ticket.update({
              where: { id },
              data: { orderId: otherOrderId },
            }),
          ).rejects.toThrow(/Invalid ticket transition/);
        },
      );

      it('rejects selling a reserved ticket to a different order', async () => {
        const { id } = await givenTicket('RESERVED');
        const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id } });
        const otherOrderId = await givenOrder(ticket.raffleId);

        await expect(
          prisma.ticket.update({
            where: { id },
            data: { status: 'SOLD', orderId: otherOrderId },
          }),
        ).rejects.toThrow(/Invalid ticket transition/);
      });

      it('still allows extending a reservation', async () => {
        const { id } = await givenTicket('RESERVED');

        await expect(
          prisma.ticket.update({
            where: { id },
            data: { reservedUntil: new Date(Date.now() + 3_600_000) },
          }),
        ).resolves.toBeDefined();
      });
    });

    it('no longer has a table for gateway events', async () => {
      const [{ table }] = await prisma.$queryRaw<{ table: string | null }[]>`
        SELECT to_regclass('"WebhookEvent"')::text AS table
      `;

      expect(table).toBeNull();
    });

    it('rejects UPDATE and DELETE on AuditEvent', async () => {
      const raffleId = await givenActiveRaffle([1]);
      const { id } = await prisma.auditEvent.create({
        data: { raffleId, type: 'TEST_EVENT', data: { foo: 'bar' } },
      });

      await expect(
        prisma.auditEvent.update({ where: { id }, data: { type: 'HACKED' } }),
      ).rejects.toThrow(/append-only/);
      await expect(
        prisma.auditEvent.delete({ where: { id } }),
      ).rejects.toThrow(/append-only/);
    });
  });
});
