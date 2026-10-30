import { OrderStatus } from '../../domain';
import {
  AuditLog,
  ChargeResult,
  OrderRepository,
  PaymentGateway,
} from '../ports';

export interface StartPaymentCommand {
  orderId: string;
  token: string;
}

export class StartPaymentUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly auditLog: AuditLog,
  ) {}

  async execute(command: StartPaymentCommand): Promise<ChargeResult> {
    const order = await this.orderRepo.findById(command.orderId);
    if (!order) {
      throw new Error(`Order ${command.orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Cannot start payment for order in status ${order.status}`);
    }

    const result = await this.paymentGateway.charge(order, command.token);

    await this.auditLog.record({
      raffleId: order.raffleId,
      type: 'PAYMENT_STARTED',
      data: {
        orderId: order.id,
        status: result.status,
        externalId: result.externalId,
      },
    });

    return result;
  }
}
