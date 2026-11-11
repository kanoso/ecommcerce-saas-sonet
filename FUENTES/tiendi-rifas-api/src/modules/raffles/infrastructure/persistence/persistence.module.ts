import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaRaffleRepository } from './prisma-raffle.repository';
import { PrismaTicketRepository } from './prisma-ticket.repository';
import { PrismaOrderRepository } from './prisma-order.repository';
import { PrismaReservationStore } from './prisma-reservation.store';
import { PrismaTicketLedger } from './prisma-ticket-ledger';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaRefundRepository } from './prisma-refund.repository';
import { PrismaOperatorAlertRepository } from './prisma-operator-alert.repository';
import { PrismaDrawRepository } from './prisma-draw.repository';
import { PrismaAuditLog } from './prisma-audit-log';
import { PrismaNotificationOutbox } from './prisma-notification-outbox';
import { PrismaPaymentAccountRepository } from './prisma-payment-account.repository';

@Module({
  providers: [
    PrismaOperatorAlertRepository,
    PrismaService,
    PrismaRaffleRepository,
    PrismaTicketRepository,
    PrismaOrderRepository,
    PrismaReservationStore,
    PrismaTicketLedger,
    PrismaPaymentRepository,
    PrismaRefundRepository,
    PrismaDrawRepository,
    PrismaAuditLog,
    PrismaNotificationOutbox,
    PrismaPaymentAccountRepository,
  ],
  exports: [
    PrismaOperatorAlertRepository,
    PrismaService,
    PrismaRaffleRepository,
    PrismaTicketRepository,
    PrismaOrderRepository,
    PrismaReservationStore,
    PrismaTicketLedger,
    PrismaPaymentRepository,
    PrismaRefundRepository,
    PrismaDrawRepository,
    PrismaAuditLog,
    PrismaNotificationOutbox,
    PrismaPaymentAccountRepository,
  ],
})
export class PersistenceModule {}
