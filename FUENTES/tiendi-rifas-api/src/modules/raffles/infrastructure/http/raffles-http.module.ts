import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../../../auth/auth.module';
import { PrismaAuthStore } from '../../../auth/prisma-auth.store';
import {
  ApprovePaymentUseCase,
  ClaimLatePaymentUseCase,
  CompleteRefundUseCase,
  ConfirmLatePaymentUseCase,
  CreateRaffleUseCase,
  UpdateDraftRaffleUseCase,
  DeleteDraftRaffleUseCase,
  DismissLatePaymentUseCase,
  ExecuteDrawUseCase,
  GetPaymentProofUseCase,
  GetVerificationDataUseCase,
  ListLatePaymentClaimsUseCase,
  ListOperationCollisionsUseCase,
  ListPaymentAccountsUseCase,
  ListPendingPaymentAccountChangesUseCase,
  ProposePaymentAccountUseCase,
  ApprovePaymentAccountChangeUseCase,
  RejectPaymentAccountChangeUseCase,
  CancelPaymentAccountChangeUseCase,
  ListPendingRefundsUseCase,
  ListUnreadOperatorAlertsUseCase,
  MarkOperatorAlertReadUseCase,
  PublishRaffleUseCase,
  RecordExtraTransferUseCase,
  RejectPaymentUseCase,
  RequeueFailedNotificationUseCase,
  ReserveTicketsUseCase,
  SellInPersonUseCase,
  SetPaymentAccountActiveUseCase,
  SubmitPaymentProofUseCase,
  UpdatePaymentAccountUseCase,
} from '../../application';
import { CancelAlteredRaffleUseCase as CancelAltered } from '../../application/use-cases/cancel-altered-raffle.use-case';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import { SystemClock } from '../jobs/system-clock';
import {
  PersistenceModule,
  PrismaAuditLog,
  PrismaDrawRepository,
  PrismaOperatorAlertRepository,
  PrismaOrderRepository,
  PrismaPaymentAccountRepository,
  PrismaPaymentRepository,
  PrismaRaffleRepository,
  PrismaRefundRepository,
  PrismaReservationStore,
  PrismaTicketLedger,
  PrismaTicketRepository,
} from '../persistence';
import { LocalProofStorage } from '../storage/local-proof-storage';
import {
  beaconFrom,
  Env,
  env,
  proofPolicyFrom,
  reservationPolicyFrom,
  seedVaultFrom,
} from '../wiring';
import { AdminController } from './admin.controller';
import { BuyerController } from './buyer.controller';
import { PaymentAccountsController } from './payment-accounts.controller';
import { PublicController } from './public.controller';

const clock = new SystemClock();

/** The HTTP API of spec §11 (F6). */
@Module({
  imports: [PersistenceModule, AuthModule],
  controllers: [PublicController, PaymentAccountsController, BuyerController, AdminController],
  providers: [
    // The server clock: hora_servidor in the order a buyer reads.
    { provide: SystemClock, useValue: clock },
    {
      provide: LocalProofStorage,
      inject: [ConfigService],
      useFactory: (config: Env) => new LocalProofStorage(env(config, 'PROOF_STORAGE_DIR')),
    },
    {
      provide: RaffleQueries,
      inject: [PrismaRaffleRepository, PrismaTicketRepository, PrismaOrderRepository, PrismaDrawRepository],
      useFactory: (r, t, o, d) => new RaffleQueries(r, t, o, d),
    },
    {
      provide: ReserveTicketsUseCase,
      inject: [PrismaRaffleRepository, PrismaReservationStore, ConfigService],
      useFactory: (r, store, config: Env) =>
        new ReserveTicketsUseCase(r, store, clock, proofPolicyFrom(config), reservationPolicyFrom(config)),
    },
    {
      provide: SubmitPaymentProofUseCase,
      inject: [PrismaOrderRepository, PrismaTicketLedger, LocalProofStorage, ConfigService, PrismaPaymentAccountRepository],
      useFactory: (o, l, s, config: Env, a) =>
        new SubmitPaymentProofUseCase(o, l, s, clock, proofPolicyFrom(config), a),
    },
    {
      provide: ClaimLatePaymentUseCase,
      inject: [PrismaOrderRepository, PrismaTicketLedger, LocalProofStorage, ConfigService],
      useFactory: (o, l, s, config: Env) =>
        new ClaimLatePaymentUseCase(o, l, s, proofPolicyFrom(config), clock),
    },
    {
      provide: GetPaymentProofUseCase,
      inject: [PrismaOrderRepository, LocalProofStorage],
      useFactory: (o, s) => new GetPaymentProofUseCase(o, s),
    },
    {
      provide: CreateRaffleUseCase,
      inject: [PrismaRaffleRepository, PrismaAuditLog],
      useFactory: (r, a) => new CreateRaffleUseCase(r, a, clock),
    },
    {
      provide: UpdateDraftRaffleUseCase,
      inject: [PrismaRaffleRepository, PrismaAuditLog],
      useFactory: (r, a) => new UpdateDraftRaffleUseCase(r, a, clock),
    },
    {
      provide: PublishRaffleUseCase,
      inject: [PrismaRaffleRepository, PrismaTicketLedger, ConfigService],
      useFactory: (r, l, config: Env) =>
        new PublishRaffleUseCase(r, l, seedVaultFrom(config), beaconFrom(config)),
    },
    {
      provide: ExecuteDrawUseCase,
      inject: [PrismaRaffleRepository, PrismaTicketRepository, PrismaTicketLedger, PrismaDrawRepository, ConfigService],
      useFactory: (r, t, l, d, config: Env) =>
        new ExecuteDrawUseCase(r, t, l, beaconFrom(config), clock, d),
    },
    {
      provide: GetVerificationDataUseCase,
      inject: [PrismaRaffleRepository, PrismaTicketRepository, PrismaDrawRepository],
      useFactory: (r, t, d) => new GetVerificationDataUseCase(r, t, d),
    },
    ...[
      ApprovePaymentUseCase,
      RejectPaymentUseCase,
      ConfirmLatePaymentUseCase,
      DismissLatePaymentUseCase,
      RecordExtraTransferUseCase,
    ].map((UseCase) => ({
      provide: UseCase,
      inject: [PrismaOrderRepository, PrismaTicketLedger],
      useFactory: (o: PrismaOrderRepository, l: PrismaTicketLedger) => new UseCase(o, l, clock),
    })),
    {
      provide: CompleteRefundUseCase,
      inject: [PrismaRefundRepository, PrismaTicketLedger],
      useFactory: (r, l) => new CompleteRefundUseCase(r, l, clock),
    },
    {
      provide: CancelAltered,
      inject: [PrismaTicketLedger],
      useFactory: (l) => new CancelAltered(l, clock),
    },
    {
      provide: ListLatePaymentClaimsUseCase,
      inject: [PrismaOrderRepository],
      useFactory: (o) => new ListLatePaymentClaimsUseCase(o),
    },
    {
      provide: ListPendingRefundsUseCase,
      inject: [PrismaRefundRepository],
      useFactory: (r) => new ListPendingRefundsUseCase(r),
    },
    {
      provide: ListOperationCollisionsUseCase,
      inject: [PrismaPaymentRepository],
      useFactory: (p) => new ListOperationCollisionsUseCase(p),
    },
    {
      provide: ListUnreadOperatorAlertsUseCase,
      inject: [PrismaOperatorAlertRepository],
      useFactory: (a) => new ListUnreadOperatorAlertsUseCase(a),
    },
    {
      provide: MarkOperatorAlertReadUseCase,
      inject: [PrismaOperatorAlertRepository],
      useFactory: (a) => new MarkOperatorAlertReadUseCase(a, clock),
    },
    {
      provide: ListPaymentAccountsUseCase,
      inject: [PrismaPaymentAccountRepository],
      useFactory: (a) => new ListPaymentAccountsUseCase(a),
    },
    {
      provide: ListPendingPaymentAccountChangesUseCase,
      inject: [PrismaPaymentAccountRepository],
      useFactory: (a) => new ListPendingPaymentAccountChangesUseCase(a),
    },
    ...[
      ProposePaymentAccountUseCase,
      UpdatePaymentAccountUseCase,
      SetPaymentAccountActiveUseCase,
      ApprovePaymentAccountChangeUseCase,
      RejectPaymentAccountChangeUseCase,
      CancelPaymentAccountChangeUseCase,
    ].map(
      (UseCase) => ({
        provide: UseCase,
        inject: [PrismaPaymentAccountRepository],
        useFactory: (a: PrismaPaymentAccountRepository) => new UseCase(a, clock),
      }),
    ),
    {
      provide: RequeueFailedNotificationUseCase,
      inject: [PrismaTicketLedger],
      useFactory: (l) => new RequeueFailedNotificationUseCase(l, clock),
    },
    {
      provide: SellInPersonUseCase,
      inject: [PrismaTicketLedger, PrismaAuthStore, PrismaRaffleRepository],
      useFactory: (l, a, r) => new SellInPersonUseCase(l, a, clock, r),
    },
    {
      provide: DeleteDraftRaffleUseCase,
      inject: [PrismaRaffleRepository, PrismaAuditLog],
      useFactory: (r, a) => new DeleteDraftRaffleUseCase(r, a),
    },
  ],
})
export class RafflesHttpModule {}
