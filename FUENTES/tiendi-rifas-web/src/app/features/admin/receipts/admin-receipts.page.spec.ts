import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { PendingProof } from '../../../core/api/api.models';
import { AdminAlertsStore } from '../alerts/admin-alerts.store';
import { AdminReceiptsPage } from './admin-receipts.page';

describe('AdminReceiptsPage (RF-16)', () => {
  let fixture: ComponentFixture<AdminReceiptsPage>;
  let component: AdminReceiptsPage;
  let adminApiMock: {
    alerts: ReturnType<typeof vi.fn>;
    pendingProofs: ReturnType<typeof vi.fn>;
    approvePayment: ReturnType<typeof vi.fn>;
    rejectPayment: ReturnType<typeof vi.fn>;
    recordExtraTransfer: ReturnType<typeof vi.fn>;
    proofFileUrl: ReturnType<typeof vi.fn>;
  };

  const mockProof: PendingProof = {
    id: 'ord-100',
    raffleId: 'rif-1',
    status: 'PENDING_VERIFICATION',
    numbers: [7, 14],
    totalAmount: 20,
    expiresAt: new Date('2026-11-04T12:00:00.000Z'),
    verificationDueAt: new Date(Date.now() + 3600_000),
    declaredAmount: 20,
    bankOrWallet: 'YAPE',
    rejectionReason: null,
    hasProof: true,
    operationNumber: 'OP-12345',
    raffleTitle: 'Rifa Auto 0km',
    buyer: {
      id: 'buyer-1',
      name: 'Carlos Gomez',
      document: '12345678',
      phone: '+51 987654321',
      email: 'carlos@example.com',
    },
    paidToAccount: {
      id: 'acc-1',
      method: 'YAPE',
      label: 'Yape',
      holder: 'Rifas SAC',
      number: '987654321',
      cci: null,
      version: 1,
    },
  };

  beforeEach(async () => {
    adminApiMock = {
      alerts: vi.fn().mockReturnValue(of([])),
      pendingProofs: vi.fn().mockReturnValue(of([mockProof])),
      approvePayment: vi.fn().mockReturnValue(of(undefined)),
      rejectPayment: vi.fn().mockReturnValue(of(undefined)),
      recordExtraTransfer: vi.fn().mockReturnValue(of(undefined)),
      proofFileUrl: vi.fn().mockReturnValue('https://api.example.com/ordenes/ord-100/comprobante'),
    };

    await TestBed.configureTestingModule({
      imports: [AdminReceiptsPage],
      providers: [{ provide: AdminApi, useValue: adminApiMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReceiptsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders pending receipts list with details', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Comprobantes pendientes');
    expect(compiled.textContent).toContain('OP-12345');
    expect(compiled.textContent).toContain('S/ 20.00');
    expect(compiled.textContent).toContain('Yape');
    expect(compiled.textContent).toContain('7, 14');
    expect(compiled.textContent).toContain('Rifa Auto 0km');
    expect(compiled.textContent).toContain('Carlos Gomez');
    expect(compiled.textContent).toContain('12345678');
    expect(compiled.textContent).toContain('+51 987654321');
    expect(compiled.textContent).toContain('carlos@example.com');
  });

  it('approves a payment when amount matches', () => {
    component.openApprove(mockProof);
    component.approveForm.controls.operationNumber.setValue('OP-12345');
    component.approveForm.controls.receivedAmount.setValue(20);

    component.submitApprove();

    expect(adminApiMock.approvePayment).toHaveBeenCalledWith('ord-100', {
      numero_operacion: 'OP-12345',
      monto_recibido: 20,
      colision: null,
    });
  });

  it('rejects a payment without money received (DT-08)', () => {
    component.openReject(mockProof);
    component.rejectForm.controls.moneyReceived.setValue(false);
    component.rejectForm.controls.reason.setValue('Comprobante ilegible');

    component.submitReject();

    expect(adminApiMock.rejectPayment).toHaveBeenCalledWith('ord-100', {
      dinero_recibido: false,
      motivo: 'Comprobante ilegible',
    });
  });

  it('rejects a payment with money received and opens refund (DT-08)', () => {
    component.openReject(mockProof);
    component.rejectForm.controls.moneyReceived.setValue(true);
    component.rejectForm.controls.reason.setValue('Monto menor al total');
    component.rejectForm.controls.receivedAmount.setValue(10);
    component.rejectForm.controls.bankOrWallet.setValue('YAPE');
    component.rejectForm.controls.operationNumber.setValue('OP-12345');

    component.submitReject();

    expect(adminApiMock.rejectPayment).toHaveBeenCalledWith('ord-100', {
      dinero_recibido: true,
      motivo: 'Monto menor al total',
      monto_recibido: 10,
      banco_o_billetera: 'YAPE',
      numero_operacion: 'OP-12345',
      colision: null,
      sobrepago: null,
    });
  });

  it('records extra transfer for an order (DT-16)', () => {
    component.openExtraTransfer(mockProof);
    component.extraTransferForm.controls.reason.setValue('Transferencia duplicada posterior');
    component.extraTransferForm.controls.receivedAmount.setValue(20);
    component.extraTransferForm.controls.bankOrWallet.setValue('YAPE');
    component.extraTransferForm.controls.operationNumber.setValue('OP-99999');

    component.submitExtraTransfer();

    expect(adminApiMock.recordExtraTransfer).toHaveBeenCalledWith('ord-100', {
      motivo: 'Transferencia duplicada posterior',
      monto_recibido: 20,
      banco_o_billetera: 'YAPE',
      numero_operacion: 'OP-99999',
      colision: null,
      sobrepago: null,
    });
  });

  it('updates pending proofs counter in store after approval', () => {
    const alertsStore = TestBed.inject(AdminAlertsStore);
    expect(alertsStore.pendingProofsCount()).toBe(1);

    adminApiMock.pendingProofs.mockReturnValue(of([]));
    component.openApprove(mockProof);
    component.approveForm.controls.operationNumber.setValue('OP-12345');
    component.approveForm.controls.receivedAmount.setValue(20);
    component.submitApprove();

    expect(alertsStore.pendingProofsCount()).toBe(0);
  });
});
