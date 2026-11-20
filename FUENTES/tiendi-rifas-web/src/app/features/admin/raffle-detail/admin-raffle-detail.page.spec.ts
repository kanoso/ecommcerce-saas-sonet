import { HttpErrorResponse } from '@angular/common/http';
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
  prizes: [],
  winnerExclusionMode: 'TICKET_ONLY',
  liveDrawInProgress: false,
  winners: [],
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
  prizes: [],
  winnerExclusionMode: 'TICKET_ONLY',
  liveDrawInProgress: false,
  winners: [],
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
    cancelRefusedDrawRaffle: ReturnType<typeof vi.fn>;
    deleteDraftRaffle: ReturnType<typeof vi.fn>;
    availableTickets: ReturnType<typeof vi.fn>;
    sellInPerson: ReturnType<typeof vi.fn>;
    proofFileUrl: ReturnType<typeof vi.fn>;
    updateDraftRaffle: ReturnType<typeof vi.fn>;
    changeExclusionMode: ReturnType<typeof vi.fn>;
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
      cancelRefusedDrawRaffle: vi.fn().mockReturnValue(of({ raffleId: 'r-1', status: 'CANCELLED' })),
      deleteDraftRaffle: vi.fn().mockReturnValue(of(undefined)),
      availableTickets: vi.fn().mockReturnValue(of([42, 43, 44])),
      sellInPerson: vi.fn(),
      proofFileUrl: vi.fn((id: string) => `/api/ordenes/${id}/comprobante?token=test-tok`),
      updateDraftRaffle: vi.fn().mockReturnValue(of({})),
      changeExclusionMode: vi.fn().mockReturnValue(of({ raffleId: 'r-1', status: 'ACTIVE', winnerExclusionMode: 'BUYER' })),
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

    // Check proof link is rendered for order with proof
    const proofLink = activeEl.querySelector('.btn-view-proof') as HTMLAnchorElement;
    expect(proofLink).not.toBeNull();
    expect(proofLink.textContent).toContain('Ver comprobante');
    expect(proofLink.getAttribute('href')).toBe('/api/ordenes/ord-123/comprobante?token=test-tok');
    expect(proofLink.getAttribute('target')).toBe('_blank');

    const drawBtn = activeEl.querySelector('.btn-draw') as HTMLButtonElement;
    expect(drawBtn).not.toBeNull();
    drawBtn.click();
    activeFixture.detectChanges();

    expect(adminApiMock.executeDraw).toHaveBeenCalledWith('r-1');
    const rows = [...activeEl.querySelectorAll('.draw-winners li')].map((li) => li.textContent);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('#42');
  });

  describe('prize photo zoom', () => {
    afterEach(() => {
      document.body.style.overflow = '';
    });

    it("opens the lightbox with that prize's images at the clicked thumbnail", () => {
      adminApiMock.raffleDetail.mockReturnValue(
        of({
          ...mockActiveRaffle,
          prizes: [
            { position: 1, title: 'Auto', description: null, images: ['https://example.com/auto.jpg'] },
            {
              position: 2,
              title: 'Moto',
              description: null,
              images: ['https://example.com/moto1.jpg', 'https://example.com/moto2.jpg'],
            },
          ],
        }),
      );
      adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
      const f = TestBed.createComponent(AdminRaffleDetailPage);
      f.detectChanges();
      const root = f.nativeElement as HTMLElement;
      expect(root.querySelector('app-image-lightbox')).toBeNull();

      const items = root.querySelectorAll('[data-testid="prize-item"]');
      const thumbs = items[1].querySelectorAll('button.admin-thumb-card');
      expect(thumbs.length).toBe(2);
      expect(thumbs[1].getAttribute('aria-label')).toContain('Ampliar');
      (thumbs[1] as HTMLButtonElement).click();
      f.detectChanges();

      const img = root.querySelector('app-image-lightbox .lightbox__img') as HTMLImageElement;
      expect(img.src).toBe('https://example.com/moto2.jpg');
      expect(img.alt).toContain('Premio 2: Moto');
      expect(root.querySelector('app-image-lightbox .lightbox__counter')?.textContent?.trim()).toBe('2 / 2');

      (root.querySelector('app-image-lightbox button[aria-label="Cerrar"]') as HTMLButtonElement).click();
      f.detectChanges();
      expect(root.querySelector('app-image-lightbox')).toBeNull();
    });
  });

  describe('every prize of the draw (DT-23)', () => {
    const drawnRaffle: RaffleSummary = {
      ...mockActiveRaffle,
      status: 'DRAWN',
      drawMode: 'MANUAL',
      prizes: [
        { position: 1, title: 'Olla arrocera', description: null, images: [] },
        { position: 2, title: 'Licuadora', description: null, images: [] },
      ],
      winners: [
        { position: 1, prizeTitle: 'Olla arrocera', status: 'WON', winningNumber: 7, buyerAlias: 'Juan Perez' },
        { position: 2, prizeTitle: 'Licuadora', status: 'VOID', winningNumber: null, buyerAlias: null },
      ],
      liveSession: null,
    };

    function renderDetail(raffle: RaffleSummary) {
      adminApiMock.raffleDetail.mockReturnValue(of(raffle));
      adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
      const f = TestBed.createComponent(AdminRaffleDetailPage);
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }

    it('lists each prize with its winner and buyer alias, or Desierto', () => {
      const root = renderDetail(drawnRaffle);
      const rows = [...root.querySelectorAll('.draw-winners li')].map((li) => li.textContent?.replace(/\s+/g, ' '));

      expect(rows[0]).toContain('Olla arrocera');
      expect(rows[0]).toContain('#7');
      expect(rows[0]).toContain('Juan Perez');
      expect(rows[1]).toContain('Licuadora');
      expect(rows[1]).toContain('Desierto');
      expect(root.querySelector('a[href="/rifas/r-2/en-vivo"]')).not.toBeNull();
      expect(root.querySelector('a[href="/rifas/r-2/verificacion"]')).not.toBeNull();
    });

    describe('who ran the draw', () => {
      // Mid-day UTC so the date is the 20th in any test timezone.
      const finishedAt = new Date('2026-11-20T15:40:00Z');
      const executedLine = (root: HTMLElement) => root.querySelector('.draw-executed-by')?.textContent?.replace(/\s+/g, ' ').trim();

      it('names the admin who ran it, with the finish time of the session', () => {
        const root = renderDetail({
          ...drawnRaffle,
          liveSession: { step: 2, totalSteps: 2, startedAt: null, updatedAt: null, finishedAt, conductedBy: 'Ana Admin' },
          executedBy: { kind: 'ADMIN', name: 'Ana Admin' },
        });
        expect(executedLine(root)).toMatch(/^Sorteo realizado por Ana Admin · .*20.*nov/);
      });

      it('says Sistema for an automatic draw', () => {
        const root = renderDetail({
          ...drawnRaffle,
          drawMode: 'AUTOMATIC',
          drawAt: new Date('2026-11-20T05:17:00Z'),
          executedBy: { kind: 'SYSTEM', name: null },
        });
        expect(executedLine(root)).toMatch(/^Sorteo automático · /);
      });

      it('shows nothing when the API does not say who ran it', () => {
        expect(renderDetail({ ...drawnRaffle, executedBy: null }).querySelector('.draw-executed-by')).toBeNull();
        expect(renderDetail(drawnRaffle).querySelector('.draw-executed-by')).toBeNull();
      });

      it('only says who conducted it when the executor was not recorded', () => {
        const root = renderDetail({
          ...drawnRaffle,
          liveSession: { step: 2, totalSteps: 2, startedAt: null, updatedAt: null, finishedAt, conductedBy: 'Ana Admin' },
          executedBy: null,
        });
        expect(executedLine(root)).toMatch(/^Conducido por Ana Admin · .*20.*nov/);
        expect(executedLine(root)).not.toContain('realizado');
      });
    });

    it('lists every prize of the draw it just ran', () => {
      adminApiMock.executeDraw.mockReturnValue(
        of({
          drawId: 'd-1',
          winningNumber: 7,
          winners: [
            { position: 1, status: 'WON', winningNumber: 7 },
            { position: 2, status: 'WON', winningNumber: 9 },
          ],
          drandRound: '12345',
          executedAt: new Date('2026-12-02T18:05:00Z'),
        }),
      );
      adminApiMock.raffleDetail.mockReturnValue(
        of({ ...mockActiveRaffle, status: 'CLOSED', prizes: drawnRaffle.prizes }),
      );
      adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
      const f = TestBed.createComponent(AdminRaffleDetailPage);
      f.detectChanges();
      const root = f.nativeElement as HTMLElement;
      (root.querySelector('.btn-draw') as HTMLButtonElement).click();
      f.detectChanges();

      const rows = [...root.querySelectorAll('.draw-winners li')].map((li) => li.textContent?.replace(/\s+/g, ' '));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toContain('Olla arrocera');
      expect(rows[0]).toContain('#7');
      expect(rows[1]).toContain('Licuadora');
      expect(rows[1]).toContain('#9');
    });

    it('shows the live draw in progress and links to it', () => {
      const root = renderDetail({
        ...drawnRaffle,
        liveDrawInProgress: true,
        liveSession: { step: 2, totalSteps: 6, startedAt: null, updatedAt: null, finishedAt: null },
      });

      expect(root.querySelector('.status-badge')?.textContent).toContain('Sorteando en vivo');
      expect(root.textContent).toContain('paso 2 de 6');
      expect(root.querySelector('a[href="/rifas/r-2/en-vivo"]')).not.toBeNull();
    });

    it('sends a MANUAL raffle whose sales closed to the live draw', () => {
      const root = renderDetail({
        ...mockActiveRaffle,
        status: 'CLOSED',
        drawMode: 'MANUAL',
        drawAt: new Date('2020-01-01T00:00:00Z'),
      });

      expect(root.querySelector('.status-badge')?.textContent).toContain('Sorteo pendiente');
      const live = root.querySelector('a.btn-live-draw');
      expect(live?.getAttribute('href')).toBe('/rifas/r-2/en-vivo');
      expect(live?.textContent).toContain('Ir al sorteo en vivo');
    });
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

  describe('draw refused for its configuration (DT-21)', () => {
    const refusedRaffle: RaffleSummary = {
      ...mockActiveRaffle,
      status: 'CLOSED',
      refusedDraw: {
        reason: 'DRAW_CONFIG_FROZEN_LATE',
        at: new Date('2026-12-02T18:00:05Z'),
      },
    };

    it('explains the refusal and offers only the cancel with refund', () => {
      component.raffle.set(refusedRaffle);
      fixture.detectChanges();

      const alert = el.querySelector('[data-testid="refused-draw-alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.getAttribute('role')).toBe('alert');
      expect(alert?.textContent).toContain('cuando la ronda de drand ya era pública');
      expect(el.querySelector('[data-testid="refused-draw-cancel"]')?.textContent).toContain(
        'Cancelar y reembolsar',
      );
      // The generic cancel would be refused for an intact list (DT-15).
      expect(el.querySelector('#cancel-title')).toBeNull();
    });

    it('cancels with the reason once confirmed and reloads the raffle', () => {
      component.raffle.set(refusedRaffle);
      fixture.detectChanges();
      (el.querySelector('[data-testid="refused-draw-cancel"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const confirm = el.querySelector('[data-testid="refused-draw-confirm"]') as HTMLButtonElement;
      expect(el.querySelector('#refused_motivo')).not.toBeNull();
      expect(confirm.disabled).toBe(true);

      component.refusedCancelReason.set('  Sorteo rechazado por configuración  ');
      fixture.detectChanges();
      expect(confirm.disabled).toBe(true);

      component.refusedCancelConfirmed.set(true);
      fixture.detectChanges();
      expect(confirm.disabled).toBe(false);
      adminApiMock.raffleDetail.mockClear();
      confirm.click();
      fixture.detectChanges();

      expect(adminApiMock.cancelRefusedDrawRaffle).toHaveBeenCalledWith(
        'r-1',
        'Sorteo rechazado por configuración',
      );
      expect(adminApiMock.cancelAlteredRaffle).not.toHaveBeenCalled();
      expect(adminApiMock.raffleDetail).toHaveBeenCalled();
    });

    it('shows an error when the cancel fails', () => {
      adminApiMock.cancelRefusedDrawRaffle.mockReturnValue(throwError(() => new Error('409')));
      component.raffle.set(refusedRaffle);
      component.showRefusedCancelDialog.set(true);
      component.refusedCancelReason.set('Motivo');
      component.refusedCancelConfirmed.set(true);
      fixture.detectChanges();

      (el.querySelector('[data-testid="refused-draw-confirm"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(el.textContent).toContain('No se pudo cancelar la rifa.');
    });

    it('shows nothing of it for a CLOSED raffle whose draw was not refused', () => {
      component.raffle.set({ ...refusedRaffle, refusedDraw: null });
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="refused-draw-alert"]')).toBeNull();
      expect(el.querySelector('#cancel-title')).not.toBeNull();
    });

    it('shows nothing of it once the raffle is cancelled', () => {
      component.raffle.set({ ...refusedRaffle, status: 'CANCELLED' });
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="refused-draw-alert"]')).toBeNull();
    });
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
          buyer: {
            id: 'user-1',
            alias: 'Carlos Gomez',
            buyerCode: 'CARLOS-GOMEZ',
            existing: false,
            matchedBy: null,
          },
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
        buyerCode: null,
      });

      expect(activeComponent.posSuccessOrder()).not.toBeNull();
      const receipt = activeEl.querySelector('.pos-receipt');
      expect(receipt).not.toBeNull();
      expect(receipt?.textContent).toContain('ord-pos-777');
      expect(receipt?.textContent).toContain('S/ 40.00');
      const buyerLine = activeEl.querySelector('[data-testid="pos-receipt-buyer"]');
      expect(buyerLine?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Comprador: Carlos Gomez · Código CARLOS-GOMEZ',
      );
      expect(receipt?.textContent).not.toContain('Asociado al comprador existente');
    });

    it('does not require the phone and labels it as optional', () => {
      adminApiMock.sellInPerson.mockReturnValue(of(posSale({ buyerCode: 'JUAN-PEREZ' })));
      activeComponent.openPosModal();
      activeFixture.detectChanges();

      expect(activeEl.querySelector('label[for="pos_phone"]')?.textContent).toContain(
        'Teléfono / Celular (opcional)',
      );

      activeComponent.posNumbersInput.set('42');
      activeComponent.posAlias.set('Juan Perez');
      activeComponent.submitPosSale();
      activeFixture.detectChanges();

      expect(activeComponent.posError()).toBeNull();
      expect(adminApiMock.sellInPerson).toHaveBeenCalledWith('r-1', {
        numbers: [42],
        alias: 'Juan Perez',
        phone: null,
        document: null,
        buyerCode: null,
      });
    });

    it('sends the buyer code of a returning buyer and tells it was associated', () => {
      adminApiMock.sellInPerson.mockReturnValue(
        of(posSale({ alias: 'Juan Perez', buyerCode: 'JUAN-PEREZ-2', existing: true, matchedBy: 'BUYER_CODE' })),
      );
      activeComponent.openPosModal();
      activeFixture.detectChanges();

      const codeInput = activeEl.querySelector('#pos_buyer_code') as HTMLInputElement;
      expect(codeInput).not.toBeNull();
      expect(activeEl.querySelector('label[for="pos_buyer_code"]')?.textContent).toContain(
        'Código de comprador',
      );

      activeComponent.posNumbersInput.set('42');
      activeComponent.posAlias.set('Juan');
      activeComponent.posBuyerCode.set('  juan-perez-2 ');
      activeComponent.submitPosSale();
      activeFixture.detectChanges();

      expect(adminApiMock.sellInPerson).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({ buyerCode: 'juan-perez-2' }),
      );
      const buyerLine = activeEl.querySelector('[data-testid="pos-receipt-buyer"]');
      expect(buyerLine?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Comprador: Juan Perez · Código JUAN-PEREZ-2',
      );
      expect(activeEl.querySelector('[data-testid="pos-receipt-existing"]')?.textContent).toContain(
        'Asociado al comprador existente',
      );
    });

    it('shows the buyer without code when an existing buyer has none', () => {
      adminApiMock.sellInPerson.mockReturnValue(
        of(posSale({ alias: 'Rosa', buyerCode: null, existing: true, matchedBy: 'PHONE' })),
      );
      activeComponent.openPosModal();
      activeComponent.posNumbersInput.set('42');
      activeComponent.posAlias.set('Rosa');
      activeComponent.posPhone.set('911111111');
      activeComponent.submitPosSale();
      activeFixture.detectChanges();

      const buyerLine = activeEl.querySelector('[data-testid="pos-receipt-buyer"]');
      expect(buyerLine?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Comprador: Rosa');
      expect(activeEl.querySelector('[data-testid="pos-receipt-existing"]')).not.toBeNull();
    });

    it('explains that an unknown buyer code does not exist', () => {
      adminApiMock.sellInPerson.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: {
                code: 'BUYER_CODE_NOT_FOUND',
                message: 'No buyer with code JUAN-PEREZ-9',
                details: { codigo_comprador: 'JUAN-PEREZ-9' },
              },
            }),
        ),
      );
      activeComponent.openPosModal();
      activeComponent.posNumbersInput.set('42');
      activeComponent.posAlias.set('Juan');
      activeComponent.posBuyerCode.set('juan perez 9');
      activeComponent.submitPosSale();
      activeFixture.detectChanges();

      expect(activeComponent.posError()).toBe('No existe un comprador con el código JUAN-PEREZ-9.');
      expect(activeComponent.posSuccessOrder()).toBeNull();
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

  describe('buyer code in the orders list', () => {
    it('shows the buyer code of an in-person buyer', () => {
      adminApiMock.raffleDetail.mockReturnValue(of(mockActiveRaffle));
      adminApiMock.salesReport.mockReturnValue(of(mockSalesReport));
      adminApiMock.raffleOrders.mockReturnValue(
        of([
          {
            ...mockOrder,
            bankOrWallet: 'EFECTIVO',
            buyer: { id: 'user-2', name: 'Juan Perez', document: null, phone: null, email: null, buyerCode: 'JUAN-PEREZ-2' },
          },
        ]),
      );
      const listFixture = TestBed.createComponent(AdminRaffleDetailPage);
      listFixture.detectChanges();
      const listEl = listFixture.nativeElement as HTMLElement;

      const code = listEl.querySelector('[data-testid="order-buyer-code"]');
      expect(code?.textContent).toContain('JUAN-PEREZ-2');
      expect(listEl.textContent).not.toContain('Sin datos de contacto adicionales');
    });

    it('finds an order by its buyer code', () => {
      const listComponent = TestBed.createComponent(AdminRaffleDetailPage).componentInstance;
      listComponent.orders.set([
        { ...mockOrder, id: 'ord-a', buyer: { ...mockOrder.buyer!, buyerCode: 'JUAN-PEREZ-2' } },
        { ...mockOrder, id: 'ord-b', buyer: { ...mockOrder.buyer!, buyerCode: null } },
      ]);
      listComponent.orderSearchTerm.set('juan-perez-2');

      expect(listComponent.filteredOrders().map((o) => o.id)).toEqual(['ord-a']);
    });
  });

  describe('prizes and winner exclusion mode', () => {
    const twoPrizes = [
      { position: 1, title: 'Auto 0km', description: 'Sedán rojo', images: ['https://example.com/a.jpg'] },
      { position: 2, title: 'Moto', description: null, images: [] },
    ];

    it('lists every prize in draw order', () => {
      component.raffle.set({ ...mockActiveRaffle, prizes: twoPrizes });
      fixture.detectChanges();

      const items = el.querySelectorAll('[data-testid="prize-item"]');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Premio 1');
      expect(items[0].textContent).toContain('Auto 0km');
      expect(items[1].textContent).toContain('Moto');
    });

    it('saves the edited prize list and mode of a draft', () => {
      component.raffle.set({ ...mockDraftRaffle, prizes: twoPrizes });
      component.openEditShowcaseModal();
      component.editPrizes.update((list) => [...list].reverse());
      component.editExclusionMode.set('BUYER');

      component.saveEditShowcase();

      expect(adminApiMock.updateDraftRaffle).toHaveBeenCalledWith(
        'r-1',
        expect.objectContaining({
          premios: [
            { titulo: 'Moto', descripcion: null, imagenes: [] },
            { titulo: 'Auto 0km', descripcion: 'Sedán rojo', imagenes: ['https://example.com/a.jpg'] },
          ],
          modo_exclusion_ganador: 'BUYER',
        }),
      );
      expect(adminApiMock.updateDraftRaffle.mock.calls[0][1]).not.toHaveProperty('descripcion_premio');
    });

    it('changes the mode of an ACTIVE raffle through its own endpoint', () => {
      component.raffle.set({ ...mockActiveRaffle, prizes: twoPrizes });
      fixture.detectChanges();

      component.modeDraft.set('BUYER');
      fixture.detectChanges();
      (el.querySelector('[data-testid="save-exclusion-mode"]') as HTMLButtonElement).click();

      expect(adminApiMock.changeExclusionMode).toHaveBeenCalledWith('r-1', 'BUYER');
    });

    it('locks the mode once sales are closed', () => {
      component.raffle.set({ ...mockActiveRaffle, status: 'CLOSED', prizes: twoPrizes });
      fixture.detectChanges();

      const fieldset = el.querySelector('app-exclusion-mode-field fieldset') as HTMLFieldSetElement;
      expect(fieldset.disabled).toBe(true);
      expect(el.querySelector('[data-testid="save-exclusion-mode"]')).toBeNull();
      expect(el.textContent).toContain('Bloqueado');
    });
  });
});

function posSale(buyer: {
  alias?: string;
  buyerCode: string | null;
  existing?: boolean;
  matchedBy?: 'BUYER_CODE' | 'PHONE' | 'DOCUMENT' | null;
}) {
  return {
    id: 'ord-pos-1',
    raffleId: 'r-2',
    status: 'PAID',
    numbers: [42],
    totalAmount: 20,
    bankOrWallet: 'EFECTIVO',
    expiresAt: null,
    verificationDueAt: null,
    declaredAmount: 20,
    rejectionReason: null,
    hasProof: false,
    paidToAccount: null,
    buyer: {
      id: 'user-1',
      alias: buyer.alias ?? 'Juan Perez',
      buyerCode: buyer.buyerCode,
      existing: buyer.existing ?? false,
      matchedBy: buyer.matchedBy ?? null,
    },
  };
}
