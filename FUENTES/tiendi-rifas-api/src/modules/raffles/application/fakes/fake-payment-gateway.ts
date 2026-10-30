import { TicketOrder } from '../../domain';
import { ChargeResult, PaymentGateway, RefundResult } from '../ports/payment-gateway';

export class FakePaymentGateway implements PaymentGateway {
  charges: { order: TicketOrder; token: string; result: ChargeResult }[] = [];
  refunds: { paymentId: string; amount: number; reason: string; result: RefundResult }[] = [];
  shouldFailCharge = false;

  async charge(order: TicketOrder, token: string): Promise<ChargeResult> {
    if (this.shouldFailCharge || token === 'tok_invalid') {
      const failResult: ChargeResult = {
        paymentId: `pay_${Date.now()}`,
        externalId: `ext_fail_${Date.now()}`,
        status: 'FAILED',
        rawPayload: { error: 'Card declined' },
      };
      this.charges.push({ order, token, result: failResult });
      return failResult;
    }

    const successResult: ChargeResult = {
      paymentId: `pay_${Date.now()}`,
      externalId: `ext_succ_${Date.now()}`,
      status: 'SUCCESS',
      rawPayload: { outcome: 'authorized', token },
    };
    this.charges.push({ order, token, result: successResult });
    return successResult;
  }

  async refund(paymentId: string, amount: number, reason: string): Promise<RefundResult> {
    const res: RefundResult = {
      success: true,
      externalRefundId: `ref_${Date.now()}`,
      rawPayload: { paymentId, amount, reason, status: 'refunded' },
    };
    this.refunds.push({ paymentId, amount, reason, result: res });
    return res;
  }

  clear(): void {
    this.charges = [];
    this.refunds = [];
    this.shouldFailCharge = false;
  }
}
