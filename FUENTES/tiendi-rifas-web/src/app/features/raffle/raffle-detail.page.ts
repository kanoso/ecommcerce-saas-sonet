import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GOOGLE_CLIENT_ID } from '../../core/api/api-config';
import { toApiError } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { Session } from '../../core/api/api.models';
import { SessionStore } from '../../core/session/session.store';
import { formatCloseDate, formatCount, formatPrice } from '../catalog/raffle-format';
import { RaffleDetailStore } from './raffle-detail.store';
import { formatCents } from './raffle-grid.model';

declare const google: {
  accounts?: {
    id?: {
      initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};


/**
 * Wording of guide §7.1 (the prototype's "10 min" is outdated). The real
 * length is RESERVATION_TTL_MINUTES of the API, which it does not publish
 * before reserving; the payment page counts down from the order's `vence_en`.
 */
export const RESERVE_LABEL = 'Reservar 15 min';

/** Query param the payment page adds when it sends the buyer back. */
export const EXPIRED_RESERVATION_PARAM = 'reserva';
export const EXPIRED_RESERVATION_VALUE = 'vencida';
export const EXPIRED_RESERVATION_NOTICE = 'Tu reserva venció y tus números se liberaron. Puedes elegirlos de nuevo.';

/** A drand round grouped for reading; left as sent when it is not a safe integer. */
function formatRound(round: string): string {
  const value = Number(round);
  return /^\d+$/.test(round) && Number.isSafeInteger(value) ? formatCount(value) : round;
}

/** Route `/rifas/:id`: raffle data, commitment, number grid and reservation (RF-02). */
@Component({
  selector: 'app-raffle-detail-page',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  providers: [RaffleDetailStore],
  templateUrl: './raffle-detail.page.html',
  styleUrl: './raffle-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RaffleDetailPage implements OnInit {
  protected readonly store = inject(RaffleDetailStore);
  private readonly session = inject(SessionStore);
  private readonly auth = inject(AuthApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly googleClientId = inject(GOOGLE_CLIENT_ID);

  protected readonly reserveLabel = RESERVE_LABEL;
  protected readonly raffleId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly expiredNotice =
    this.route.snapshot.queryParamMap.get(EXPIRED_RESERVATION_PARAM) === EXPIRED_RESERVATION_VALUE
      ? EXPIRED_RESERVATION_NOTICE
      : null;


  // Prize showcase and tabs
  readonly activeTab = signal<'boletos' | 'ficha'>('boletos');
  readonly activeImageIndex = signal<number>(0);
  readonly hasImages = computed(() => (this.store.raffle()?.prizeImages?.length ?? 0) > 0);
  readonly hasSpecs = computed(() => !!this.store.raffle()?.prizeDescription || this.hasImages());

  nextImage(): void {
    const total = this.store.raffle()?.prizeImages?.length ?? 0;
    if (total > 0) {
      this.activeImageIndex.update((i) => (i + 1) % total);
    }
  }

  prevImage(): void {
    const total = this.store.raffle()?.prizeImages?.length ?? 0;
    if (total > 0) {
      this.activeImageIndex.update((i) => (i - 1 + total) % total);
    }
  }

  setImage(idx: number): void {
    this.activeImageIndex.set(idx);
  }

  // In-place auth modal state (Opción B)
  protected readonly showAuthModal = signal(false);
  protected readonly authTab = signal<'login' | 'register'>('login');
  protected readonly authStatus = signal<'idle' | 'sending' | 'error'>('idle');
  protected readonly authError = signal('');

  // Login form controls
  protected readonly loginIdentifier = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly loginPassword = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  // Register form controls
  protected readonly regName = new FormControl('', { nonNullable: true });
  protected readonly regIdentifier = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly regPassword = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6)],
  });

  protected readonly price = computed(() => formatPrice(this.store.raffle()?.ticketPrice ?? 0));
  protected readonly total = computed(() => formatCents(this.store.totalCents()));
  protected readonly closeDate = computed(() => this.dateOf(this.store.raffle()?.salesCloseAt));
  protected readonly drawDate = computed(() => this.dateOf(this.store.raffle()?.drawAt));
  protected readonly round = computed(() => {
    const round = this.store.commitment()?.drandRound;
    return round ? formatRound(round) : null;
  });

  constructor() {
    effect(() => {
      const order = this.store.order();
      if (order) {
        void this.router.navigate(['/rifas', this.raffleId, 'pago', order.id]);
      }
    });
  }

  ngOnInit(): void {
    this.store.load(this.raffleId);
    this.store.startPolling();
  }

  /**
   * If authenticated, proceed to reserve directly.
   * If unauthenticated, trigger Opción B: open in-place auth modal to preserve ticket selection.
   */
  protected reserve(): void {
    if (!this.session.isAuthenticated()) {
      this.openAuthModal();
      return;
    }
    this.store.reserve();
  }

  protected openAuthModal(): void {
    this.showAuthModal.set(true);
    this.authStatus.set('idle');
    this.authError.set('');
    setTimeout(() => this.initGoogleButton(), 50);
  }

  protected closeAuthModal(): void {
    this.showAuthModal.set(false);
    this.authError.set('');
    this.authStatus.set('idle');
  }

  protected setAuthTab(tab: 'login' | 'register'): void {
    this.authTab.set(tab);
    this.authError.set('');
    setTimeout(() => this.initGoogleButton(), 50);
  }

  protected submitModalLogin(): void {
    this.loginIdentifier.setValue(this.loginIdentifier.value.trim());
    if (this.loginIdentifier.invalid || this.loginPassword.invalid) {
      this.authError.set('Ingresa tu identificador y contraseña.');
      return;
    }
    this.authStatus.set('sending');
    this.authError.set('');
    this.auth
      .login(this.loginIdentifier.value, this.loginPassword.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishModalAuth(session),
        error: (err: unknown) => {
          this.authError.set(toApiError(err).userMessage);
          this.authStatus.set('error');
        },
      });
  }

  protected submitModalRegister(): void {
    this.regIdentifier.setValue(this.regIdentifier.value.trim());
    if (this.regIdentifier.invalid || this.regPassword.invalid) {
      this.authError.set('Ingresa un DNI (8 dígitos), celular (9 dígitos) o correo, y una contraseña de al menos 6 caracteres.');
      return;
    }
    this.authStatus.set('sending');
    this.authError.set('');
    this.auth
      .register(this.regIdentifier.value, this.regPassword.value, this.regName.value.trim() || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishModalAuth(session),
        error: (err: unknown) => {
          this.authError.set(toApiError(err).userMessage);
          this.authStatus.set('error');
        },
      });
  }

  private initGoogleButton(): void {
    if (typeof google === 'undefined' || !google.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: this.googleClientId,
      callback: (res: { credential?: string }) => {
        if (res.credential) {
          this.ngZone.run(() => this.handleGoogleCredential(res.credential!));
        }
      },
    });

    const container = document.getElementById('modal-google-btn-container');
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 300,
      });
    }
  }

  private handleGoogleCredential(credential: string): void {
    this.authStatus.set('sending');
    this.auth
      .loginWithGoogle(credential)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => this.finishModalAuth(session),
        error: (err: unknown) => {
          this.authError.set(toApiError(err).userMessage);
          this.authStatus.set('error');
        },
      });
  }

  private finishModalAuth(session: Session): void {
    if (!this.session.signIn(session)) {
      this.authError.set('No se pudo iniciar sesión.');
      this.authStatus.set('error');
      return;
    }
    this.showAuthModal.set(false);
    this.authStatus.set('idle');
    this.authError.set('');
    // Reserve immediately with selected numbers!
    this.store.reserve();
  }

  protected retry(): void {
    this.store.load(this.raffleId);
  }

  protected effectLabel(effect?: string): string {
    switch (effect) {
      case 'SNAKE':
        return 'Ruleta Serpiente';
      case 'TOMBOLA':
        return 'Tómbola Esférica';
      case 'RADAR':
        return 'Radar de Precisión';
      case 'SUSPENSE_CONFETTI':
        return 'Reflector y Suspenso';
      case 'SLOT_MACHINE':
      default:
        return 'Tragamonedas';
    }
  }

  protected speedLabel(speed?: string): string {
    if (speed === 'SLOW') return 'Lenta';
    if (speed === 'FAST') return 'Rápida';
    return 'Normal';
  }

  private dateOf(date: Date | null | undefined): string | null {
    return date ? formatCloseDate(date) : null;
  }
}
