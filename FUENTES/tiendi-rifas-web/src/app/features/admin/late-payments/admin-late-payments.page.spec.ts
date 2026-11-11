import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { ApiError } from '../../../core/api/api-error';
import { Order } from '../../../core/api/api.models';
import { AdminLatePaymentsPage } from './admin-late-payments.page';

describe('AdminLatePaymentsPage (DT-07 / DT-10)', () => {
  let fixture: ComponentFixture<AdminLatePaymentsPage>;
  let component: AdminLatePaymentsPage;
  let adminApiMock: {
    latePaymentClaims: ReturnType<typeof vi.fn>;
    confirmLatePayment: ReturnType<typeof vi.fn>;
    dismissLatePayment: ReturnType<typeof vi.fn>;
    proofFile: ReturnType<typeof vi.fn>;
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
      proofFile: vi.fn().mockReturnValue(of({ blob: new Blob(['png'], { type: 'image/png' }), filename: 'comprobante.png' })),
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

  it('opens the proof as an authenticated blob instead of a tokenized link', () => {
    const popup = { location: { href: 'about:blank' }, opener: window as unknown, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:proof-ord-200'), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('.btn-action--view') as HTMLButtonElement;

    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('href')).toBeNull();
    expect(el.innerHTML).not.toContain('token=');

    button.click();

    expect(adminApiMock.proofFile).toHaveBeenCalledWith('ord-200');
    expect(popup.location.href).toBe('blob:proof-ord-200');
    openSpy.mockRestore();
  });

  it('shows the API message when the proof cannot be opened', () => {
    const popup = { location: { href: 'about:blank' }, opener: window as unknown, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    adminApiMock.proofFile.mockReturnValue(
      throwError(() => new ApiError(401, 'UNAUTHORIZED', 'Tu sesión terminó. Ingresa de nuevo.')),
    );
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.btn-action--view') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(popup.close).toHaveBeenCalled();
    expect(el.querySelector('.proof-error')?.textContent).toContain('Tu sesión terminó. Ingresa de nuevo.');
    openSpy.mockRestore();
  });
});
