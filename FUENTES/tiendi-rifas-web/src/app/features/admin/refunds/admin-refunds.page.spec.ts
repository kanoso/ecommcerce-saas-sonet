import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminRefund } from '../../../core/api/api.models';
import { ApiError } from '../../../core/api/api-error';
import { AdminRefundsPage } from './admin-refunds.page';

describe('AdminRefundsPage (DT-04 / DT-17)', () => {
  let fixture: ComponentFixture<AdminRefundsPage>;
  let component: AdminRefundsPage;
  let adminApiMock: {
    pendingRefunds: ReturnType<typeof vi.fn>;
    completeRefund: ReturnType<typeof vi.fn>;
  };

  const mockRefund: AdminRefund = {
    refundId: 'ref-300',
    orderId: 'ord-300',
    raffleId: 'rif-1',
    paymentId: 'pay-300',
    amount: 50,
    reason: 'Comprobante rechazado con dinero recibido',
    status: 'PENDING',
    createdAt: new Date('2026-11-03T14:00:00.000Z'),
  };

  beforeEach(async () => {
    adminApiMock = {
      pendingRefunds: vi.fn().mockReturnValue(of([mockRefund])),
      completeRefund: vi.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [AdminRefundsPage],
      providers: [{ provide: AdminApi, useValue: adminApiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRefundsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders pending refunds list with amounts in soles', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Reembolsos pendientes');
    expect(compiled.textContent).toContain('ref-300');
    expect(compiled.textContent).toContain('S/ 50.00');
    expect(compiled.textContent).toContain('Comprobante rechazado con dinero recibido');
  });

  it('completes refund with destination and operation number', () => {
    component.openComplete(mockRefund);
    component.completeForm.controls.destination.setValue('Yape 987654321');
    component.completeForm.controls.operationNumber.setValue('OP-REF-99');

    component.submitComplete();

    expect(adminApiMock.completeRefund).toHaveBeenCalledWith('ref-300', {
      destino: 'Yape 987654321',
      numero_operacion: 'OP-REF-99',
    });
  });

  it('shows four-eyes enforcement error when same operator attempts completion (DT-17)', () => {
    adminApiMock.completeRefund.mockReturnValue(
      throwError(() => new ApiError(409, 'SAME_OPERATOR_REFUND', 'Same operator cannot refund'))
    );

    component.openComplete(mockRefund);
    component.completeForm.controls.destination.setValue('BCP 191-123456');
    component.completeForm.controls.operationNumber.setValue('OP-REF-88');

    component.submitComplete();

    expect(component.actionError()).toContain('Control de 4 ojos');
  });
});
