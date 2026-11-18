import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { normalizeSoldNumbers } from '@kanoso/raffle-draw';
import { PinField } from '../../core/verification/draw-pins';
import {
  CheckId,
  CheckStatus,
  DrawVerification,
  EmailAnchorValues,
  EmailField,
} from '../../core/verification/draw-verification';

const CHECK_LABELS: Record<CheckId, string> = {
  commitment: 'Semilla y compromiso',
  soldList: 'Lista de vendidos',
  roundBinding: 'Ronda fijada por la fecha del sorteo',
  drawConfig: 'Premios y modo de exclusión congelados al cierre',
  ownNumbers: 'Tus números están en la lista',
  emailAnchor: 'Datos de tu correo',
  drandRound: 'Ronda de drand y firma BLS',
  winner: 'Ganador calculado en tu navegador',
  official: 'Comparación con el resultado oficial',
};

const STATUS_LABELS: Record<CheckStatus, string> = {
  pending: 'Pendiente',
  running: 'En curso',
  passed: 'Correcto',
  failed: 'Falló',
  skipped: 'No se ejecutó',
};

const PIN_LABELS: Record<PinField, string> = {
  commitmentHash: 'Compromiso',
  drandRound: 'Ronda drand',
  drawAt: 'Fecha del sorteo',
  salesCloseAt: 'Cierre de ventas',
  soldListHash: 'Hash de la lista',
};

/** The values of the email section, as the page labels them. */
const EMAIL_INPUTS: readonly { field: EmailField; id: string; label: string }[] = [
  { field: 'commitmentHash', id: 'email-commitment', label: 'Compromiso' },
  { field: 'drandRound', id: 'email-round', label: 'Ronda de drand' },
  { field: 'drawAt', id: 'email-draw-at', label: 'Fecha del sorteo (ISO 8601)' },
  { field: 'salesCloseAt', id: 'email-sales-close', label: 'Cierre de ventas (ISO 8601)' },
  { field: 'prizeCount', id: 'email-prize-count', label: 'Cantidad de premios' },
  { field: 'winningAttempt', id: 'email-winning-attempt', label: 'Intento ganador' },
  { field: 'winnerExclusionMode', id: 'email-exclusion-mode', label: 'Modo de exclusión al momento de tu pago' },
];

const drawDateFormat = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'America/Lima',
});

/**
 * Route `/rifas/:id/verificacion` (RF-20, guide §8): the permanent page of a
 * draw. Shows the frozen public data and lets anyone recompute the winner
 * in their own browser (spec §10.3). Styles of PROTOTIPOS/Verificacion.dc.html.
 */
@Component({
  selector: 'app-verification-page',
  imports: [RouterLink],
  providers: [DrawVerification],
  templateUrl: './verification.page.html',
  styleUrl: './verification.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationPage implements OnInit {
  protected readonly verification = inject(DrawVerification);
  protected readonly raffleId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly checkLabels = CHECK_LABELS;
  protected readonly statusLabels = STATUS_LABELS;

  /** The commitment or the list failed: the official winner is not shown as valid (DT-11). */
  protected readonly dataInvalid = computed(() =>
    this.verification
      .checks()
      .some(
        (check) =>
          (check.id === 'commitment' || check.id === 'soldList' || check.id === 'drawConfig') &&
          check.status === 'failed',
      ),
  );

  /** Several prizes: the page lists every prize's official and local result. */
  protected readonly isMultiPrize = computed(() => (this.verification.data()?.prizes.length ?? 1) > 1);

  protected readonly exclusionLabel = computed(() =>
    this.verification.data()?.winnerExclusionMode === 'BUYER'
      ? 'Por comprador: quien gana sale del sorteo con todos sus boletos'
      : 'Solo el boleto ganador sale del sorteo',
  );

  /** One row per prize: the official result next to the one computed in this browser. */
  protected readonly prizeRows = computed(() => {
    const data = this.verification.data();
    if (!data) {
      return [];
    }
    const local = this.verification.localWinners();
    return data.prizes.map((prize) => {
      const official = data.winners.find((w) => w.position === prize.position) ?? null;
      const mine = local?.prizes.find((p) => p.position === prize.position) ?? null;
      return {
        position: prize.position,
        title: prize.title,
        official: official?.status === 'WON' ? String(official.winningNumber) : official ? 'Desierto' : '—',
        poolSize: official?.poolSize ?? null,
        local: mine ? (mine.status === 'WON' ? String(mine.winningTicket) : 'Desierto') : null,
        same:
          !!mine &&
          !!official &&
          mine.status === official.status &&
          mine.winningTicket === official.winningNumber,
      };
    });
  });

  /**
   * - verified: a full local match, nothing changed since an earlier visit,
   *   and an anchor that did not come from the platform (a pin or the email).
   * - unanchored: the same match, but only against the platform's own data.
   * - unverified: anything else.
   */
  protected readonly winnerState = computed<'verified' | 'unanchored' | 'unverified'>(() => {
    if (this.verification.verdict() !== 'match' || this.verification.pinConflicts().length > 0) {
      return 'unverified';
    }
    return this.verification.anchorStatus() === 'anchored' ? 'verified' : 'unanchored';
  });

  protected readonly anchorNote = computed(() =>
    this.verification.anchorStatus() === 'no-storage'
      ? '(tu navegador no guarda datos: compara con los datos de tu correo)'
      : '(sin ancla previa: compara con los datos de tu correo)',
  );

  /** The own-numbers check, when it did not run: the result says so. */
  protected readonly ownNumbersSkipped = computed(() => {
    const check = this.verification.checks().find((c) => c.id === 'ownNumbers');
    return check?.status === 'skipped' ? (check.detail ?? 'no se pudieron comprobar.') : null;
  });

  protected readonly emailInputs = EMAIL_INPUTS;
  protected readonly localSequence = this.verification.localSequence;
  protected readonly extractions = computed(() => this.verification.localSequence()?.extractions ?? this.verification.data()?.extractions ?? []);

  /** The email comparison, shown under its fields (DT-20). */
  protected readonly emailCheck = computed(() => this.verification.checks().find((c) => c.id === 'emailAnchor'));

  protected readonly pinConflicts = computed(() =>
    this.verification.pinConflicts().map((conflict) => ({ ...conflict, label: PIN_LABELS[conflict.field] })),
  );

  /** What the buyer pasted from the payment-approved email. */
  protected readonly emailValues = signal<EmailAnchorValues>({});

  protected readonly failedCheck = computed(() => this.verification.checks().find((check) => check.status === 'failed'));

  /** Title of a raffle without a draw yet, or cancelled. */
  protected readonly titleOf = computed(() => {
    const state = this.verification.state();
    return state.kind === 'not-drawn' || state.kind === 'cancelled' ? state.title : '';
  });

  protected readonly errorMessage = computed(() => {
    const state = this.verification.state();
    return state.kind === 'error' ? state.message : '';
  });

  protected readonly drawnAt = computed(() => {
    const date = this.verification.data()?.official.executedAt;
    return date ? `Sorteado el ${drawDateFormat.format(date)}` : null;
  });

  /**
   * The sold list exactly as it was hashed (ascending, comma separated, no
   * newline), so `sha256sum` of the file gives the published list hash.
   */
  protected readonly listFile = computed(() => {
    const data = this.verification.data();
    if (!data) {
      return null;
    }
    let text: string;
    try {
      text = normalizeSoldNumbers(data.soldNumbers).join(',');
    } catch {
      return null;
    }
    return {
      href: `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`,
      name: `lista-vendidos-${data.raffleId}.csv`,
    };
  });

  ngOnInit(): void {
    void this.verification.load(this.raffleId);
  }

  protected retry(): void {
    void this.verification.load(this.raffleId);
  }

  protected pasteEmailValue(field: EmailField, event: Event): void {
    this.emailValues.update((values) => ({ ...values, [field]: (event.target as HTMLInputElement).value }));
    this.verification.compareWithEmail(this.emailValues());
  }

  protected recompute(): void {
    void this.verification.recompute();
  }
}
