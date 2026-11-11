import { Controller, Get } from '@nestjs/common';
import { ListPaymentAccountsUseCase } from '../../application';
import * as present from './presenters';

/**
 * Where buyers transfer (DT-19): the active accounts, in display order.
 * Public, as the payment page shows them before any proof. Operators edit
 * them under /api/admin/cuentas-pago.
 */
@Controller('cuentas-pago')
export class PaymentAccountsController {
  constructor(private readonly accounts: ListPaymentAccountsUseCase) {}

  @Get()
  async list() {
    return (await this.accounts.execute({ includeInactive: false })).map(present.publicPaymentAccount);
  }
}
