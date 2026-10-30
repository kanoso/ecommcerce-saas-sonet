import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PrismaRaffleRepository } from './prisma-raffle.repository';
import { PrismaTicketRepository } from './prisma-ticket.repository';
import { PrismaOrderRepository } from './prisma-order.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaDrawRepository } from './prisma-draw.repository';
import { PrismaAuditLog } from './prisma-audit-log';

@Module({
  providers: [
    PrismaService,
    PrismaRaffleRepository,
    PrismaTicketRepository,
    PrismaOrderRepository,
    PrismaPaymentRepository,
    PrismaDrawRepository,
    PrismaAuditLog,
  ],
  exports: [
    PrismaService,
    PrismaRaffleRepository,
    PrismaTicketRepository,
    PrismaOrderRepository,
    PrismaPaymentRepository,
    PrismaDrawRepository,
    PrismaAuditLog,
  ],
})
export class PersistenceModule {}
