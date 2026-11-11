import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminPaymentAccount, PaymentAccountChange } from '../../../core/api/api.models';
import { SessionStore } from '../../../core/session/session.store';
import { AdminAccountsPage } from './admin-accounts.page';

describe('AdminAccountsPage (DT-19 4-eyes)', () => {
  let fixture: ComponentFixture<AdminAccountsPage>;
  let component: AdminAccountsPage;
  let adminApiMock: {
    paymentAccounts: ReturnType<typeof vi.fn>;
    pendingAccountChanges: ReturnType<typeof vi.fn>;
    proposePaymentAccount: ReturnType<typeof vi.fn>;
    updatePaymentAccount: ReturnType<typeof vi.fn>;
    deactivatePaymentAccount: ReturnType<typeof vi.fn>;
    activatePaymentAccount: ReturnType<typeof vi.fn>;
    approveAccountChange: ReturnType<typeof vi.fn>;
    rejectAccountChange: ReturnType<typeof vi.fn>;
    cancelAccountChange: ReturnType<typeof vi.fn>;
  };
  let sessionStoreMock: {
    user: ReturnType<typeof vi.fn>;
  };

  const mockAccount: AdminPaymentAccount = {
    id: 'acc-1',
    method: 'BCP',
    label: 'BCP',
    holder: 'Rifas SAC',
    number: '19112345678',
    cci: '00219112345678901234',
    version: 1,
    order: 1,
    active: true,
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    createdBy: 'admin-proposer',
    updatedBy: 'admin-proposer',
  };

  const mockSelfChange: PaymentAccountChange = {
    id: 'chg-self',
    kind: 'CREATE',
    accountId: 'acc-2',
    status: 'PENDING',
    proposed: {
      method: 'PLIN',
      holder: 'Juan Admin',
      number: '987654321',
      cci: null,
      order: 2,
    },
    before: null,
    proposedBy: 'admin-current',
    proposedAt: new Date('2026-11-03T10:00:00.000Z'),
    decidedBy: null,
    decidedAt: null,
  };

  const mockOtherChange: PaymentAccountChange = {
    id: 'chg-other',
    kind: 'UPDATE',
    accountId: 'acc-1',
    status: 'PENDING',
    proposed: {
      method: 'BCP',
      holder: 'Rifas SAC Nueva Cuenta',
      number: '19199999999',
      cci: null,
      order: 1,
    },
    before: null,
    proposedBy: 'admin-other',
    proposedAt: new Date('2026-11-03T11:00:00.000Z'),
    decidedBy: null,
    decidedAt: null,
  };

  beforeEach(async () => {
    adminApiMock = {
      paymentAccounts: vi.fn().mockReturnValue(of([mockAccount])),
      pendingAccountChanges: vi.fn().mockReturnValue(of([mockSelfChange, mockOtherChange])),
      proposePaymentAccount: vi.fn().mockReturnValue(of(mockSelfChange)),
      updatePaymentAccount: vi.fn().mockReturnValue(of(mockAccount)),
      deactivatePaymentAccount: vi.fn().mockReturnValue(of(mockAccount)),
      activatePaymentAccount: vi.fn().mockReturnValue(of(mockSelfChange)),
      approveAccountChange: vi.fn().mockReturnValue(of(mockAccount)),
      rejectAccountChange: vi.fn().mockReturnValue(of(mockOtherChange)),
      cancelAccountChange: vi.fn().mockReturnValue(of(mockSelfChange)),
    };

    sessionStoreMock = {
      user: vi.fn().mockReturnValue({ id: 'admin-current', email: 'admin@example.com', role: 'ADMIN' }),
    };

    await TestBed.configureTestingModule({
      imports: [AdminAccountsPage],
      providers: [
        { provide: AdminApi, useValue: adminApiMock },
        { provide: SessionStore, useValue: sessionStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAccountsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders payment accounts list and pending changes table', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Cuentas de pago');
    expect(compiled.textContent).toContain('19112345678');
    expect(compiled.textContent).toContain('Rifas SAC');
    expect(compiled.textContent).toContain('chg-self');
    expect(compiled.textContent).toContain('chg-other');
  });

  it('enforces 4-eyes: disables approve/reject and enables cancel on self-proposed change', () => {
    expect(component.canApproveOrReject(mockSelfChange)).toBe(false);
    expect(component.canCancel(mockSelfChange)).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Control de 4 ojos: propuesta por ti');
  });

  it('enforces 4-eyes: enables approve/reject and disables cancel on change proposed by another admin', () => {
    expect(component.canApproveOrReject(mockOtherChange)).toBe(true);
    expect(component.canCancel(mockOtherChange)).toBe(false);

    component.approveChange(mockOtherChange);
    expect(adminApiMock.approveAccountChange).toHaveBeenCalledWith('chg-other');
  });

  it('cancels self-proposed change', () => {
    component.cancelChange(mockSelfChange);
    expect(adminApiMock.cancelAccountChange).toHaveBeenCalledWith('chg-self');
  });

  it('proposes new payment account (DT-19 202)', () => {
    component.openProposeModal();
    component.proposeForm.controls.method.setValue('PLIN');
    component.proposeForm.controls.holder.setValue('Tienda SAC');
    component.proposeForm.controls.number.setValue('912345678');
    component.proposeForm.controls.order.setValue(3);

    component.submitPropose();

    expect(adminApiMock.proposePaymentAccount).toHaveBeenCalledWith({
      metodo: 'PLIN',
      titular: 'Tienda SAC',
      numero: '912345678',
      cci: null,
      orden: 3,
    });
  });

  it('deactivates active account immediately (DT-19 safe direction 200)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deactivateAccount(mockAccount);
    expect(adminApiMock.deactivatePaymentAccount).toHaveBeenCalledWith('acc-1');
  });
});
