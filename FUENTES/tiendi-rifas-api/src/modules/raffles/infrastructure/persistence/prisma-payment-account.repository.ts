import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PaymentAccount as PaymentAccountRecord,
  PaymentAccountChange as PaymentAccountChangeRecord,
} from '@prisma/client';
import {
  BankOrWallet,
  DuplicatePaymentAccountError,
  OperatorAlertType,
  PaymentAccount,
  PaymentAccountChange,
  PaymentAccountChangeKind,
  PaymentAccountChangeStatus,
  PaymentAccountDetails,
  PendingPaymentAccountChangeError,
  StaleStateError,
} from '../../domain';
import {
  NotificationStatus,
  NotificationType,
  PaymentAccountEvent,
  PaymentAccountRepository,
  paymentAccountAlertKey,
  paymentAccountAlertOf,
} from '../../application/ports';
import { PrismaService } from './prisma.service';
import { TRANSACTION_OPTIONS } from './transaction-options';

const UNIQUE_VIOLATION = 'P2002';

const DISPLAY_ORDER: Prisma.PaymentAccountOrderByWithRelationInput[] = [
  { displayOrder: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

type Tx = Prisma.TransactionClient;

/** Thrown inside the transaction so it rolls back; mapped outside. */
class StaleWrite extends Error {
  constructor(readonly entity: string, readonly id: string, readonly expected: string) {
    super(`${entity} ${id} moved`);
  }
}

const json = (value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

/**
 * Payment accounts and their four-eyes changes (DT-19). Each event is one
 * transaction: the account and the change, the audit row (which the database
 * demands for any account write), the in-app alert and the alert email.
 */
@Injectable()
export class PrismaPaymentAccountRepository implements PaymentAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PaymentAccount | null> {
    const record = await this.prisma.paymentAccount.findUnique({ where: { id } });
    return record && PrismaPaymentAccountRepository.toDomain(record);
  }

  async listActive(): Promise<PaymentAccount[]> {
    const records = await this.prisma.paymentAccount.findMany({ where: { active: true }, orderBy: DISPLAY_ORDER });
    return records.map((r) => PrismaPaymentAccountRepository.toDomain(r));
  }

  async listAll(): Promise<PaymentAccount[]> {
    const records = await this.prisma.paymentAccount.findMany({ orderBy: DISPLAY_ORDER });
    return records.map((r) => PrismaPaymentAccountRepository.toDomain(r));
  }

  async findChange(id: string): Promise<PaymentAccountChange | null> {
    const record = await this.prisma.paymentAccountChange.findUnique({ where: { id } });
    return record && PrismaPaymentAccountRepository.changeToDomain(record);
  }

  async listPendingChanges(): Promise<PaymentAccountChange[]> {
    const records = await this.prisma.paymentAccountChange.findMany({
      where: { status: PaymentAccountChangeStatus.PENDING },
      orderBy: [{ proposedAt: 'asc' }, { id: 'asc' }],
    });
    return records.map((r) => PrismaPaymentAccountRepository.changeToDomain(r));
  }

  async findPendingChangeFor(accountId: string): Promise<PaymentAccountChange | null> {
    const record = await this.prisma.paymentAccountChange.findFirst({
      where: { accountId, status: PaymentAccountChangeStatus.PENDING },
    });
    return record && PrismaPaymentAccountRepository.changeToDomain(record);
  }

  async record(event: PaymentAccountEvent): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // The change first: the audit row points at it.
        if (event.change) {
          await this.writeChange(tx, event.change);
        }
        await tx.paymentAccountAudit.create({
          data: {
            id: event.auditId,
            accountId: event.accountId,
            changeId: event.change?.after.id ?? null,
            action: event.action,
            operatorId: event.operatorId,
            before: json(event.auditBefore),
            after: json(event.auditAfter),
            occurredAt: event.occurredAt,
          },
        });
        if (event.account) {
          await this.writeAccount(tx, event.account);
        }
        await tx.operatorAlert.create({
          data: {
            id: event.auditId,
            type: OperatorAlertType.PAYMENT_ACCOUNT_CHANGE,
            raffleId: null,
            raffleTitle: null,
            orderId: null,
            amount: null,
            paymentAccountId: event.accountId,
            createdAt: event.occurredAt,
          },
        });
        // Leaves through the outbox like every email, retried (DT-13).
        await tx.notificationOutbox.create({
          data: {
            type: NotificationType.PAYMENT_ACCOUNT_CHANGED,
            recipient: null,
            payload: paymentAccountAlertOf(event) as unknown as Prisma.InputJsonValue,
            orderId: null,
            raffleId: null,
            status: NotificationStatus.PENDING,
            nextAttemptAt: event.occurredAt,
            createdAt: event.occurredAt,
            dedupeKey: paymentAccountAlertKey(event.auditId),
          },
        });
      }, TRANSACTION_OPTIONS);
    } catch (error) {
      throw PrismaPaymentAccountRepository.domainErrorOf(error, event);
    }
  }

  private async writeChange(tx: Tx, change: NonNullable<PaymentAccountEvent['change']>): Promise<void> {
    const { before, after } = change;
    if (!before) {
      await tx.paymentAccountChange.create({
        data: {
          id: after.id,
          kind: after.kind,
          accountId: after.accountId,
          proposed: json(after.proposed),
          before: json(after.before),
          status: after.status,
          proposedBy: after.proposedBy,
          proposedAt: after.proposedAt,
          decidedBy: after.decidedBy,
          decidedAt: after.decidedAt,
        },
      });
      return;
    }
    // Decided once: of two decisions at the same time, one finds it pending.
    const { count } = await tx.paymentAccountChange.updateMany({
      where: { id: after.id, status: PaymentAccountChangeStatus.PENDING },
      data: { status: after.status, decidedBy: after.decidedBy, decidedAt: after.decidedAt },
    });
    if (count !== 1) {
      throw new StaleWrite('PaymentAccountChange', after.id, PaymentAccountChangeStatus.PENDING);
    }
  }

  private async writeAccount(tx: Tx, account: NonNullable<PaymentAccountEvent['account']>): Promise<void> {
    const { before, after } = account;
    const fields = {
      method: after.method,
      holderName: after.holderName,
      accountNumber: after.accountNumber,
      cci: after.cci,
      displayOrder: after.displayOrder,
      active: after.active,
      version: after.version,
      updatedAt: after.updatedAt,
      updatedBy: after.updatedBy,
    };
    if (!before) {
      await tx.paymentAccount.create({
        data: { ...fields, id: after.id, createdAt: after.createdAt, createdBy: after.createdBy },
      });
      return;
    }
    // Only over the version the use case read: a concurrent write wins once.
    const { count } = await tx.paymentAccount.updateMany({
      where: { id: after.id, version: before.version },
      data: fields,
    });
    if (count !== 1) {
      throw new StaleWrite('PaymentAccount', after.id, `version ${before.version}`);
    }
  }

  private static domainErrorOf(error: unknown, event: PaymentAccountEvent): unknown {
    if (error instanceof StaleWrite) {
      return new StaleStateError(error.entity, error.id, error.expected);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      const target = JSON.stringify((error.meta as { target?: unknown } | undefined)?.target ?? '');
      const detail = `${target} ${JSON.stringify(error.meta ?? {})} ${error.message}`;
      // The account's own key, or the pending proposals' destination index.
      if (target.includes('accountNumber') || detail.includes('pending_destination') || detail.includes('proposed')) {
        return new DuplicatePaymentAccountError();
      }
      if (target.includes('accountId') || target.includes('PaymentAccountChange_one_pending')) {
        return new PendingPaymentAccountChangeError(event.accountId);
      }
    }
    return error;
  }

  static toDomain(record: PaymentAccountRecord): PaymentAccount {
    return new PaymentAccount({
      id: record.id,
      method: record.method as BankOrWallet,
      holderName: record.holderName,
      accountNumber: record.accountNumber,
      cci: record.cci,
      displayOrder: record.displayOrder,
      active: record.active,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
    });
  }

  static changeToDomain(record: PaymentAccountChangeRecord): PaymentAccountChange {
    return new PaymentAccountChange({
      id: record.id,
      kind: record.kind as PaymentAccountChangeKind,
      accountId: record.accountId,
      proposed: (record.proposed as PaymentAccountDetails | null) ?? null,
      before: (record.before as PaymentAccountDetails | null) ?? null,
      status: record.status as PaymentAccountChangeStatus,
      proposedBy: record.proposedBy,
      proposedAt: record.proposedAt,
      decidedBy: record.decidedBy,
      decidedAt: record.decidedAt,
    });
  }
}
