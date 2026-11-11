import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { roundAt, timeOfRound } from '@kanoso/raffle-draw';
import { toApiError } from '../../../core/api/api-error';
import { AdminApi } from '../../../core/api/admin-api';
import {
  AdminSalesReport,
  ExecuteDrawResult,
  Order,
  PublishedRaffle,
  RaffleOrderWithBuyer,
  RaffleSummary,
} from '../../../core/api/api.models';
import { QUICKNET } from '../../../core/drand/quicknet';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  CLOSED: 'Cerrada',
  DRAWN: 'Sorteada',
  CANCELLED: 'Cancelada',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  PAID: 'Pagado',
  PENDING_VERIFICATION: 'En verificación',
  PENDING: 'Reservado',
  EXPIRED: 'Expirado',
  REJECTED: 'Rechazado',
  REFUND_PENDING: 'Reembolso pendiente',
  REFUNDED: 'Reembolsado',
  LATE_PAYMENT_REVIEW: 'Reclamo tardío',
  LATE_PAYMENT_DISMISSED: 'Reclamo descartado',
};

function datesOrderValidator(control: AbstractControl): ValidationErrors | null {
  const close = control.get('cierre_ventas')?.value;
  const draw = control.get('fecha_sorteo')?.value;
  if (close && draw) {
    const closeTime = new Date(close).getTime();
    const drawTime = new Date(draw).getTime();
    if (drawTime <= closeTime) {
      return { drawBeforeClose: true };
    }
  }
  return null;
}

@Component({
  selector: 'app-admin-raffle-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './admin-raffle-detail.page.html',
  styleUrl: './admin-raffle-detail.page.scss',
})
export class AdminRaffleDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApi);
  private readonly fb = inject(FormBuilder);

  readonly raffleId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly raffle = signal<RaffleSummary | null>(null);
  readonly sales = signal<AdminSalesReport | null>(null);
  readonly orders = signal<RaffleOrderWithBuyer[]>([]);
  readonly orderSearchTerm = signal('');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly publishSuccess = signal<PublishedRaffle | null>(null);
  readonly drawResult = signal<ExecuteDrawResult | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actionLoading = signal(false);

  readonly showDeleteDraftDialog = signal(false);
  readonly showCancelDialog = signal(false);
  readonly cancelReason = signal('');
  readonly cancelConfirmed = signal(false);

  // Edit Showcase State
  readonly showEditShowcaseModal = signal(false);
  readonly editPrizeDescription = signal('');
  readonly editPrizeImages = signal<string[]>([]);
  readonly editNewImageUrl = signal('');
  readonly editImageError = signal<string | null>(null);
  readonly editDrawEffect = signal('SLOT_MACHINE');
  readonly editWinningAttempt = signal(1);
  readonly editDrawMode = signal('AUTOMATIC');
  readonly editDrawDurationSec = signal(4);
  readonly editDrawSpeed = signal('NORMAL');
  readonly editSaving = signal(false);
  readonly editError = signal<string | null>(null);

  openEditShowcaseModal(): void {
    const r = this.raffle();
    if (!r) return;
    this.editPrizeDescription.set(r.prizeDescription ?? '');
    this.editPrizeImages.set(r.prizeImages ? [...r.prizeImages] : []);
    this.editNewImageUrl.set('');
    this.editImageError.set(null);
    this.editDrawEffect.set(r.drawEffect ?? 'SLOT_MACHINE');
    this.editWinningAttempt.set(r.winningAttempt ?? 1);
    this.editDrawMode.set(r.drawMode ?? 'AUTOMATIC');
    this.editDrawDurationSec.set(r.drawDurationSec ?? 4);
    this.editDrawSpeed.set(r.drawSpeed ?? 'NORMAL');
    this.editError.set(null);
    this.showEditShowcaseModal.set(true);
  }

  closeEditShowcaseModal(): void {
    this.showEditShowcaseModal.set(false);
  }

  addEditImage(): void {
    const url = this.editNewImageUrl().trim();
    this.editImageError.set(null);
    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      this.editImageError.set('La URL debe comenzar con http:// o https://');
      return;
    }

    if (this.editPrizeImages().length >= 10) {
      this.editImageError.set('Máximo 10 imágenes permitidas');
      return;
    }

    this.editPrizeImages.update((imgs) => [...imgs, url]);
    this.editNewImageUrl.set('');
  }

  removeEditImage(index: number): void {
    this.editPrizeImages.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  saveEditShowcase(): void {
    this.editSaving.set(true);
    this.editError.set(null);

    this.adminApi
      .updateDraftRaffle(this.raffleId, {
        descripcion_premio: this.editPrizeDescription().trim() || null,
        imagenes_premio: this.editPrizeImages(),
        efecto_sorteo: this.editDrawEffect(),
        intento_ganador: this.editWinningAttempt(),
        modalidad_sorteo: this.editDrawMode(),
        duracion_efecto_seg: this.editDrawDurationSec(),
        velocidad_efecto: this.editDrawSpeed(),
      })
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.showEditShowcaseModal.set(false);
          this.loadData();
        },
        error: (err: unknown) => {
          this.editSaving.set(false);
          this.editError.set(toApiError(err).userMessage || 'No se pudo guardar la información del premio.');
        },
      });
  }

  // POS In-Person Sale State
  readonly showPosModal = signal(false);
  readonly posAlias = signal('');
  readonly posPhone = signal('');
  readonly posDocument = signal('');
  readonly posNumbersInput = signal('');
  readonly posLoading = signal(false);
  readonly posLoadingAvailable = signal(false);
  readonly posAvailableNumbers = signal<number[]>([]);
  readonly posError = signal<string | null>(null);
  readonly posSuccessOrder = signal<Order | null>(null);

  isPosNumberSelected(num: number): boolean {
    return this.parsedPosNumbers().includes(num);
  }

  togglePosNumber(num: number): void {
    const current = this.parsedPosNumbers();
    let updated: number[];
    if (current.includes(num)) {
      updated = current.filter((n) => n !== num);
    } else {
      updated = [...current, num].sort((a, b) => a - b);
    }
    this.posNumbersInput.set(updated.join(', '));
  }

  pickRandomPos(count: number = 1): void {
    const available = this.posAvailableNumbers();
    const current = this.parsedPosNumbers();
    const unselected = available.filter((n) => !current.includes(n));
    if (unselected.length === 0) return;
    const shuffled = [...unselected].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, count);
    const updated = [...current, ...picked].sort((a, b) => a - b);
    this.posNumbersInput.set(updated.join(', '));
  }

  clearPosNumbers(): void {
    this.posNumbersInput.set('');
  }

  readonly parsedPosNumbers = computed(() => {
    const raw = this.posNumbersInput().trim();
    if (!raw) return [];
    return [
      ...new Set(
        raw
          .split(/[\s,]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n) && n >= 0),
      ),
    ].sort((a, b) => a - b);
  });

  readonly posTotalAmount = computed(() => {
    const count = this.parsedPosNumbers().length;
    const price = this.raffle()?.ticketPrice ?? 0;
    return count * price;
  });

  readonly filteredOrders = computed(() => {
    const term = this.orderSearchTerm().trim().toLowerCase();
    const list = this.orders();
    if (!term) return list;

    return list.filter((o) => {
      if (o.id.toLowerCase().includes(term)) return true;
      if (o.numbers.some((n) => n.toString() === term || n.toString().includes(term))) return true;
      if (o.buyer?.name?.toLowerCase().includes(term)) return true;
      if (o.buyer?.document?.toLowerCase().includes(term)) return true;
      if (o.buyer?.phone?.toLowerCase().includes(term)) return true;
      if (o.buyer?.email?.toLowerCase().includes(term)) return true;
      if (o.operationNumber?.toLowerCase().includes(term)) return true;
      return false;
    });
  });

  readonly publishForm = this.fb.group(
    {
      resolucion_autorizacion: ['', [Validators.required, Validators.maxLength(200)]],
      cierre_ventas: ['', [Validators.required]],
      fecha_sorteo: ['', [Validators.required]],
      confirmado: [false, [Validators.requiredTrue]],
    },
    { validators: [datesOrderValidator] },
  );

  private readonly fechaSorteoSignal = toSignal(this.publishForm.controls.fecha_sorteo.valueChanges, {
    initialValue: '',
  });

  // Dynamic preview of Drand Round for RF-11
  readonly drandRoundPreview = computed(() => {
    const drawDateVal = this.fechaSorteoSignal();
    if (!drawDateVal) return null;
    const drawDate = new Date(drawDateVal);
    if (isNaN(drawDate.getTime())) return null;

    const chain = { genesisTimeSec: QUICKNET.genesisTimeSec, periodSec: QUICKNET.periodSec };
    try {
      const round = roundAt(drawDate.getTime(), chain);
      const expectedTime = new Date(timeOfRound(round, chain));
      return {
        round: round.toString(),
        expectedTimeIso: expectedTime.toISOString(),
      };
    } catch {
      return null;
    }
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    if (!this.raffleId) {
      this.error.set('Identificador de rifa no proporcionado.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.adminApi.raffleDetail(this.raffleId).subscribe({
      next: (raffleData) => {
        this.raffle.set(raffleData);
        this.adminApi.salesReport(this.raffleId).subscribe({
          next: (salesData) => {
            this.sales.set(salesData);
          },
          error: () => {},
        });

        this.adminApi.raffleOrders(this.raffleId).subscribe({
          next: (ordersData) => {
            this.orders.set(ordersData);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('No se pudo cargar la información de la rifa.');
        this.loading.set(false);
      },
    });
  }

  onPublish(): void {
    if (this.publishForm.invalid) {
      this.publishForm.markAllAsTouched();
      return;
    }

    this.actionLoading.set(true);
    this.actionError.set(null);

    const val = this.publishForm.getRawValue();
    const closeIso = new Date(val.cierre_ventas!).toISOString();
    const drawIso = new Date(val.fecha_sorteo!).toISOString();

    this.adminApi
      .publishRaffle(this.raffleId, {
        resolucion_autorizacion: val.resolucion_autorizacion!.trim(),
        cierre_ventas: closeIso,
        fecha_sorteo: drawIso,
      })
      .subscribe({
        next: (pub) => {
          this.actionLoading.set(false);
          this.publishSuccess.set(pub);
          this.loadData();
        },
        error: (err: unknown) => {
          this.actionLoading.set(false);
          this.actionError.set(toApiError(err).userMessage || 'No se pudo publicar la rifa. Verifica los datos e intenta nuevamente.');
        },
      });
  }

  onDraw(): void {
    this.actionLoading.set(true);
    this.actionError.set(null);

    this.adminApi.executeDraw(this.raffleId).subscribe({
      next: (res) => {
        this.actionLoading.set(false);
        this.drawResult.set(res);
        this.loadData();
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(
          toApiError(err).userMessage || 'No se pudo ejecutar el sorteo. Verifica el estado de la ronda drand.'
        );
      },
    });
  }

  onCancel(): void {
    const reason = this.cancelReason().trim();
    if (!reason || !this.cancelConfirmed()) return;

    this.actionLoading.set(true);
    this.actionError.set(null);

    this.adminApi.cancelAlteredRaffle(this.raffleId, reason).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.showCancelDialog.set(false);
        this.loadData();
      },
      error: () => {
        this.actionLoading.set(false);
        this.actionError.set('No se pudo cancelar la rifa.');
      },
    });
  }

  onDeleteDraft(): void {
    this.actionLoading.set(true);
    this.actionError.set(null);

    this.adminApi.deleteDraftRaffle(this.raffleId).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.showDeleteDraftDialog.set(false);
        this.router.navigate(['/admin/rifas']);
      },
      error: (err: unknown) => {
        this.actionLoading.set(false);
        this.actionError.set(
          toApiError(err).userMessage || 'No se pudo eliminar el borrador de la rifa.',
        );
      },
    });
  }

  openPosModal(): void {
    this.posAlias.set('');
    this.posPhone.set('');
    this.posDocument.set('');
    this.posNumbersInput.set('');
    this.posError.set(null);
    this.posSuccessOrder.set(null);
    this.posLoading.set(false);
    this.posAvailableNumbers.set([]);
    this.posLoadingAvailable.set(true);
    this.showPosModal.set(true);

    this.adminApi.availableTickets(this.raffleId).subscribe({
      next: (numbers) => {
        this.posAvailableNumbers.set(Array.isArray(numbers) ? numbers : []);
        this.posLoadingAvailable.set(false);
      },
      error: () => {
        this.posAvailableNumbers.set([]);
        this.posLoadingAvailable.set(false);
      },
    });
  }

  closePosModal(): void {
    this.showPosModal.set(false);
  }

  submitPosSale(): void {
    const numbers = this.parsedPosNumbers();
    const alias = this.posAlias().trim();
    const phone = this.posPhone().trim();
    const document = this.posDocument().trim() || null;

    if (numbers.length === 0) {
      this.posError.set('Debes ingresar al menos un número de boleto.');
      return;
    }
    if (!alias) {
      this.posError.set('El nombre o alias del comprador es obligatorio.');
      return;
    }
    if (!phone) {
      this.posError.set('El teléfono o celular del comprador es obligatorio.');
      return;
    }

    this.posLoading.set(true);
    this.posError.set(null);

    this.adminApi
      .sellInPerson(this.raffleId, {
        numbers,
        alias,
        phone,
        document,
      })
      .subscribe({
        next: (order) => {
          this.posLoading.set(false);
          this.posSuccessOrder.set(order);
          this.loadData();
        },
        error: (err: unknown) => {
          this.posLoading.set(false);
          this.posError.set(
            toApiError(err).userMessage || 'No se pudo registrar la venta presencial. Verifica los boletos ingresados.',
          );
        },
      });
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  orderStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status] ?? status;
  }

  proofUrl(orderId: string): string {
    return this.adminApi.proofFileUrl(orderId);
  }

  drawModeLabel(mode?: string): string {
    return mode === 'MANUAL' ? 'Manual en Vivo (Paso a paso)' : 'Automático Verificable';
  }

  drawSpeedLabel(speed?: string): string {
    if (speed === 'SLOW') return 'Lenta';
    if (speed === 'FAST') return 'Rápida';
    return 'Normal';
  }
}
