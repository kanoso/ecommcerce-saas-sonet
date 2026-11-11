import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { Order } from '../../../core/api/api.models';
import { AdminLatePaymentsPage } from './admin-late-payments.page';

describe('AdminLatePaymentsPage (DT-07 / DT-10)', () => {
  let fixture: ComponentFixture<AdminLatePaymentsPage>;
  let component: AdminLatePaymentsPage;
  let adminApiMock: {
    latePaymentClaims: ReturnType<typeof vi.fn>;
    confirmLatePayment: ReturnType<typeof vi.fn>;
    dismissLatePayment: ReturnType<typeof vi.fn>;
    proofFileUrl: ReturnType<typeof vi.fn>;
  };

  const mockClaim: Order = {
    id: 'ord-200',
    raffleId: 'rif-1',
    status: 'LATE_PAYMENT_UNDER_REVIEW',
    numbers: [15, 30],
    totalAmount: 20,
    expiresAt: new Date('2026-11-03T12:00:00.000Z'),
    verificationDueAt: null,
    declaredAmount: 20,
    bankOrWallet: 'PLIN',
    rejectionReason: null,
    hasProof: true,
  };

  beforeEach(async () => {
    adminApiMock = {
      latePaymentClaims: vi.fn().mockReturnValue(of([mockClaim])),
      confirmLatePayment: vi.fn().mockReturnValue(of(undefined)),
      dismissLatePayment: vi.fn().mockReturnValue(of(undefined)),
      proofFileUrl: vi.fn().mockReturnValue('https://api.example.com/ordenes/ord-200/comprobante'),
    };

    await TestBed.configureTestingModule({
      imports: [AdminLatePaymentsPage],
      providers: [{ provide: AdminApi, useValue: adminApiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLatePaymentsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders late payment claims with released numbers notice', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Pagos tardíos');
    expect(compiled.textContent).toContain('ord-200');
    expect(compiled.textContent).toContain('S/ 20.00');
    expect(compiled.textContent).toContain('PLIN');
    expect(compiled.textContent).toContain('15, 30');
  });

  it('confirms late payment and opens refund for the buyer (DT-07)', () => {
    component.openConfirm(mockClaim);
    component.confirmForm.controls.receivedAmount.setValue(20);
    component.confirmForm.controls.bankOrWallet.setValue('PLIN');
    component.confirmForm.controls.operationNumber.setValue('OP-LATE-123');

    component.submitConfirm();

    expect(adminApiMock.confirmLatePayment).toHaveBeenCalledWith('ord-200', {
      monto_recibido: 20,
      banco_o_billetera: 'PLIN',
      numero_operacion: 'OP-LATE-123',
      colision: null,
      sobrepago: null,
    });
  });

  it('dismisses late payment claim with reason', () => {
    component.openDismiss(mockClaim);
    component.dismissForm.controls.reason.setValue('No se encontró el abono en el extracto bancario');

    component.submitDismiss();

    expect(adminApiMock.dismissLatePayment).toHaveBeenCalledWith('ord-200', {
      motivo: 'No se encontró el abono en el extracto bancario',
    });
  });
});
