import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminApi } from '../../../core/api/admin-api';
import { AdminSalesReport, RaffleOrderWithBuyer, RaffleSummary } from '../../../core/api/api.models';
import { AdminRaffleDetailPage } from './admin-raffle-detail.page';

const mockDraftRaffle: RaffleSummary = {
  id: 'r-1',
  title: 'Rifa Departamento',
  prize: 'Dpto en Miraflores',
  ticketPrice: 100,
  numberMin: 1,
  numberMax: 1000,
  totalNumbers: 1000,
  status: 'DRAFT',
  salesCloseAt: null,
  drawAt: null,
  soldCount: 0,
  availableCount: 1000,
  authorizationResolution: null,
};

const mockActiveRaffle: RaffleSummary = {
  id: 'r-2',
  title: 'Rifa Auto',
  prize: 'Auto 0km',
  ticketPrice: 20,
  numberMin: 1,
  numberMax: 500,
  totalNumbers: 500,
  status: 'ACTIVE',
  salesCloseAt: new Date('2026-12-01T18:00:00Z'),
  drawAt: new Date('2026-12-02T18:00:00Z'),
  soldCount: 200,
  availableCount: 300,
  authorizationResolution: 'RD-2026-001',
};

const mockSalesReport: AdminSalesReport = {
  raffleId: 'r-2',
  title: 'Rifa Auto',
  status: 'ACTIVE',
  ticketsSold: 200,
  ticketsReserved: 50,
  ticketsAvailable: 250,
  paidAmount: 4000,
  ordersByStatus: { PAID: 100, PENDING: 20, PENDING_VERIFICATION: 5 },
};

const mockOrder: RaffleOrderWithBuyer = {
  id: 'ord-123',
  raffleId: 'r-2',
  status: 'PAID',
  numbers: [7, 8],
  totalAmount: 40,
  declaredAmount: 40,
  bankOrWallet: 'YAPE',
  operationNumber: '112233',
  hasProof: true,
  createdAt: new Date('2026-11-04T12:00:00Z'),
  verifiedAt: new Date('2026-11-04T12:30:00Z'),
  buyer: {
    id: 'user-1',
    name: 'Juan Perez',
    document: '12345678',
    phone: '999888777',
    email: 'juan@test.local',
  },
};

describe('AdminRaffleDetailPage', () => {
  let fixture: ComponentFixture<AdminRaffleDetailPage>;
  let component: AdminRaffleDetailPage;
  let el: HTMLElement;
  let adminApiMock: {
    raffleDetail: ReturnType<typeof vi.fn>;
    salesReport: ReturnType<typeof vi.fn>;
    raffleOrders: ReturnType<typeof vi.fn>;
    publishRaffle: ReturnType<typeof vi.fn>;
    executeDraw: ReturnType<typeof vi.fn>;
    cancelAlteredRaffle: ReturnType<typeof vi.fn>;
    deleteDraftRaffle: ReturnType<typeof vi.fn>;
    availableTickets: ReturnType<typeof vi.fn>;
    sellInPerson: ReturnType<typeof vi.fn>;
    proofFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    adminApiMock = {
      raffleDetail: vi.fn().mockReturnValue(of(mockDraftRaffle)),
      salesReport: vi.fn().mockReturnValue(of({ ...mockSalesReport, raffleId: 'r-1', status: 'DRAFT', ticketsSold: 0, paidAmount: 0 })),
      raffleOrders: vi.fn().mockReturnValue(of([])),
      publishRaffle: vi.fn().mockReturnValue(
        of({
          raffleId: 'r-1',
          status: 'ACTIVE',
          commitmentHash: 'hash-abc',
          drandRound: '12345',
        }),
      ),
      executeDraw: vi.fn().mockReturnValue(
        of({
          drawId: 'd-1',
          winningNumber: 42,
          drandRound: '12345',
          executedAt: new Date('2026-12-02T18:05:00Z'),
        }),
      ),
      cancelAlteredRaffle: vi.fn().mockReturnValue(of({ raffleId: 'r-1', status: 'CANCELLED' })),
      deleteDraftRaffle: vi.fn().mockReturnValue(of(undefined)),
      availableTickets: vi.fn().mockReturnValue(of([42, 43, 44])),
      sellInPerson: vi.fn(),
      proofFile: vi.fn().mockReturnValue(of({ blob: new Blob(['png'], { type: 'image/png' }), filename: 'comprobante.png' })),
    };

    await TestBed.configureTestingModule({
      imports: [AdminRaffleDetailPage],
      providers: [
        provideRouter([{ path: 'admin/rifas', redirectTo: '' }, { path: '', component: AdminRaffleDetailPage }]),
        { provide: AdminApi, useValue: adminApiMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'r-1' } },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRaffleDetailPage);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders raffle details header and sales metrics (RF-12)', () => {
    expect(el.querySelector('#detail-title')?.textContent).toContain('Rifa Departamento');
    expect(el.textContent).toContain('Dpto en Miraflores');
    expect(el.textContent).toContain('S/ 100.00');

    expect(el.querySelector('.sales-metrics')).not.toBeNull();
    expect(el.textContent).toContain('Boletos vendidos');
  });

  it('shows publish form when raffle is in DRAFT status (RF-11)', () => {
    expect(el.querySelector('#resolucion_autorizacion')).not.toBeNull();
    expect(el.querySelector('#cierre_ventas')).not.toBeNull();
    expect(el.querySelector('#fecha_sorteo')).not.toBeNull();
    expect(el.querySelector('#confirm_publish')).not.toBeNull();
  });

  it('computes drand round preview dynamically from fecha_sorteo', () => {
    component.publishForm.patchValue({
      fecha_sorteo: '2026-12-02T18:00',
    });
    fixture.detectChanges();

    expect(component.drandRoundPreview()).not.toBeNull();
    expect(el.textContent).toContain('Ronda estimada de drand');
  });

  it('publishes raffle and displays commitment hash on success (RF-11)', () => {
    component.publishForm.setValue({
      resolucion_autorizacion: 'RD-001',
      cierre_ventas: '2026-12-01T18:00',
      fecha_sorteo: '2026-12-02T18:00',
      confirmado: true,
    });
    fixture.detectChanges();

    const publishBtn = el.querySelector('.btn-publish') as HTMLButtonElement;
    expect(publishBtn.disabled).toBe(false);
    publishBtn.click();
    fixture.detectChanges();

    expect(adminApiMock.publishRaffle).toHaveBeenCalled();
    expect(el.textContent).toContain('hash-abc');
  });

  it('renders draw execution section for active raffles and triggers draw (RF-13)', () => {
    adminApiMock.raffleDetail.mockReturnValue(of(mockActiveRaffle));
    adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
    adminApiMock.raffleOrders.mockReturnValue(of([mockOrder]));

    const activeFixture = TestBed.createComponent(AdminRaffleDetailPage);
    activeFixture.detectChanges();
    const activeEl = activeFixture.nativeElement as HTMLElement;

    expect(activeEl.querySelector('#draw-title')).not.toBeNull();

    // Check public raffle view link exists
    const publicLink = activeEl.querySelector('.btn-public-link') as HTMLAnchorElement;
    expect(publicLink).not.toBeNull();
    expect(publicLink.getAttribute('href')).toBe('/rifas/r-2');

    // Check buyers & orders table rendered
    expect(activeEl.textContent).toContain('Boletos Vendidos y Compradores');
    expect(activeEl.textContent).toContain('Juan Perez');
    expect(activeEl.textContent).toContain('12345678');
    expect(activeEl.textContent).toContain('#7');
    expect(activeEl.textContent).toContain('#8');
    expect(activeEl.textContent).toContain('Pagado');

    // The proof is fetched with the Authorization header, never linked with a token in the URL
    const proofButton = activeEl.querySelector('.btn-view-proof') as HTMLButtonElement;
    expect(proofButton).not.toBeNull();
    expect(proofButton.tagName).toBe('BUTTON');
    expect(proofButton.textContent).toContain('Ver comprobante');
    expect(proofButton.getAttribute('href')).toBeNull();
    expect(activeEl.innerHTML).not.toContain('token=');
    const popup = { location: { href: 'about:blank' }, opener: window as unknown, close: vi.fn() };
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:proof-ord-123'), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    proofButton.click();
    expect(adminApiMock.proofFile).toHaveBeenCalledWith('ord-123');
    expect(popup.location.href).toBe('blob:proof-ord-123');
    openSpy.mockRestore();

    const drawBtn = activeEl.querySelector('.btn-draw') as HTMLButtonElement;
    expect(drawBtn).not.toBeNull();
    drawBtn.click();
    activeFixture.detectChanges();

    expect(adminApiMock.executeDraw).toHaveBeenCalledWith('r-1');
    expect(activeEl.textContent).toContain('Número ganador: 42');
  });

  it('allows cancellation with mandatory reason and double confirmation for active raffle (RF-15 / DT-15)', () => {
    component.raffle.set(mockActiveRaffle);
    fixture.detectChanges();

    const cancelPromptBtn = el.querySelector('.btn-cancel-prompt') as HTMLButtonElement;
    expect(cancelPromptBtn).not.toBeNull();
    cancelPromptBtn.click();
    fixture.detectChanges();

    const reasonInput = el.querySelector('#cancel_motivo') as HTMLInputElement;
    expect(reasonInput).not.toBeNull();

    component.cancelReason.set('Cancelación administrativa por fuerza mayor');
    component.cancelConfirmed.set(true);
    fixture.detectChanges();

    const confirmCancelBtn = el.querySelector('.btn-confirm-cancel') as HTMLButtonElement;
    expect(confirmCancelBtn.disabled).toBe(false);
    confirmCancelBtn.click();
    fixture.detectChanges();

    expect(adminApiMock.cancelAlteredRaffle).toHaveBeenCalledWith(
      'r-1',
      'Cancelación administrativa por fuerza mayor',
    );
  });

  it('allows deleting a draft raffle', () => {
    component.raffle.set(mockDraftRaffle);
    fixture.detectChanges();

    const deletePromptBtn = el.querySelector('.btn-cancel-prompt') as HTMLButtonElement;
    expect(deletePromptBtn).not.toBeNull();
    expect(deletePromptBtn.textContent).toContain('Eliminar borrador');
    deletePromptBtn.click();
    fixture.detectChanges();

    const confirmDeleteBtn = el.querySelector('.btn-confirm-cancel') as HTMLButtonElement;
    expect(confirmDeleteBtn).not.toBeNull();
    confirmDeleteBtn.click();
    fixture.detectChanges();

    expect(adminApiMock.deleteDraftRaffle).toHaveBeenCalledWith('r-1');
  });

  describe('In-Person POS Modal', () => {
    let activeFixture: ComponentFixture<AdminRaffleDetailPage>;
    let activeComponent: AdminRaffleDetailPage;
    let activeEl: HTMLElement;

    beforeEach(() => {
      adminApiMock.raffleDetail.mockReturnValue(of(mockActiveRaffle));
      adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
      activeFixture = TestBed.createComponent(AdminRaffleDetailPage);
      activeComponent = activeFixture.componentInstance;
      activeEl = activeFixture.nativeElement;
      activeFixture.detectChanges();
    });

    it('opens POS modal when Venta Presencial button is clicked', () => {
      const posBtn = activeEl.querySelector('.btn-pos-trigger') as HTMLButtonElement;
      expect(posBtn).not.toBeNull();
      posBtn.click();
      activeFixture.detectChanges();

      expect(activeComponent.showPosModal()).toBe(true);
      const modal = activeEl.querySelector('.pos-modal');
      expect(modal).not.toBeNull();
    });

    it('submits in-person sale successfully and displays confirmation receipt', () => {
      adminApiMock.sellInPerson.mockReturnValue(
        of({
          id: 'ord-pos-777',
          raffleId: 'r-2',
          status: 'PAID',
          numbers: [42, 43],
          totalAmount: 40,
          bankOrWallet: 'EFECTIVO',
          expiresAt: null,
          verificationDueAt: null,
          declaredAmount: 40,
          rejectionReason: null,
          hasProof: false,
          paidToAccount: null,
        }),
      );

      activeComponent.openPosModal();
      activeFixture.detectChanges();

      activeComponent.posNumbersInput.set('42, 43');
      activeComponent.posAlias.set('Carlos Gomez');
      activeComponent.posPhone.set('+573001112233');
      activeComponent.posDocument.set('CC123456');
      activeFixture.detectChanges();

      const submitBtn = activeEl.querySelector('.btn-pos-submit') as HTMLButtonElement;
      expect(submitBtn).not.toBeNull();
      submitBtn.click();
      activeFixture.detectChanges();

      expect(adminApiMock.sellInPerson).toHaveBeenCalledWith('r-1', {
        numbers: [42, 43],
        alias: 'Carlos Gomez',
        phone: '+573001112233',
        document: 'CC123456',
      });

      expect(activeComponent.posSuccessOrder()).not.toBeNull();
      const receipt = activeEl.querySelector('.pos-receipt');
      expect(receipt).not.toBeNull();
      expect(receipt?.textContent).toContain('ord-pos-777');
      expect(receipt?.textContent).toContain('S/ 40.00');
    });

    it('displays error alert when sale submission fails', () => {
      adminApiMock.sellInPerson.mockReturnValue(
        throwError(() => ({
          status: 409,
          error: { message: 'Los boletos ya no están disponibles' },
        })),
      );

      activeComponent.openPosModal();
      activeFixture.detectChanges();

      activeComponent.posNumbersInput.set('42');
      activeComponent.posAlias.set('Carlos');
      activeComponent.posPhone.set('999888777');
      activeFixture.detectChanges();

      activeComponent.submitPosSale();
      activeFixture.detectChanges();

      expect(activeComponent.posError()).not.toBeNull();
      const alert = activeEl.querySelector('.pos-alert--error');
      expect(alert).not.toBeNull();
    });

    it('renders the prize showcase and gallery preview when raffle has images and specs', () => {
      activeComponent.raffle.set({
        ...mockActiveRaffle,
        prizeDescription: 'Camioneta 4x4 todo terreno con tapicería de cuero.',
        prizeImages: ['https://example.com/auto1.jpg', 'https://example.com/auto2.jpg'],
      });
      activeFixture.detectChanges();

      const showcase = activeEl.querySelector('.prize-showcase-section');
      expect(showcase).not.toBeNull();
      expect(showcase?.textContent).toContain('Galería del Premio y Ficha Técnica');
      expect(showcase?.textContent).toContain('Vista previa del carrusel (2 fotos)');
      expect(showcase?.textContent).toContain('Camioneta 4x4 todo terreno');

      const thumbs = showcase?.querySelectorAll('.admin-thumb-img');
      expect(thumbs?.length).toBe(2);
    });
  });
});
